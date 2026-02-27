// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title BuybackBurn
 * @notice Treasury-funded buyback and burn module for AgentLaunch tokens.
 *
 * Anyone can fund this contract by sending BNB directly (receive()).
 * The owner (platform or token DAO) triggers buyback operations.
 *
 * Two execution modes:
 *
 *   executeBuyback(curve, bnbAmount, minTokens)
 *     → buys tokens from a BondingCurve, burns them immediately.
 *
 *   burnTokens(token, amount)
 *     → burns ERC-20Burnable tokens already held by this contract
 *       (for post-graduation buybacks from DEX — Phase 4).
 *
 * Stats:
 *   totalBurned[token]     — cumulative tokens burned per token address.
 *   totalBNBSpent[token]   — cumulative BNB spent on buybacks per token.
 */
/// @dev Minimal BondingCurve interface (avoids circular imports)
interface IBondingCurveBB {
    function token() external view returns (address);
    function buy(uint256 minTokenOut) external payable;
    function graduated() external view returns (bool);
}

contract BuybackBurn is Ownable, ReentrancyGuard {
    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @notice Cumulative tokens burned per token address.
    mapping(address => uint256) public totalBurned;

    /// @notice Cumulative BNB spent on buybacks per token address.
    mapping(address => uint256) public totalBNBSpent;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event BuybackExecuted(
        address indexed token,
        address indexed curve,
        uint256 bnbSpent,
        uint256 tokensBurned
    );

    event TokensBurned(address indexed token, uint256 amount);

    event FundsReceived(address indexed sender, uint256 amount);
    event FundsWithdrawn(address indexed recipient, uint256 amount);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Buyback
    // ─────────────────────────────────────────────

    /**
     * @notice Buy tokens from a BondingCurve using treasury BNB, then burn them.
     *
     * @param curve        Address of the BondingCurve for the target token.
     * @param bnbAmount    BNB to spend on the buyback (must ≤ contract BNB balance).
     * @param minTokens    Minimum tokens to receive (slippage protection).
     */
    function executeBuyback(
        address curve,
        uint256 bnbAmount,
        uint256 minTokens
    ) external onlyOwner nonReentrant {
        require(curve != address(0), "BuybackBurn: zero curve");
        require(bnbAmount > 0, "BuybackBurn: zero BNB amount");
        require(address(this).balance >= bnbAmount, "BuybackBurn: insufficient balance");

        address tokenAddr = IBondingCurveBB(curve).token();
        require(tokenAddr != address(0), "BuybackBurn: invalid curve token");

        // Record pre-balance so we know exactly how many tokens were received
        uint256 balanceBefore = IERC20(tokenAddr).balanceOf(address(this));

        // Buy tokens from the bonding curve
        IBondingCurveBB(curve).buy{value: bnbAmount}(minTokens);

        uint256 received = IERC20(tokenAddr).balanceOf(address(this)) - balanceBefore;
        require(received > 0, "BuybackBurn: no tokens received");

        // Burn all received tokens
        ERC20Burnable(tokenAddr).burn(received);

        totalBurned[tokenAddr] += received;
        totalBNBSpent[tokenAddr] += bnbAmount;

        emit BuybackExecuted(tokenAddr, curve, bnbAmount, received);
    }

    /**
     * @notice Burn ERC-20Burnable tokens already held by this contract.
     *         Used post-graduation when tokens are bought from a DEX externally
     *         and sent here for burning (Phase 4 flow).
     *
     * @param tokenAddr  Address of the ERC-20Burnable token to burn.
     * @param amount     Amount to burn (0 = burn entire balance).
     */
    function burnTokens(address tokenAddr, uint256 amount) external onlyOwner {
        require(tokenAddr != address(0), "BuybackBurn: zero token");

        uint256 balance = IERC20(tokenAddr).balanceOf(address(this));
        uint256 burnAmount = amount == 0 ? balance : amount;
        require(burnAmount > 0, "BuybackBurn: zero burn amount");
        require(balance >= burnAmount, "BuybackBurn: insufficient token balance");

        ERC20Burnable(tokenAddr).burn(burnAmount);

        totalBurned[tokenAddr] += burnAmount;

        emit TokensBurned(tokenAddr, burnAmount);
    }

    // ─────────────────────────────────────────────
    // Funding
    // ─────────────────────────────────────────────

    /**
     * @notice Withdraw BNB from the contract treasury.
     *         Only the owner can withdraw — prevents unauthorised drains.
     */
    function withdrawBNB(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "BuybackBurn: zero recipient");
        require(amount <= address(this).balance, "BuybackBurn: insufficient balance");
        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "BuybackBurn: BNB transfer failed");
        emit FundsWithdrawn(recipient, amount);
    }

    /// @notice Accept BNB treasury funding.
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }
}
