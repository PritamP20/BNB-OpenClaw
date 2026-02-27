// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title IncentiveEngine
 * @notice Referral tracking and Merkle-tree airdrop distribution for AgentLaunch.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REFERRAL SYSTEM
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Users register once with a referrer address.
 *  The contract tracks how many referrals each referrer has brought.
 *  Off-chain: referrers earn rewards based on their referral count + volume.
 *  On-chain:  simple count stored here; reward distribution is a future module.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AIRDROP SYSTEM
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Campaign creator:
 *    1. Approves IncentiveEngine to spend `totalAmount` tokens.
 *    2. Calls createAirdrop(token, merkleRoot, totalAmount, deadline).
 *    3. Off-chain: computes Merkle tree of (address, amount) pairs.
 *
 *  Recipient:
 *    1. Calls claimAirdrop(campaignId, amount, merkleProof).
 *    2. Contract verifies proof, marks address as claimed, transfers tokens.
 *
 *  Post-deadline:
 *    Creator calls reclaimExpired(campaignId) to recover unclaimed tokens.
 */
contract IncentiveEngine is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────

    struct AirdropCampaign {
        /// ERC-20 token being airdropped.
        address token;
        /// Merkle root of the (address, amount) claim tree.
        bytes32 merkleRoot;
        /// Total tokens deposited for this campaign.
        uint256 totalAmount;
        /// Tokens claimed so far.
        uint256 claimedAmount;
        /// Unix timestamp after which unclaimed tokens can be reclaimed.
        uint256 deadline;
        /// Campaign creator (can reclaim expired funds).
        address creator;
        /// Whether the campaign has been cancelled / reclaimed.
        bool finalized;
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    // ── Referrals ──────────────────────────────────────────────────────────

    /// @dev user → referrer (set once, immutable)
    mapping(address => address) private _referredBy;

    /// @dev referrer → number of successful referrals
    mapping(address => uint256) public referralCount;

    // ── Airdrops ───────────────────────────────────────────────────────────

    uint256 private _nextCampaignId;

    /// @dev campaignId → AirdropCampaign
    mapping(uint256 => AirdropCampaign) private _campaigns;

    /// @dev campaignId → claimant address → claimed flag
    mapping(uint256 => mapping(address => bool)) private _claimed;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    // Referral
    event ReferralRegistered(address indexed user, address indexed referrer);

    // Airdrop
    event AirdropCreated(
        uint256 indexed campaignId,
        address indexed token,
        address indexed creator,
        uint256 totalAmount,
        uint256 deadline
    );

    event AirdropClaimed(
        uint256 indexed campaignId,
        address indexed claimant,
        uint256 amount
    );

    event AirdropReclaimed(
        uint256 indexed campaignId,
        address indexed creator,
        uint256 reclaimedAmount
    );

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Referral System
    // ─────────────────────────────────────────────

    /**
     * @notice Register a referral relationship.
     *         Can only be set once per user; referrer cannot refer themselves.
     * @param referrer  The address that referred the caller.
     */
    function registerReferral(address referrer) external {
        require(referrer != address(0), "IncentiveEngine: zero referrer");
        require(referrer != msg.sender, "IncentiveEngine: self-referral not allowed");
        require(_referredBy[msg.sender] == address(0), "IncentiveEngine: already registered");

        _referredBy[msg.sender] = referrer;
        referralCount[referrer] += 1;

        emit ReferralRegistered(msg.sender, referrer);
    }

    /// @notice Returns the referrer for `user` (address(0) if none).
    function getReferrer(address user) external view returns (address) {
        return _referredBy[user];
    }

    /// @notice Returns true if the user has registered a referral.
    function hasReferral(address user) external view returns (bool) {
        return _referredBy[user] != address(0);
    }

    // ─────────────────────────────────────────────
    // Airdrop System
    // ─────────────────────────────────────────────

    /**
     * @notice Create a new Merkle-tree airdrop campaign.
     *         Caller must approve this contract to spend `totalAmount` tokens first.
     *
     * @param token       ERC-20 token to distribute.
     * @param merkleRoot  Root of the (address, amount) Merkle tree.
     * @param totalAmount Total tokens to lock for this campaign.
     * @param deadline    Unix timestamp after which creator can reclaim unclaimed tokens.
     * @return campaignId  Newly created campaign ID.
     */
    function createAirdrop(
        address token,
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 deadline
    ) external nonReentrant returns (uint256 campaignId) {
        require(token != address(0), "IncentiveEngine: zero token");
        require(merkleRoot != bytes32(0), "IncentiveEngine: zero merkle root");
        require(totalAmount > 0, "IncentiveEngine: zero amount");
        require(deadline > block.timestamp, "IncentiveEngine: deadline in the past");

        campaignId = _nextCampaignId++;

        _campaigns[campaignId] = AirdropCampaign({
            token: token,
            merkleRoot: merkleRoot,
            totalAmount: totalAmount,
            claimedAmount: 0,
            deadline: deadline,
            creator: msg.sender,
            finalized: false
        });

        // Pull tokens from creator into this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        emit AirdropCreated(campaignId, token, msg.sender, totalAmount, deadline);
    }

    /**
     * @notice Claim an airdrop allocation using a Merkle proof.
     *
     * @param campaignId   Campaign to claim from.
     * @param amount       Claimable amount (must match the leaf in the tree).
     * @param merkleProof  Proof path from leaf to root.
     */
    function claimAirdrop(
        uint256 campaignId,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        AirdropCampaign storage campaign = _campaigns[campaignId];

        require(!campaign.finalized, "IncentiveEngine: campaign finalized");
        require(block.timestamp <= campaign.deadline, "IncentiveEngine: campaign expired");
        require(!_claimed[campaignId][msg.sender], "IncentiveEngine: already claimed");
        require(amount > 0, "IncentiveEngine: zero amount");

        // Verify Merkle proof: leaf = keccak256(abi.encodePacked(address, amount))
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(
            MerkleProof.verify(merkleProof, campaign.merkleRoot, leaf),
            "IncentiveEngine: invalid proof"
        );

        require(
            campaign.claimedAmount + amount <= campaign.totalAmount,
            "IncentiveEngine: exceeds campaign total"
        );

        _claimed[campaignId][msg.sender] = true;
        campaign.claimedAmount += amount;

        IERC20(campaign.token).safeTransfer(msg.sender, amount);

        emit AirdropClaimed(campaignId, msg.sender, amount);
    }

    /**
     * @notice Reclaim unclaimed tokens after the campaign deadline.
     *         Only callable by the campaign creator.
     */
    function reclaimExpired(uint256 campaignId) external nonReentrant {
        AirdropCampaign storage campaign = _campaigns[campaignId];

        require(campaign.creator == msg.sender, "IncentiveEngine: not campaign creator");
        require(block.timestamp > campaign.deadline, "IncentiveEngine: deadline not passed");
        require(!campaign.finalized, "IncentiveEngine: already finalized");

        uint256 remaining = campaign.totalAmount - campaign.claimedAmount;
        campaign.finalized = true;

        if (remaining > 0) {
            IERC20(campaign.token).safeTransfer(msg.sender, remaining);
        }

        emit AirdropReclaimed(campaignId, msg.sender, remaining);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Returns full campaign details.
    function getCampaign(uint256 campaignId) external view returns (AirdropCampaign memory) {
        return _campaigns[campaignId];
    }

    /// @notice Returns true if `claimant` has claimed from `campaignId`.
    function hasClaimed(uint256 campaignId, address claimant) external view returns (bool) {
        return _claimed[campaignId][claimant];
    }

    /// @notice Total number of airdrop campaigns created.
    function totalCampaigns() external view returns (uint256) {
        return _nextCampaignId;
    }
}
