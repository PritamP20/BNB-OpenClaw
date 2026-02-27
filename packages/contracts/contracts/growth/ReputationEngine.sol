// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ReputationEngine
 * @notice On-chain health and reputation scoring for AgentLaunch tokens.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SCORE COMPONENTS (total: 100 points)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Fundraising  (0–30 pts): bnbRaised / graduationThreshold × 30
 *                             → measures how close to graduation.
 *   Graduation   (0–20 pts): +20 if the bonding curve has graduated.
 *   Distribution (0–20 pts): tokensSold / tokenSupply × 20
 *                             → measures how widely the supply is distributed.
 *   Burn Ratio   (0–20 pts): totalBurned / tokenSupply × 20
 *                             → rewards deflationary buyback activity.
 *   Longevity    (0–10 pts): +10 after the token has been live ≥ 7 days.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UPDATING SCORES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Anyone can call updateScore() — it reads public state from the BondingCurve
 *  and the BuybackBurn module, then stores the computed score on-chain.
 *
 *  The score is a snapshot; call updateScore() again to refresh it.
 */
/// @dev Minimal BondingCurve interface for ReputationEngine reads
interface IBondingCurveRE {
    function token() external view returns (address);
    function tokenSupply() external view returns (uint256);
    function tokensSold() external view returns (uint256);
    function bnbRaised() external view returns (uint256);
    function graduationThreshold() external view returns (uint256);
    function graduated() external view returns (bool);
}

/// @dev Minimal BuybackBurn interface for burn data reads
interface IBuybackBurnRE {
    function totalBurned(address token) external view returns (uint256);
}

contract ReputationEngine is Ownable {
    // ─────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────

    struct ReputationData {
        /// Overall score 0–100.
        uint256 score;
        /// Block timestamp of last score update.
        uint256 lastUpdated;
        /// Block timestamp when the token was first registered/scored.
        uint256 launchTime;
        /// Snapshot values at last update (for UI display).
        uint256 snapshotBNBRaised;
        uint256 snapshotTokensSold;
        uint256 snapshotBurned;
        bool graduated;
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @dev token address → ReputationData
    mapping(address => ReputationData) private _reputation;

    /// @dev All tokens that have ever been scored (for enumeration).
    address[] private _scoredTokens;

    /// @notice Optional BuybackBurn module address used for burn data.
    address public buybackBurn;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event ScoreUpdated(
        address indexed token,
        address indexed curve,
        uint256 newScore
    );

    event BuybackBurnUpdated(address indexed newBuybackBurn);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Score Update
    // ─────────────────────────────────────────────

    /**
     * @notice Compute and store the current reputation score for a token.
     *         Callable by anyone. Reads state directly from the BondingCurve.
     *
     * @param curve  Address of the BondingCurve for the token.
     */
    function updateScore(address curve) external {
        require(curve != address(0), "ReputationEngine: zero curve");

        IBondingCurveRE bc = IBondingCurveRE(curve);
        address tokenAddr = bc.token();
        require(tokenAddr != address(0), "ReputationEngine: invalid curve");

        // Track first-seen timestamp
        if (_reputation[tokenAddr].launchTime == 0) {
            _reputation[tokenAddr].launchTime = block.timestamp;
            _scoredTokens.push(tokenAddr);
        }

        // Compute score via helper (avoids stack-too-deep)
        uint256 totalScore = _computeScore(tokenAddr, bc);

        // Store snapshot
        ReputationData storage rep = _reputation[tokenAddr];
        rep.score = totalScore;
        rep.lastUpdated = block.timestamp;
        rep.snapshotBNBRaised = bc.bnbRaised();
        rep.snapshotTokensSold = bc.tokensSold();
        rep.snapshotBurned = (buybackBurn != address(0))
            ? IBuybackBurnRE(buybackBurn).totalBurned(tokenAddr)
            : 0;
        rep.graduated = bc.graduated();

        emit ScoreUpdated(tokenAddr, curve, totalScore);
    }

    /**
     * @dev Computes the 0-100 reputation score from bonding curve state.
     *      Extracted to avoid stack-too-deep in updateScore().
     */
    function _computeScore(address tokenAddr, IBondingCurveRE bc)
        internal
        view
        returns (uint256 score)
    {
        uint256 supply = bc.tokenSupply();

        // ── Fundraising (0–30) ──────────────────────────────────────────────
        uint256 threshold = bc.graduationThreshold();
        if (threshold > 0) {
            uint256 f = (bc.bnbRaised() * 30) / threshold;
            score += f > 30 ? 30 : f;
        }

        // ── Graduation (0–20) ───────────────────────────────────────────────
        if (bc.graduated()) score += 20;

        // ── Distribution (0–20) ────────────────────────────────────────────
        if (supply > 0) {
            uint256 d = (bc.tokensSold() * 20) / supply;
            score += d > 20 ? 20 : d;
        }

        // ── Burn Ratio (0–20) ───────────────────────────────────────────────
        if (buybackBurn != address(0) && supply > 0) {
            uint256 b = (IBuybackBurnRE(buybackBurn).totalBurned(tokenAddr) * 20) / supply;
            score += b > 20 ? 20 : b;
        }

        // ── Longevity (0–10) ────────────────────────────────────────────────
        if (block.timestamp >= _reputation[tokenAddr].launchTime + 7 days) {
            score += 10;
        }
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    /// @notice Set the BuybackBurn module address for burn data.
    function setBuybackBurn(address _buybackBurn) external onlyOwner {
        buybackBurn = _buybackBurn;
        emit BuybackBurnUpdated(_buybackBurn);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Returns the full ReputationData for a token.
    function getReputation(address tokenAddr) external view returns (ReputationData memory) {
        return _reputation[tokenAddr];
    }

    /// @notice Returns just the score for a token (0–100).
    function getScore(address tokenAddr) external view returns (uint256) {
        return _reputation[tokenAddr].score;
    }

    /// @notice All tokens that have been scored at least once.
    function getScoredTokens() external view returns (address[] memory) {
        return _scoredTokens;
    }

    /// @notice Total number of scored tokens.
    function scoredTokenCount() external view returns (uint256) {
        return _scoredTokens.length;
    }
}
