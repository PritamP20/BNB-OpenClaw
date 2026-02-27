// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NormalToken
 * @notice Standard ERC-20 fungible token for non-AI token launches.
 *
 * Features:
 *   - Optional supply cap (maxSupply = 0 means uncapped).
 *   - Owner-controlled minting up to the cap.
 *   - Burn by any holder via ERC20Burnable.
 *   - Immutable creator address for off-chain attribution.
 */
contract NormalToken is ERC20Burnable, Ownable {
    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// @notice Hard cap on total supply (0 = uncapped).
    uint256 public immutable maxSupply;

    /// @notice Address that launched this token via TokenFactory.
    address public immutable creator;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event TokensMinted(address indexed to, uint256 amount);

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    /**
     * @param name_          Token name (e.g. "My Token").
     * @param symbol_        Token symbol (e.g. "MTK").
     * @param initialSupply  Tokens minted to `creator_` at deploy.
     * @param maxSupply_     Hard cap (0 = uncapped).
     * @param creator_       The address that deployed this via TokenFactory.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        uint256 maxSupply_,
        address creator_
    ) ERC20(name_, symbol_) Ownable(creator_) {
        require(creator_ != address(0), "NormalToken: zero creator");
        require(
            maxSupply_ == 0 || initialSupply <= maxSupply_,
            "NormalToken: initial supply exceeds cap"
        );

        creator = creator_;
        maxSupply = maxSupply_;

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
     *         Only callable by the owner (creator by default).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (maxSupply > 0) {
            require(
                totalSupply() + amount <= maxSupply,
                "NormalToken: exceeds max supply cap"
            );
        }
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
}
