// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./NFAManager.sol";

/**
 * @title AgentRegistry
 * @notice On-chain directory that maps each NFA agent to its deployed tokens.
 *
 * Responsibilities:
 *   - Store the primary AgentToken address per agent (one per agent, set once).
 *   - Store an array of SkillToken addresses per agent (many allowed).
 *   - Expose read helpers for the frontend and other contracts.
 *
 * Access control:
 *   - DEFAULT_ADMIN_ROLE  → deployer / multisig
 *   - FACTORY_ROLE        → TokenFactory (granted post-deploy)
 *
 * Only the TokenFactory may write to this registry, ensuring that only
 * properly validated tokens are registered.
 */
contract AgentRegistry is AccessControl {
    // ─────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────

    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    // ─────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────

    struct AgentRecord {
        /// Primary fungible token for this agent (set once via registerAgent)
        address agentToken;
        /// Skill tokens registered to this agent
        address[] skillTokens;
        /// Whether this agent has been registered
        bool exists;
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @notice Reference to the NFA manager for existence checks
    NFAManager public immutable nfaManager;

    /// @dev agentId → AgentRecord
    mapping(uint256 => AgentRecord) private _registry;

    /// @dev Ordered list of all registered agent IDs (for enumeration)
    uint256[] private _registeredAgents;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event AgentRegistered(uint256 indexed agentId, address indexed agentToken);
    event SkillTokenRegistered(uint256 indexed agentId, address indexed skillToken, uint256 skillIndex);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor(address _nfaManager) {
        require(_nfaManager != address(0), "AgentRegistry: zero address");
        nfaManager = NFAManager(_nfaManager);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────
    // Write — restricted to FACTORY_ROLE
    // ─────────────────────────────────────────────

    /**
     * @notice Register an agent with its primary AgentToken.
     *         Called by TokenFactory when deployAgentToken succeeds.
     * @param agentId    The NFA token ID.
     * @param agentToken Address of the newly deployed AgentToken contract.
     */
    function registerAgent(uint256 agentId, address agentToken)
        external
        onlyRole(FACTORY_ROLE)
    {
        require(!_registry[agentId].exists, "AgentRegistry: already registered");
        require(agentToken != address(0), "AgentRegistry: zero address");

        _registry[agentId].agentToken = agentToken;
        _registry[agentId].exists = true;
        _registeredAgents.push(agentId);

        emit AgentRegistered(agentId, agentToken);
    }

    /**
     * @notice Register a SkillToken under an existing agent.
     *         Called by TokenFactory when deploySkillToken succeeds.
     *         An agent does NOT need a primary AgentToken before registering skills.
     * @param agentId    The NFA token ID.
     * @param skillToken Address of the newly deployed SkillToken contract.
     */
    function registerSkillToken(uint256 agentId, address skillToken)
        external
        onlyRole(FACTORY_ROLE)
    {
        require(nfaManager.agentExists(agentId), "AgentRegistry: agent does not exist");
        require(skillToken != address(0), "AgentRegistry: zero address");

        uint256 skillIndex = _registry[agentId].skillTokens.length;
        _registry[agentId].skillTokens.push(skillToken);

        // Ensure the agent appears in the global list even if only skills are registered
        if (!_registry[agentId].exists) {
            _registry[agentId].exists = true;
            _registeredAgents.push(agentId);
        }

        emit SkillTokenRegistered(agentId, skillToken, skillIndex);
    }

    // ─────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────

    /**
     * @notice Grant FACTORY_ROLE to the TokenFactory contract.
     *         Must be called by the admin after deploying TokenFactory.
     */
    function grantFactoryRole(address factory) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(factory != address(0), "AgentRegistry: zero address");
        _grantRole(FACTORY_ROLE, factory);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /**
     * @notice Returns the primary AgentToken address and all SkillToken addresses for an agent.
     */
    function getAgentRecord(uint256 agentId)
        external
        view
        returns (address agentToken, address[] memory skillTokens)
    {
        AgentRecord storage record = _registry[agentId];
        return (record.agentToken, record.skillTokens);
    }

    /// @notice Returns true if the agent has been registered (has at least a token or skill).
    function isRegistered(uint256 agentId) external view returns (bool) {
        return _registry[agentId].exists;
    }

    /// @notice Returns true if the agent has a primary AgentToken registered.
    function hasAgentToken(uint256 agentId) external view returns (bool) {
        return _registry[agentId].agentToken != address(0);
    }

    /// @notice Returns the number of skill tokens registered for an agent.
    function skillTokenCount(uint256 agentId) external view returns (uint256) {
        return _registry[agentId].skillTokens.length;
    }

    /// @notice Returns all registered agent IDs (for off-chain enumeration).
    function getAllAgentIds() external view returns (uint256[] memory) {
        return _registeredAgents;
    }

    /// @notice Total number of registered agents.
    function registeredAgentCount() external view returns (uint256) {
        return _registeredAgents.length;
    }
}
