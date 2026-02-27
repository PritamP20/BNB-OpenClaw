// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SkillToken
 * @notice Sub-modular skill token linked to a specific NFA agent.
 *
 * Each skill token represents a purchasable, consumable capability
 * that users can attach to an AI agent.
 *
 * Features:
 *   - Immutable agentId and skillId (bytes32 identifier for the skill type).
 *   - costPerUse: amount of this token burned per skill invocation.
 *   - consumeSkill(): user calls this on-chain to prove and pay for skill usage.
 *   - verifySkillAccess(): read-only check used by the backend before processing.
 *   - Owner-controlled minting (no supply cap — skills can be freely minted by creator).
 *
 * Off-chain flow:
 *   Backend checks verifySkillAccess → user calls consumeSkill on-chain → backend processes.
 */
contract SkillToken is ERC20Burnable, Ownable {
    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @notice The NFA agent ID this skill belongs to.
    uint256 public immutable agentId;

    /// @notice Unique identifier for this skill type (e.g. keccak256("debug")).
    bytes32 public immutable skillId;

    /// @notice Tokens burned per skill invocation (0 = free skill).
    uint256 public costPerUse;

    /// @notice Address that created this skill via TokenFactory.
    address public immutable creator;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event SkillUsed(address indexed user, uint256 burnedAmount);
    event CostPerUseUpdated(uint256 oldCost, uint256 newCost);
    event TokensMinted(address indexed to, uint256 amount);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    /**
     * @param name_          Token name (e.g. "Debug Skill").
     * @param symbol_        Token symbol (e.g. "DEBUG").
     * @param initialSupply  Tokens minted to `creator_` at deploy.
     * @param agentId_       NFA agent ID this skill is registered under.
     * @param skillId_       bytes32 identifier for the skill (e.g. keccak256("debug")).
     * @param costPerUse_    Number of tokens burned per consumeSkill call.
     * @param creator_       Address deploying this token via TokenFactory.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        uint256 agentId_,
        bytes32 skillId_,
        uint256 costPerUse_,
        address creator_
    ) ERC20(name_, symbol_) Ownable(creator_) {
        require(creator_ != address(0), "SkillToken: zero creator");
        require(skillId_ != bytes32(0), "SkillToken: empty skillId");

        agentId = agentId_;
        skillId = skillId_;
        costPerUse = costPerUse_;
        creator = creator_;

        if (initialSupply > 0) {
            _mint(creator_, initialSupply);
            emit TokensMinted(creator_, initialSupply);
        }
    }

    // ─────────────────────────────────────────────
    // Skill Interaction
    // ─────────────────────────────────────────────

    /**
     * @notice Burn `costPerUse` tokens from the caller to consume one skill use.
     *         Reverts if skill is free (costPerUse == 0) — use off-chain check instead.
     *         Emits SkillUsed for the backend to pick up.
     */
    function consumeSkill() external {
        require(costPerUse > 0, "SkillToken: skill has no cost, access is free");
        require(
            balanceOf(msg.sender) >= costPerUse,
            "SkillToken: insufficient skill tokens"
        );
        _burn(msg.sender, costPerUse);
        emit SkillUsed(msg.sender, costPerUse);
    }

    /**
     * @notice Returns true if `user` holds enough tokens to invoke the skill once.
     *         A costPerUse of 0 means access is always granted.
     */
    function verifySkillAccess(address user) external view returns (bool) {
        if (costPerUse == 0) return true;
        return balanceOf(user) >= costPerUse;
    }

    // ─────────────────────────────────────────────
    // Owner Actions
    // ─────────────────────────────────────────────

    /**
     * @notice Mint additional skill tokens to `to`.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Update the cost per skill use.
     */
    function setCostPerUse(uint256 newCost) external onlyOwner {
        emit CostPerUseUpdated(costPerUse, newCost);
        costPerUse = newCost;
    }
}
