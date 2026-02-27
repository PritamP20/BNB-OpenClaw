// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NFAManager
 * @notice Non-Fungible Agent (NFA) registry — BAP-578 compatible.
 *
 * Each AI agent is represented as an ERC-721 token (an NFA) with:
 *   - A logic contract address (upgradeable by the owner)
 *   - A learningEnabled flag (opt-in learning module, off-chain)
 *   - A lifecycle state: Active | Paused | Terminated
 *   - Standard ERC-721 URI storage for on/off-chain metadata
 *
 * The platform owner can terminate any agent (circuit breaker).
 * The token holder controls pausing, resuming, and logic updates.
 */
contract NFAManager is ERC721URIStorage, Ownable {
    // ─────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────

    /// @notice Lifecycle state of an agent
    enum AgentState {
        Active,
        Paused,
        Terminated
    }

    /// @notice Core on-chain metadata stored per NFA
    struct AgentData {
        /// Address of the agent's logic/implementation contract
        address logicAddress;
        /// Whether the learning module is enabled (off-chain honoured)
        bool learningEnabled;
        /// Current lifecycle state
        AgentState state;
        /// Block timestamp at mint time
        uint256 createdAt;
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @dev Auto-incrementing token ID counter
    uint256 private _nextTokenId;

    /// @dev agentId → AgentData
    mapping(uint256 => AgentData) private _agentData;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event AgentMinted(
        uint256 indexed agentId,
        address indexed owner,
        address logicAddress,
        string metadataURI,
        bool learningEnabled
    );

    event AgentStateChanged(uint256 indexed agentId, AgentState newState);
    event AgentLogicUpdated(uint256 indexed agentId, address indexed newLogicAddress);
    event AgentLearningToggled(uint256 indexed agentId, bool enabled);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() ERC721("Non-Fungible Agent", "NFA") Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Minting
    // ─────────────────────────────────────────────

    /**
     * @notice Mint a new NFA to `to`.
     * @param to            Recipient address (agent owner).
     * @param logicAddress  Address of the agent's logic contract (can be address(0) if not yet set).
     * @param metadataURI   IPFS / HTTPS URI pointing to agent metadata JSON.
     * @param learningEnabled  Whether the agent opts into the learning module.
     * @return agentId  The newly minted token ID.
     */
    function mintAgent(
        address to,
        address logicAddress,
        string calldata metadataURI,
        bool learningEnabled
    ) external returns (uint256 agentId) {
        agentId = _nextTokenId++;

        _safeMint(to, agentId);
        _setTokenURI(agentId, metadataURI);

        _agentData[agentId] = AgentData({
            logicAddress: logicAddress,
            learningEnabled: learningEnabled,
            state: AgentState.Active,
            createdAt: block.timestamp
        });

        emit AgentMinted(agentId, to, logicAddress, metadataURI, learningEnabled);
    }

    // ─────────────────────────────────────────────
    // State Management
    // ─────────────────────────────────────────────

    /**
     * @notice Pause an active agent. Only the token holder or approved operator.
     */
    function pauseAgent(uint256 agentId) external {
        _requireAuthorized(agentId);
        require(
            _agentData[agentId].state == AgentState.Active,
            "NFAManager: agent not active"
        );
        _agentData[agentId].state = AgentState.Paused;
        emit AgentStateChanged(agentId, AgentState.Paused);
    }

    /**
     * @notice Resume a paused agent. Only the token holder or approved operator.
     */
    function resumeAgent(uint256 agentId) external {
        _requireAuthorized(agentId);
        require(
            _agentData[agentId].state == AgentState.Paused,
            "NFAManager: agent not paused"
        );
        _agentData[agentId].state = AgentState.Active;
        emit AgentStateChanged(agentId, AgentState.Active);
    }

    /**
     * @notice Permanently terminate an agent. Platform owner only (circuit breaker).
     *         Once terminated, state cannot be reversed.
     */
    function terminateAgent(uint256 agentId) external onlyOwner {
        require(agentExists(agentId), "NFAManager: agent does not exist");
        require(
            _agentData[agentId].state != AgentState.Terminated,
            "NFAManager: already terminated"
        );
        _agentData[agentId].state = AgentState.Terminated;
        emit AgentStateChanged(agentId, AgentState.Terminated);
    }

    // ─────────────────────────────────────────────
    // Agent Configuration
    // ─────────────────────────────────────────────

    /**
     * @notice Update the logic contract address for an agent.
     *         Only the token holder or approved operator.
     */
    function updateLogicAddress(uint256 agentId, address newLogicAddress) external {
        _requireAuthorized(agentId);
        require(newLogicAddress != address(0), "NFAManager: zero address");
        _agentData[agentId].logicAddress = newLogicAddress;
        emit AgentLogicUpdated(agentId, newLogicAddress);
    }

    /**
     * @notice Toggle the learning module on/off for an agent.
     *         Only the token holder or approved operator.
     */
    function toggleLearning(uint256 agentId, bool enabled) external {
        _requireAuthorized(agentId);
        _agentData[agentId].learningEnabled = enabled;
        emit AgentLearningToggled(agentId, enabled);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Returns the full AgentData struct for a given agentId.
    function getAgentData(uint256 agentId) external view returns (AgentData memory) {
        return _agentData[agentId];
    }

    /// @notice Returns true if the agent is in Active state.
    function isActive(uint256 agentId) external view returns (bool) {
        return _agentData[agentId].state == AgentState.Active;
    }

    /**
     * @notice Returns true if the NFA token has been minted.
     * @dev Uses internal `_ownerOf` which returns address(0) for unminted tokens
     *      (safe — does not revert like the public `ownerOf`).
     */
    function agentExists(uint256 agentId) public view returns (bool) {
        return _ownerOf(agentId) != address(0);
    }

    /// @notice Returns the total number of agents ever minted (not accounting for burns).
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    // ─────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────

    /**
     * @dev Reverts unless msg.sender is the token owner or an approved operator.
     */
    function _requireAuthorized(uint256 agentId) internal view {
        address owner = ownerOf(agentId); // reverts if not minted
        require(
            msg.sender == owner ||
                isApprovedForAll(owner, msg.sender) ||
                getApproved(agentId) == msg.sender,
            "NFAManager: caller not authorized"
        );
    }
}
