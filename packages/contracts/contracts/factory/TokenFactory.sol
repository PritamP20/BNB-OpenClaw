// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../tokens/NormalToken.sol";
import "../tokens/AgentToken.sol";
import "../tokens/SkillToken.sol";
import "../identity/AgentRegistry.sol";
import "../identity/NFAManager.sol";

/**
 * @title TokenFactory
 * @notice Single entry point for deploying all token types on AgentLaunch.
 *
 * Supported deployments:
 *   1. deployNormalToken  — standard ERC-20, no AI link required.
 *   2. deployAgentToken   — ERC-20 bound to an existing NFA (one per agent).
 *   3. deploySkillToken   — ERC-20 bound to an NFA + skill ID (many per agent).
 *
 * On every deployment the factory:
 *   - Collects an optional BNB launch fee, forwarded to `feeCollector`.
 *   - Records the new token in the relevant array for enumeration.
 *   - Writes to AgentRegistry (for agent/skill tokens) via FACTORY_ROLE.
 *   - Emits a deployment event.
 *
 * Access:
 *   - `onlyOwner` guards fee/collector configuration.
 *   - No special role is needed by callers — anyone can launch.
 */
contract TokenFactory is Ownable, ReentrancyGuard {
    // ─────────────────────────────────────────────
    // Immutable dependencies
    // ─────────────────────────────────────────────

    NFAManager public immutable nfaManager;
    AgentRegistry public immutable agentRegistry;

    // ─────────────────────────────────────────────
    // Mutable config
    // ─────────────────────────────────────────────

    /// @notice BNB fee charged per launch (can be 0).
    uint256 public launchFee;

    /// @notice Recipient of all launch fees.
    address public feeCollector;

    // ─────────────────────────────────────────────
    // Token registries (for enumeration)
    // ─────────────────────────────────────────────

    address[] public allNormalTokens;
    address[] public allAgentTokens;
    address[] public allSkillTokens;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event NormalTokenDeployed(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 maxSupply
    );

    event AgentTokenDeployed(
        address indexed token,
        uint256 indexed agentId,
        address indexed creator,
        string name,
        string symbol
    );

    event SkillTokenDeployed(
        address indexed token,
        uint256 indexed agentId,
        bytes32 indexed skillId,
        address creator,
        string name
    );

    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event FeesCollected(address indexed payer, uint256 amount);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    /**
     * @param _nfaManager      Address of the deployed NFAManager contract.
     * @param _agentRegistry   Address of the deployed AgentRegistry contract.
     * @param _launchFee       Initial BNB fee per launch (can be 0).
     * @param _feeCollector    Address to receive fees (falls back to deployer).
     */
    constructor(
        address _nfaManager,
        address _agentRegistry,
        uint256 _launchFee,
        address _feeCollector
    ) Ownable(msg.sender) {
        require(_nfaManager != address(0), "TokenFactory: zero nfaManager");
        require(_agentRegistry != address(0), "TokenFactory: zero agentRegistry");

        nfaManager = NFAManager(_nfaManager);
        agentRegistry = AgentRegistry(_agentRegistry);
        launchFee = _launchFee;
        feeCollector = _feeCollector != address(0) ? _feeCollector : msg.sender;
    }

    // ─────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────

    /**
     * @dev Collects the launch fee if set; excess BNB is refunded to the caller.
     */
    modifier collectFee() {
        if (launchFee > 0) {
            require(msg.value >= launchFee, "TokenFactory: insufficient launch fee");

            // Forward exact fee; refund any excess
            (bool sent, ) = feeCollector.call{value: launchFee}("");
            require(sent, "TokenFactory: fee transfer failed");

            uint256 excess = msg.value - launchFee;
            if (excess > 0) {
                (bool refunded, ) = msg.sender.call{value: excess}("");
                require(refunded, "TokenFactory: refund failed");
            }

            emit FeesCollected(msg.sender, launchFee);
        }
        _;
    }

    // ─────────────────────────────────────────────
    // Deploy: NormalToken
    // ─────────────────────────────────────────────

    /**
     * @notice Deploy a standard fungible token (no AI link).
     * @param name           Token name.
     * @param symbol         Token symbol.
     * @param initialSupply  Tokens minted to msg.sender at deploy.
     * @param maxSupply      Hard cap (0 = uncapped).
     * @return token  Address of the deployed NormalToken.
     */
    function deployNormalToken(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        uint256 maxSupply
    ) external payable nonReentrant collectFee returns (address token) {
        NormalToken newToken = new NormalToken(
            name,
            symbol,
            initialSupply,
            maxSupply,
            msg.sender
        );

        token = address(newToken);
        allNormalTokens.push(token);

        emit NormalTokenDeployed(token, msg.sender, name, symbol, initialSupply, maxSupply);
    }

    // ─────────────────────────────────────────────
    // Deploy: AgentToken
    // ─────────────────────────────────────────────

    /**
     * @notice Deploy the primary fungible token for an existing NFA.
     *         Requirements:
     *           - `agentId` must be a valid, active NFA.
     *           - Caller must be the NFA owner.
     *           - Agent must not already have a primary token registered.
     *
     * @param name           Token name.
     * @param symbol         Token symbol.
     * @param initialSupply  Tokens minted to msg.sender.
     * @param maxSupply      Hard cap (0 = uncapped).
     * @param agentId        NFA token ID to bind this token to.
     * @param treasury       Treasury address for growth modules (0 → caller).
     * @return token  Address of the deployed AgentToken.
     */
    function deployAgentToken(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        uint256 maxSupply,
        uint256 agentId,
        address treasury
    ) external payable nonReentrant collectFee returns (address token) {
        // Validate agent existence and state
        require(nfaManager.agentExists(agentId), "TokenFactory: agent does not exist");
        require(nfaManager.isActive(agentId), "TokenFactory: agent is not active");

        // Only the NFA owner may deploy its primary token
        require(
            nfaManager.ownerOf(agentId) == msg.sender,
            "TokenFactory: caller is not the agent owner"
        );

        // Enforce one-primary-token-per-agent
        require(
            !agentRegistry.hasAgentToken(agentId),
            "TokenFactory: agent already has a primary token"
        );

        AgentToken newToken = new AgentToken(
            name,
            symbol,
            initialSupply,
            maxSupply,
            agentId,
            msg.sender,
            treasury
        );

        token = address(newToken);
        allAgentTokens.push(token);

        // Register in AgentRegistry
        agentRegistry.registerAgent(agentId, token);

        emit AgentTokenDeployed(token, agentId, msg.sender, name, symbol);
    }

    // ─────────────────────────────────────────────
    // Deploy: SkillToken
    // ─────────────────────────────────────────────

    /**
     * @notice Deploy a skill token linked to an NFA.
     *         Any address can register a skill for any active agent.
     *         Multiple skills per agent are allowed.
     *
     * @param name           Skill token name.
     * @param symbol         Skill token symbol.
     * @param initialSupply  Tokens minted to msg.sender.
     * @param agentId        NFA token ID this skill belongs to.
     * @param skillId        bytes32 identifier for the skill type.
     * @param costPerUse     Tokens burned per consumeSkill call (0 = free).
     * @return token  Address of the deployed SkillToken.
     */
    function deploySkillToken(
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        uint256 agentId,
        bytes32 skillId,
        uint256 costPerUse
    ) external payable nonReentrant collectFee returns (address token) {
        require(nfaManager.agentExists(agentId), "TokenFactory: agent does not exist");
        require(nfaManager.isActive(agentId), "TokenFactory: agent is not active");
        require(skillId != bytes32(0), "TokenFactory: empty skillId");

        SkillToken newToken = new SkillToken(
            name,
            symbol,
            initialSupply,
            agentId,
            skillId,
            costPerUse,
            msg.sender
        );

        token = address(newToken);
        allSkillTokens.push(token);

        // Register in AgentRegistry
        agentRegistry.registerSkillToken(agentId, token);

        emit SkillTokenDeployed(token, agentId, skillId, msg.sender, name);
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    /// @notice Update the BNB launch fee.
    function setLaunchFee(uint256 newFee) external onlyOwner {
        emit LaunchFeeUpdated(launchFee, newFee);
        launchFee = newFee;
    }

    /// @notice Update the fee collector address.
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "TokenFactory: zero collector");
        emit FeeCollectorUpdated(feeCollector, newCollector);
        feeCollector = newCollector;
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /**
     * @notice Returns counts for all deployed token types.
     */
    function getTokenCounts()
        external
        view
        returns (
            uint256 normal,
            uint256 agent,
            uint256 skill
        )
    {
        return (allNormalTokens.length, allAgentTokens.length, allSkillTokens.length);
    }

    /// @notice Returns all deployed NormalToken addresses.
    function getAllNormalTokens() external view returns (address[] memory) {
        return allNormalTokens;
    }

    /// @notice Returns all deployed AgentToken addresses.
    function getAllAgentTokens() external view returns (address[] memory) {
        return allAgentTokens;
    }

    /// @notice Returns all deployed SkillToken addresses.
    function getAllSkillTokens() external view returns (address[] memory) {
        return allSkillTokens;
    }

    // ─────────────────────────────────────────────
    // Safety
    // ─────────────────────────────────────────────

    /// @notice Receive BNB (e.g. from excess refunds or direct sends).
    receive() external payable {}
}
