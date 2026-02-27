// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentToken
 * @notice Primary fungible token for an AI Agent, linked to its NFA token ID.
 *
 * Features:
 *   - Immutable agentId — permanently linked to one NFA.
 *   - Optional supply cap (maxSupply = 0 means uncapped).
 *   - Owner-controlled minting.
 *   - Burnable by any holder.
 *   - Treasury address for buyback and growth modules (Phase 3).
 *
 * One AgentToken per NFA is enforced at the TokenFactory level.
 */
contract AgentToken is ERC20Burnable, Ownable {
    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @notice The NFA agent ID this token is bound to.
    uint256 public immutable agentId;

    /// @notice Hard cap on total supply (0 = uncapped).
    uint256 public immutable maxSupply;

    /// @notice Address that created this token via TokenFactory.
    address public immutable creator;

    /// @notice Treasury address — used by growth modules in later phases.
    address public treasury;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event TokensMinted(address indexed to, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    /**
     * @param name_          Token name.
     * @param symbol_        Token symbol.
     * @param initialSupply  Tokens minted to `creator_` at deploy.
     * @param maxSupply_     Hard cap (0 = uncapped).
     * @param agentId_       NFA token ID this AgentToken is linked to.
     * @param creator_       The NFA owner who deployed this via TokenFactory.
     * @param treasury_      Treasury address (falls back to creator_ if zero).
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        uint256 maxSupply_,
        uint256 agentId_,
        address creator_,
        address treasury_
    ) ERC20(name_, symbol_) Ownable(creator_) {
        require(creator_ != address(0), "AgentToken: zero creator");
        require(
            maxSupply_ == 0 || initialSupply <= maxSupply_,
            "AgentToken: initial supply exceeds cap"
        );

        agentId = agentId_;
        maxSupply = maxSupply_;
        creator = creator_;
        treasury = treasury_ != address(0) ? treasury_ : creator_;

        if (initialSupply > 0) {
            _mint(creator_, initialSupply);
            emit TokensMinted(creator_, initialSupply);
        }
    }

    // ─────────────────────────────────────────────
    // Owner Actions
    // ─────────────────────────────────────────────

    /**
     * @notice Mint additional tokens to `to`. Respects maxSupply cap.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (maxSupply > 0) {
            require(
                totalSupply() + amount <= maxSupply,
                "AgentToken: exceeds max supply cap"
            );
        }
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Update the treasury address.
     *         Treasury is used in Phase 3 buyback/burn modules.
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "AgentToken: zero treasury address");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }
}
