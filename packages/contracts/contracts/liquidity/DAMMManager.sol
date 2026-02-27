// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DAMMManager
 * @notice Dynamic AMM configuration layer for AgentLaunch.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PHASE 2 SCOPE — Configuration Only (no DEX integration yet)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This contract acts as a registry of per-token AMM parameters.
 * In Phase 3, these configs will be read by a DEX adapter (PancakeSwap V3 /
 * custom DAMM pool) to enforce dynamic fees, anti-whale rules, and curves.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIGURABLE PARAMETERS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  initialPrice         → Starting price in wei per token (token / BNB).
 *  feeTier              → Base swap fee in basis points (e.g. 30 = 0.3%).
 *  dynamicFeesEnabled   → Whether fees adjust based on volatility / volume.
 *  antiWhaleEnabled     → Whether per-tx buy/sell limits are enforced.
 *  maxBuyBps            → Max single buy as % of total supply (basis points).
 *  maxSellBps           → Max single sell as % of total supply (basis points).
 *  curveModel           → Bonding curve shape used for price discovery.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ACCESS CONTROL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Platform owner  → can configure/update any token's pool config.
 *  Token configurors → addresses explicitly granted CONFIGUROR_ROLE per token
 *                       (set by the owner; typically the token creator).
 */
contract DAMMManager is Ownable {
    // ─────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────

    /**
     * @notice Bonding curve model used for AMM price discovery.
     *
     * Linear       → price = k * supply (simple, predictable)
     * BondingCurve → price = k * supply² (rewards early buyers)
     * Exponential  → price = e^(k * supply) (aggressive growth curve)
     * Flat         → constant price (stable, no curve)
     */
    enum CurveModel {
        Linear,
        BondingCurve,
        Exponential,
        Flat
    }

    struct AMMConfig {
        /// Initial price in wei per token (e.g. 1e15 = 0.001 BNB per token).
        uint256 initialPrice;
        /// Base fee in basis points (max 1000 = 10%).
        uint256 feeTier;
        /// Dynamic fees adjust automatically based on market activity.
        bool dynamicFeesEnabled;
        /// Anti-whale: enforces maxBuyBps / maxSellBps per transaction.
        bool antiWhaleEnabled;
        /// Max single buy as % of total supply in basis points (0 = disabled).
        uint256 maxBuyBps;
        /// Max single sell as % of total supply in basis points (0 = disabled).
        uint256 maxSellBps;
        /// Bonding curve model for price discovery.
        CurveModel curveModel;
        /// Marks whether this token has ever been configured.
        bool configured;
    }

    // ─────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────

    /// @dev Maximum fee cap: 10% in basis points.
    uint256 public constant MAX_FEE_BPS = 1_000;

    /// @dev 100% in basis points.
    uint256 public constant MAX_BPS = 10_000;

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @dev token address → AMMConfig
    mapping(address => AMMConfig) private _configs;

    /// @dev token address → authorized configuror (besides owner)
    mapping(address => address) private _configurors;

    /// @dev All tokens that have been configured (for enumeration)
    address[] private _configuredTokens;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event PoolConfigured(
        address indexed token,
        address indexed configuror,
        uint256 initialPrice,
        uint256 feeTier,
        CurveModel curveModel
    );

    event FeeUpdated(address indexed token, uint256 oldFee, uint256 newFee);
    event AntiWhaleToggled(address indexed token, bool enabled, uint256 maxBuyBps, uint256 maxSellBps);
    event DynamicFeesToggled(address indexed token, bool enabled);
    event CurveModelUpdated(address indexed token, CurveModel newModel);
    event ConfiguratorSet(address indexed token, address indexed configurator);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────

    modifier onlyAuthorized(address token) {
        require(
            msg.sender == owner() || msg.sender == _configurors[token],
            "DAMMManager: not authorized"
        );
        _;
    }

    // ─────────────────────────────────────────────
    // Configuration
    // ─────────────────────────────────────────────

    /**
     * @notice Set the full AMM configuration for a token.
     *         Can only be called by the platform owner or the token's assigned configuror.
     *
     * @param token   The ERC-20 token to configure.
     * @param config  The AMM configuration to apply.
     */
    function configurePool(address token, AMMConfig calldata config)
        external
        onlyAuthorized(token)
    {
        require(token != address(0), "DAMMManager: zero token");
        require(config.feeTier <= MAX_FEE_BPS, "DAMMManager: fee exceeds 10%");

        if (config.antiWhaleEnabled) {
            require(config.maxBuyBps > 0 && config.maxBuyBps <= MAX_BPS, "DAMMManager: invalid maxBuyBps");
            require(config.maxSellBps > 0 && config.maxSellBps <= MAX_BPS, "DAMMManager: invalid maxSellBps");
        }

        bool isNew = !_configs[token].configured;

        _configs[token] = config;
        _configs[token].configured = true;

        if (isNew) {
            _configuredTokens.push(token);
        }

        emit PoolConfigured(token, msg.sender, config.initialPrice, config.feeTier, config.curveModel);
    }

    /**
     * @notice Update only the fee tier for a configured token.
     */
    function updateFee(address token, uint256 newFee)
        external
        onlyAuthorized(token)
    {
        require(_configs[token].configured, "DAMMManager: pool not configured");
        require(newFee <= MAX_FEE_BPS, "DAMMManager: fee exceeds 10%");

        emit FeeUpdated(token, _configs[token].feeTier, newFee);
        _configs[token].feeTier = newFee;
    }

    /**
     * @notice Toggle anti-whale protection and update the buy/sell caps.
     */
    function setAntiWhale(
        address token,
        bool enabled,
        uint256 maxBuyBps,
        uint256 maxSellBps
    ) external onlyAuthorized(token) {
        require(_configs[token].configured, "DAMMManager: pool not configured");
        if (enabled) {
            require(maxBuyBps > 0 && maxBuyBps <= MAX_BPS, "DAMMManager: invalid maxBuyBps");
            require(maxSellBps > 0 && maxSellBps <= MAX_BPS, "DAMMManager: invalid maxSellBps");
        }

        _configs[token].antiWhaleEnabled = enabled;
        _configs[token].maxBuyBps = maxBuyBps;
        _configs[token].maxSellBps = maxSellBps;

        emit AntiWhaleToggled(token, enabled, maxBuyBps, maxSellBps);
    }

    /**
     * @notice Toggle dynamic fees for a configured token.
     */
    function toggleDynamicFees(address token, bool enabled)
        external
        onlyAuthorized(token)
    {
        require(_configs[token].configured, "DAMMManager: pool not configured");
        _configs[token].dynamicFeesEnabled = enabled;
        emit DynamicFeesToggled(token, enabled);
    }

    /**
     * @notice Update the bonding curve model for a token.
     */
    function updateCurveModel(address token, CurveModel newModel)
        external
        onlyAuthorized(token)
    {
        require(_configs[token].configured, "DAMMManager: pool not configured");
        _configs[token].curveModel = newModel;
        emit CurveModelUpdated(token, newModel);
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    /**
     * @notice Assign a configuror for a specific token.
     *         Typically set to the token creator after they deploy via TokenFactory.
     * @param token        The token address.
     * @param configuror   Address authorized to manage this token's AMM config.
     */
    function setConfigurator(address token, address configuror)
        external
        onlyOwner
    {
        require(token != address(0), "DAMMManager: zero token");
        require(configuror != address(0), "DAMMManager: zero configuror");
        _configurors[token] = configuror;
        emit ConfiguratorSet(token, configuror);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Returns the full AMMConfig for a token.
    function getConfig(address token) external view returns (AMMConfig memory) {
        return _configs[token];
    }

    /// @notice Returns true if a token has been configured.
    function isConfigured(address token) external view returns (bool) {
        return _configs[token].configured;
    }

    /// @notice Returns the assigned configuror for a token (address(0) if none).
    function getConfigurator(address token) external view returns (address) {
        return _configurors[token];
    }

    /// @notice Returns all tokens that have been configured.
    function getAllConfiguredTokens() external view returns (address[] memory) {
        return _configuredTokens;
    }

    /// @notice Total number of tokens with AMM configs.
    function configuredTokenCount() external view returns (uint256) {
        return _configuredTokens.length;
    }
}