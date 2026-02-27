// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BondingCurve
 * @notice Per-token xy=k bonding curve for AgentLaunch — pump.fun style price discovery.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRICING MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  effectiveBNB = virtualBNB + bnbRaised          (BNB side of the virtual pool)
 *  tokensLeft   = tokenSupply - tokensSold        (token side of the virtual pool)
 *
 *  Constant product invariant: effectiveBNB × tokensLeft = k  (held approximately)
 *
 *  Buy formula:  tokenOut = tokensLeft × bnbIn  / (effectiveBNB + bnbIn)
 *  Sell formula: bnbOut   = effectiveBNB × tokenIn / (tokensLeft + tokenIn)
 *
 *  The virtual BNB reserve sets the initial price without requiring the creator
 *  to deposit real BNB upfront — identical to pump.fun's mechanism on Solana.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LIFECYCLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  1. Creator deploys BondingCurve, configures virtualBNB + graduationThreshold.
 *  2. Creator calls init(tokenAmount) — pulls tokens into the curve, opens trading.
 *  3. Users buy() or sell() until bnbRaised ≥ graduationThreshold.
 *  4. On graduation, trading stops. Owner calls withdrawForLiquidity() to seed DEX LP.
 *     (Phase 4: automated PancakeSwap LP creation via router integration.)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FEES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Platform fee (feeBps) deducted on every buy and sell, forwarded to feeRecipient.
 *  On buy:  fee = msg.value × feeBps / 10000, bnbIn = msg.value − fee
 *  On sell: fee = grossBNBOut × feeBps / 10000, sellerReceives = gross − fee
 */
contract BondingCurve is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────

    uint256 public constant MAX_FEE_BPS = 500; // 5% hard cap

    // ─────────────────────────────────────────────
    // Immutable config
    // ─────────────────────────────────────────────

    /// ERC-20 token being sold on this curve.
    address public immutable token;

    /// Virtual BNB reserve that sets initial price (never actually deposited).
    uint256 public immutable virtualBNB;

    /// BNB raised target — when reached the curve graduates and trading moves to DEX.
    uint256 public immutable graduationThreshold;

    /// Platform fee in basis points (e.g. 100 = 1%).
    uint256 public immutable feeBps;

    /// Recipient of all platform fees.
    address public immutable feeRecipient;

    // ─────────────────────────────────────────────
    // Mutable state
    // ─────────────────────────────────────────────

    /// Total tokens deposited into the curve for sale.
    uint256 public tokenSupply;

    /// Tokens sold to buyers so far.
    uint256 public tokensSold;

    /// Real BNB collected from buyers (net of fees). Equals address(this).balance.
    uint256 public bnbRaised;

    /// True once tokens have been deposited and trading is open.
    bool public initialized;

    /// True once bnbRaised ≥ graduationThreshold — trading moves to DEX.
    bool public graduated;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event CurveInitialized(address indexed token, uint256 tokenSupply, uint256 virtualBNB);

    event Buy(
        address indexed buyer,
        uint256 bnbPaid,
        uint256 bnbNet,
        uint256 tokensOut,
        uint256 fee,
        uint256 priceAfter
    );

    event Sell(
        address indexed seller,
        uint256 tokensIn,
        uint256 bnbGross,
        uint256 bnbNet,
        uint256 fee,
        uint256 priceAfter
    );

    event Graduated(address indexed token, uint256 bnbRaised, uint256 tokensRemaining);

    event LiquidityWithdrawn(address indexed recipient, uint256 bnbAmount, uint256 tokenAmount);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    /**
     * @param _token               ERC-20 token to sell on this curve.
     * @param _virtualBNB          Virtual BNB reserve for price initialisation (in wei).
     * @param _graduationThreshold BNB raised to trigger graduation (in wei).
     * @param _feeBps              Platform fee in basis points (max 500 = 5%).
     * @param _feeRecipient        Address receiving platform fees.
     * @param _owner               Owner of this curve (typically the token creator).
     */
    constructor(
        address _token,
        uint256 _virtualBNB,
        uint256 _graduationThreshold,
        uint256 _feeBps,
        address _feeRecipient,
        address _owner
    ) Ownable(_owner) {
        require(_token != address(0), "BondingCurve: zero token");
        require(_virtualBNB > 0, "BondingCurve: zero virtualBNB");
        require(_graduationThreshold > 0, "BondingCurve: zero graduation threshold");
        require(_feeBps <= MAX_FEE_BPS, "BondingCurve: fee exceeds 5%");
        require(_feeRecipient != address(0), "BondingCurve: zero fee recipient");

        token = _token;
        virtualBNB = _virtualBNB;
        graduationThreshold = _graduationThreshold;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    // ─────────────────────────────────────────────
    // Initialisation
    // ─────────────────────────────────────────────

    /**
     * @notice Deposit tokens into the curve and open trading.
     *         Caller must approve this contract to transfer `amount` tokens first.
     * @param amount  Total tokens available for sale on this curve.
     */
    function init(uint256 amount) external onlyOwner {
        require(!initialized, "BondingCurve: already initialized");
        require(amount > 0, "BondingCurve: zero amount");

        initialized = true;
        tokenSupply = amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit CurveInitialized(token, amount, virtualBNB);
    }

    // ─────────────────────────────────────────────
    // Trading
    // ─────────────────────────────────────────────

    /**
     * @notice Buy tokens by sending BNB.
     * @param minTokenOut  Minimum tokens to receive — reverts if slippage is too high.
     */
    function buy(uint256 minTokenOut) external payable nonReentrant {
        require(initialized, "BondingCurve: not initialized");
        require(!graduated, "BondingCurve: graduated -- trade on DEX");
        require(msg.value > 0, "BondingCurve: zero BNB sent");

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 bnbIn = msg.value - fee;

        uint256 tokensOut = _buyQuote(bnbIn);
        require(tokensOut > 0, "BondingCurve: zero token output");
        require(tokensOut >= minTokenOut, "BondingCurve: slippage exceeded");
        require(tokensOut <= _tokensLeft(), "BondingCurve: exceeds available supply");

        // State updates (CEI pattern)
        bnbRaised += bnbIn;
        tokensSold += tokensOut;

        // Transfers
        IERC20(token).safeTransfer(msg.sender, tokensOut);

        if (fee > 0) {
            (bool sent, ) = feeRecipient.call{value: fee}("");
            require(sent, "BondingCurve: fee transfer failed");
        }

        emit Buy(msg.sender, msg.value, bnbIn, tokensOut, fee, getPrice());

        // Graduation check
        if (bnbRaised >= graduationThreshold) {
            _graduate();
        }
    }

    /**
     * @notice Sell tokens back to the curve for BNB.
     *         Caller must approve this contract to transfer `tokenAmount` tokens first.
     * @param tokenAmount  Tokens to sell.
     * @param minBNBOut    Minimum BNB to receive (net of fee) — slippage protection.
     */
    function sell(uint256 tokenAmount, uint256 minBNBOut) external nonReentrant {
        require(initialized, "BondingCurve: not initialized");
        require(!graduated, "BondingCurve: graduated -- trade on DEX");
        require(tokenAmount > 0, "BondingCurve: zero token amount");

        uint256 bnbGross = _sellQuote(tokenAmount);
        require(bnbGross > 0, "BondingCurve: zero BNB output");
        require(bnbRaised >= bnbGross, "BondingCurve: insufficient BNB reserve");

        uint256 fee = (bnbGross * feeBps) / 10_000;
        uint256 bnbNet = bnbGross - fee;
        require(bnbNet >= minBNBOut, "BondingCurve: slippage exceeded");

        // State updates (CEI pattern)
        bnbRaised -= bnbGross;
        tokensSold -= tokenAmount;

        // Pull tokens from seller
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        // Send BNB to seller
        (bool sent, ) = msg.sender.call{value: bnbNet}("");
        require(sent, "BondingCurve: BNB transfer to seller failed");

        // Send fee
        if (fee > 0) {
            (bool feeSent, ) = feeRecipient.call{value: fee}("");
            require(feeSent, "BondingCurve: fee transfer failed");
        }

        emit Sell(msg.sender, tokenAmount, bnbGross, bnbNet, fee, getPrice());
    }

    // ─────────────────────────────────────────────
    // Post-Graduation
    // ─────────────────────────────────────────────

    /**
     * @notice Withdraw raised BNB and remaining tokens after graduation
     *         to create a DEX liquidity pool (Phase 4: PancakeSwap LP seeding).
     * @param recipient  Address to receive BNB + tokens.
     */
    function withdrawForLiquidity(address recipient) external onlyOwner nonReentrant {
        require(graduated, "BondingCurve: not graduated yet");
        require(recipient != address(0), "BondingCurve: zero recipient");

        uint256 bnbAmount = address(this).balance;
        uint256 tokenAmount = IERC20(token).balanceOf(address(this));

        if (tokenAmount > 0) {
            IERC20(token).safeTransfer(recipient, tokenAmount);
        }
        if (bnbAmount > 0) {
            (bool sent, ) = recipient.call{value: bnbAmount}("");
            require(sent, "BondingCurve: BNB withdrawal failed");
        }

        emit LiquidityWithdrawn(recipient, bnbAmount, tokenAmount);
    }

    // ─────────────────────────────────────────────
    // Price Views
    // ─────────────────────────────────────────────

    /**
     * @notice Current spot price — wei of BNB per 1 full token (scaled 1e18).
     *         price = effectiveBNB × 1e18 / tokensLeft
     */
    function getPrice() public view returns (uint256) {
        uint256 tLeft = _tokensLeft();
        if (tLeft == 0) return type(uint256).max;
        return (_effectiveBNB() * 1e18) / tLeft;
    }

    /**
     * @notice How many tokens you receive for `bnbIn` wei (inclusive of fee deduction).
     */
    function getBuyQuote(uint256 bnbIn) external view returns (uint256 tokenOut) {
        if (bnbIn == 0) return 0;
        uint256 fee = (bnbIn * feeBps) / 10_000;
        return _buyQuote(bnbIn - fee);
    }

    /**
     * @notice How much BNB (net of fee) you receive for selling `tokenAmount`.
     */
    function getSellQuote(uint256 tokenAmount) external view returns (uint256 bnbOut) {
        if (tokenAmount == 0) return 0;
        uint256 gross = _sellQuote(tokenAmount);
        uint256 fee = (gross * feeBps) / 10_000;
        return gross - fee;
    }

    /**
     * @notice Graduation progress as a percentage (0–100).
     */
    function graduationProgress() external view returns (uint256) {
        if (graduated) return 100;
        if (graduationThreshold == 0) return 100;
        uint256 pct = (bnbRaised * 100) / graduationThreshold;
        return pct > 100 ? 100 : pct;
    }

    /// @notice Tokens still available for purchase on this curve.
    function tokensLeft() external view returns (uint256) {
        return _tokensLeft();
    }

    // ─────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────

    function _effectiveBNB() internal view returns (uint256) {
        return virtualBNB + bnbRaised;
    }

    function _tokensLeft() internal view returns (uint256) {
        return tokenSupply - tokensSold;
    }

    /// @dev tokenOut = tokensLeft × bnbIn / (effectiveBNB + bnbIn)
    function _buyQuote(uint256 bnbIn) internal view returns (uint256) {
        uint256 effective = _effectiveBNB();
        uint256 tLeft = _tokensLeft();
        if (tLeft == 0 || bnbIn == 0) return 0;
        return (tLeft * bnbIn) / (effective + bnbIn);
    }

    /// @dev bnbOut = effectiveBNB × tokenIn / (tokensLeft + tokenIn)
    function _sellQuote(uint256 tokenIn) internal view returns (uint256) {
        uint256 effective = _effectiveBNB();
        uint256 tLeft = _tokensLeft();
        if (effective == 0 || tokenIn == 0) return 0;
        return (effective * tokenIn) / (tLeft + tokenIn);
    }

    function _graduate() internal {
        graduated = true;
        emit Graduated(token, bnbRaised, _tokensLeft());
    }

    // ─────────────────────────────────────────────
    // Receive (for direct BNB transfers if needed)
    // ─────────────────────────────────────────────

    receive() external payable {}
}
