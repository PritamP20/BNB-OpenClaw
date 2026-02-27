// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PLUVault
 * @notice Progressive Liquidity Unlock — holds ERC-20 tokens and releases them
 *         in scheduled tranches as unlock conditions are met.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNLOCK CONDITIONS (Phase 2 implements Time; others are scaffolded for Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Time          → unlocks after `releaseTime` (enforced here).
 *  Volume        → unlocks after cumulative trading volume reaches a threshold
 *                  (Phase 3 — requires oracle / DEX integration).
 *  HolderCount   → unlocks after holder count reaches a threshold
 *                  (Phase 3 — requires off-chain snapshot or oracle).
 *  AgentActivity → unlocks after agent interaction count reaches a threshold
 *                  (Phase 3 — requires AgentRegistry / interaction indexer).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VAULT LIFECYCLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  createVault()  — caller deposits tokens; tranche schedule is recorded.
 *  release()      — anyone calls for a specific tranche; conditions checked.
 *  releaseAll()   — convenience: iterates and releases all eligible tranches.
 *  cancelVault()  — vault creator can cancel and reclaim unreleased tokens
 *                   (only if no tranches have been released yet — prevents
 *                    rug-pull after partial unlock).
 *
 * Tranche basisPoints must sum to exactly 10 000 (= 100%).
 */
contract PLUVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────

    /// @notice The condition that must be satisfied before a tranche unlocks.
    enum ConditionType {
        Time,           // Unlock after `releaseTime`            (enforced now)
        Volume,         // Cumulative DEX volume milestone        (Phase 3)
        HolderCount,    // Token holder count milestone           (Phase 3)
        AgentActivity   // Agent interaction count milestone      (Phase 3)
    }

    struct Tranche {
        /// Unix timestamp — used for Time condition; 0 = immediate for other types.
        uint256 releaseTime;
        /// Share of total vault in basis points (1 bp = 0.01%; sum must equal 10 000).
        uint256 basisPoints;
        /// Condition type governing this tranche.
        ConditionType condition;
        /// Milestone value for non-time conditions (e.g. volume in wei, holder count).
        uint256 conditionValue;
        /// True once this tranche has been released.
        bool released;
    }

    struct Vault {
        /// ERC-20 token being locked.
        address token;
        /// Address that receives unlocked tokens.
        address beneficiary;
        /// Address that created the vault (can cancel before any release).
        address creator;
        /// Total tokens deposited into this vault.
        uint256 totalDeposited;
        /// Running total of tokens released so far.
        uint256 totalReleased;
        /// Whether the vault is still active.
        bool active;
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    uint256 private _nextVaultId;

    /// @dev vaultId → Vault metadata
    mapping(uint256 => Vault) private _vaults;

    /// @dev vaultId → array of Tranches
    mapping(uint256 => Tranche[]) private _tranches;

    /// @dev token address → list of vault IDs
    mapping(address => uint256[]) private _tokenVaults;

    /// @dev beneficiary → list of vault IDs
    mapping(address => uint256[]) private _beneficiaryVaults;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event VaultCreated(
        uint256 indexed vaultId,
        address indexed token,
        address indexed beneficiary,
        address creator,
        uint256 totalDeposited,
        uint256 trancheCount
    );

    event TrancheReleased(
        uint256 indexed vaultId,
        uint256 indexed trancheIndex,
        address indexed beneficiary,
        uint256 amountReleased
    );

    event VaultCancelled(
        uint256 indexed vaultId,
        address indexed creator,
        uint256 amountReclaimed
    );

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    // Vault Creation
    // ─────────────────────────────────────────────

    /**
     * @notice Create a new progressive liquidity vault.
     *
     * @param token        ERC-20 token to lock (caller must approve this contract first).
     * @param beneficiary  Address that will receive each unlocked tranche.
     * @param amount       Total tokens to lock (must equal sum released across all tranches).
     * @param tranches_    Array of Tranche structs defining the unlock schedule.
     *                     - basisPoints across all tranches MUST sum to 10 000.
     *                     - For Time condition, releaseTime must be in the future.
     * @return vaultId     ID of the newly created vault.
     */
    function createVault(
        address token,
        address beneficiary,
        uint256 amount,
        Tranche[] calldata tranches_
    ) external nonReentrant returns (uint256 vaultId) {
        require(token != address(0), "PLUVault: zero token");
        require(beneficiary != address(0), "PLUVault: zero beneficiary");
        require(amount > 0, "PLUVault: zero amount");
        require(tranches_.length > 0, "PLUVault: no tranches");
        require(tranches_.length <= 50, "PLUVault: too many tranches");

        // Validate tranche basisPoints sum exactly 10 000
        uint256 totalBps;
        for (uint256 i = 0; i < tranches_.length; i++) {
            require(tranches_[i].basisPoints > 0, "PLUVault: zero basisPoints in tranche");
            totalBps += tranches_[i].basisPoints;

            // For Time condition enforce releaseTime is in the future
            if (tranches_[i].condition == ConditionType.Time) {
                require(
                    tranches_[i].releaseTime > block.timestamp,
                    "PLUVault: release time must be in the future"
                );
            }
        }
        require(totalBps == 10_000, "PLUVault: tranche basisPoints must sum to 10000");

        vaultId = _nextVaultId++;

        _vaults[vaultId] = Vault({
            token: token,
            beneficiary: beneficiary,
            creator: msg.sender,
            totalDeposited: amount,
            totalReleased: 0,
            active: true
        });

        // Store tranches individually (memory→storage array)
        for (uint256 i = 0; i < tranches_.length; i++) {
            _tranches[vaultId].push(tranches_[i]);
        }

        _tokenVaults[token].push(vaultId);
        _beneficiaryVaults[beneficiary].push(vaultId);

        // Pull tokens from caller
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit VaultCreated(vaultId, token, beneficiary, msg.sender, amount, tranches_.length);
    }

    // ─────────────────────────────────────────────
    // Release Logic
    // ─────────────────────────────────────────────

    /**
     * @notice Release a specific tranche of a vault.
     *         Anyone can call this — the tokens always go to the vault's beneficiary.
     *
     * @param vaultId       The vault to release from.
     * @param trancheIndex  Which tranche to release (0-indexed).
     */
    function release(uint256 vaultId, uint256 trancheIndex) external nonReentrant {
        Vault storage vault = _vaults[vaultId];
        require(vault.active, "PLUVault: vault not active");
        require(trancheIndex < _tranches[vaultId].length, "PLUVault: invalid tranche index");

        Tranche storage tranche = _tranches[vaultId][trancheIndex];
        require(!tranche.released, "PLUVault: tranche already released");

        // ── Condition check ────────────────────────────────────────────────
        require(
            _conditionMet(tranche),
            "PLUVault: unlock condition not met"
        );

        // ── Calculate amount ───────────────────────────────────────────────
        uint256 amount = (vault.totalDeposited * tranche.basisPoints) / 10_000;

        // Guard against rounding: last tranche releases whatever remains
        uint256 remaining = vault.totalDeposited - vault.totalReleased;
        if (amount > remaining) {
            amount = remaining;
        }

        tranche.released = true;
        vault.totalReleased += amount;

        IERC20(vault.token).safeTransfer(vault.beneficiary, amount);

        emit TrancheReleased(vaultId, trancheIndex, vault.beneficiary, amount);
    }

    /**
     * @notice Release all tranches whose conditions are currently met.
     *         Skips already-released tranches and unmet conditions silently.
     */
    function releaseAll(uint256 vaultId) external nonReentrant {
        Vault storage vault = _vaults[vaultId];
        require(vault.active, "PLUVault: vault not active");

        uint256 length = _tranches[vaultId].length;

        for (uint256 i = 0; i < length; i++) {
            Tranche storage tranche = _tranches[vaultId][i];

            if (tranche.released) continue;
            if (!_conditionMet(tranche)) continue;

            uint256 amount = (vault.totalDeposited * tranche.basisPoints) / 10_000;
            uint256 remaining = vault.totalDeposited - vault.totalReleased;
            if (amount > remaining) amount = remaining;
            if (amount == 0) continue;

            tranche.released = true;
            vault.totalReleased += amount;

            IERC20(vault.token).safeTransfer(vault.beneficiary, amount);

            emit TrancheReleased(vaultId, i, vault.beneficiary, amount);
        }
    }

    // ─────────────────────────────────────────────
    // Cancellation
    // ─────────────────────────────────────────────

    /**
     * @notice Cancel a vault and reclaim all unreleased tokens.
     *         Can only be called by the vault creator, and only if
     *         no tranches have been released yet (prevents partial rug).
     */
    function cancelVault(uint256 vaultId) external nonReentrant {
        Vault storage vault = _vaults[vaultId];
        require(vault.active, "PLUVault: vault not active");
        require(vault.creator == msg.sender, "PLUVault: not vault creator");
        require(vault.totalReleased == 0, "PLUVault: cannot cancel after partial release");

        vault.active = false;
        uint256 reclaim = vault.totalDeposited;

        IERC20(vault.token).safeTransfer(msg.sender, reclaim);

        emit VaultCancelled(vaultId, msg.sender, reclaim);
    }

    // ─────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────

    /// @notice Returns vault metadata.
    function getVault(uint256 vaultId) external view returns (Vault memory) {
        return _vaults[vaultId];
    }

    /// @notice Returns all tranches for a vault.
    function getTranches(uint256 vaultId) external view returns (Tranche[] memory) {
        return _tranches[vaultId];
    }

    /// @notice Returns a single tranche.
    function getTranche(uint256 vaultId, uint256 trancheIndex)
        external
        view
        returns (Tranche memory)
    {
        return _tranches[vaultId][trancheIndex];
    }

    /// @notice Returns true if the specified tranche's condition is currently met.
    function isConditionMet(uint256 vaultId, uint256 trancheIndex)
        external
        view
        returns (bool)
    {
        require(trancheIndex < _tranches[vaultId].length, "PLUVault: invalid index");
        return _conditionMet(_tranches[vaultId][trancheIndex]);
    }

    /// @notice Returns all vault IDs associated with a given token.
    function getVaultsByToken(address token) external view returns (uint256[] memory) {
        return _tokenVaults[token];
    }

    /// @notice Returns all vault IDs for a given beneficiary.
    function getVaultsByBeneficiary(address beneficiary)
        external
        view
        returns (uint256[] memory)
    {
        return _beneficiaryVaults[beneficiary];
    }

    /// @notice Total number of vaults ever created.
    function totalVaults() external view returns (uint256) {
        return _nextVaultId;
    }

    // ─────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────

    /**
     * @dev Evaluates whether a tranche's unlock condition is satisfied.
     *      Time: enforced on-chain via block.timestamp.
     *      Others: always return true here (Phase 3 will add oracle checks).
     */
    function _conditionMet(Tranche storage tranche) internal view returns (bool) {
        if (tranche.condition == ConditionType.Time) {
            return block.timestamp >= tranche.releaseTime;
        }

        // Volume / HolderCount / AgentActivity:
        // Phase 3 — oracle or DEX integration required.
        // For now, these conditions are ALWAYS considered met so vaults
        // using them can be tested end-to-end without external deps.
        // TODO Phase 3: integrate oracle for Volume, HolderCount, AgentActivity.
        return true;
    }
}
