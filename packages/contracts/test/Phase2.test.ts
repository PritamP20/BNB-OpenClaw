import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  PLUVault,
  DAMMManager,
  NormalToken,
} from "../typechain-types";

describe("AgentLaunch — Phase 2 (Liquidity Infrastructure)", function () {
  // ─── Signers ────────────────────────────────────────────────
  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let beneficiary: SignerWithAddress;
  let other: SignerWithAddress;

  // ─── Contracts ──────────────────────────────────────────────
  let pluVault: PLUVault;
  let dammManager: DAMMManager;
  let token: NormalToken;

  // ─── Constants ──────────────────────────────────────────────
  const MILLION = ethers.parseEther("1000000");
  const HALF_MIL = ethers.parseEther("500000");
  const ONE_DAY = 86_400;
  const ONE_WEEK = ONE_DAY * 7;
  const ONE_MONTH = ONE_DAY * 30;

  // ─── Helpers ────────────────────────────────────────────────

  /** Build a simple 4-tranche time-based schedule summing to 10 000 bps */
  async function buildTimeSchedule(startOffset = ONE_DAY) {
    const now = await time.latest();
    return [
      {
        releaseTime: now + startOffset,
        basisPoints: 2_500, // 25%
        condition: 0,        // Time
        conditionValue: 0,
        released: false,
      },
      {
        releaseTime: now + startOffset + ONE_WEEK,
        basisPoints: 2_500, // 25%
        condition: 0,
        conditionValue: 0,
        released: false,
      },
      {
        releaseTime: now + startOffset + ONE_MONTH,
        basisPoints: 2_500, // 25%
        condition: 0,
        conditionValue: 0,
        released: false,
      },
      {
        releaseTime: now + startOffset + ONE_MONTH * 2,
        basisPoints: 2_500, // 25%
        condition: 0,
        conditionValue: 0,
        released: false,
      },
    ];
  }

  // ─── Setup ──────────────────────────────────────────────────
  beforeEach(async function () {
    [deployer, creator, beneficiary, other] = await ethers.getSigners();

    // Deploy a NormalToken as the "locked" token
    const TokenFactory = await ethers.getContractFactory("NormalToken");
    token = (await TokenFactory.deploy(
      "Launch Token",
      "LTK",
      MILLION,
      0,
      creator.address
    )) as NormalToken;

    // Deploy PLUVault
    const PLUVaultFactory = await ethers.getContractFactory("PLUVault");
    pluVault = (await PLUVaultFactory.deploy()) as PLUVault;

    // Deploy DAMMManager
    const DAMMManagerFactory = await ethers.getContractFactory("DAMMManager");
    dammManager = (await DAMMManagerFactory.deploy()) as DAMMManager;

    // Approve vault to pull tokens from creator
    await token.connect(creator).approve(await pluVault.getAddress(), MILLION);
  });

  // ─────────────────────────────────────────────────────────────
  // PLUVault — Vault Creation
  // ─────────────────────────────────────────────────────────────

  describe("PLUVault — vault creation", function () {
    it("creates a vault and pulls tokens from creator", async function () {
      const schedule = await buildTimeSchedule();
      const lockAmount = HALF_MIL;

      const tx = await pluVault
        .connect(creator)
        .createVault(await token.getAddress(), beneficiary.address, lockAmount, schedule);

      await expect(tx)
        .to.emit(pluVault, "VaultCreated")
        .withArgs(0, await token.getAddress(), beneficiary.address, creator.address, lockAmount, 4);

      // Tokens moved from creator to vault
      expect(await token.balanceOf(await pluVault.getAddress())).to.equal(lockAmount);
      expect(await token.balanceOf(creator.address)).to.equal(MILLION - lockAmount);

      const vault = await pluVault.getVault(0);
      expect(vault.token).to.equal(await token.getAddress());
      expect(vault.beneficiary).to.equal(beneficiary.address);
      expect(vault.totalDeposited).to.equal(lockAmount);
      expect(vault.totalReleased).to.equal(0);
      expect(vault.active).to.be.true;
    });

    it("reverts if basisPoints do not sum to 10 000", async function () {
      const badSchedule = [
        { releaseTime: (await time.latest()) + ONE_DAY, basisPoints: 3_000, condition: 0, conditionValue: 0, released: false },
        { releaseTime: (await time.latest()) + ONE_WEEK, basisPoints: 3_000, condition: 0, conditionValue: 0, released: false },
      ];

      await expect(
        pluVault
          .connect(creator)
          .createVault(await token.getAddress(), beneficiary.address, HALF_MIL, badSchedule)
      ).to.be.revertedWith("PLUVault: tranche basisPoints must sum to 10000");
    });

    it("reverts if releaseTime is in the past for Time condition", async function () {
      const pastSchedule = [
        { releaseTime: 1, basisPoints: 10_000, condition: 0, conditionValue: 0, released: false },
      ];

      await expect(
        pluVault
          .connect(creator)
          .createVault(await token.getAddress(), beneficiary.address, HALF_MIL, pastSchedule)
      ).to.be.revertedWith("PLUVault: release time must be in the future");
    });

    it("reverts with zero amount", async function () {
      const schedule = await buildTimeSchedule();
      await expect(
        pluVault.connect(creator).createVault(await token.getAddress(), beneficiary.address, 0, schedule)
      ).to.be.revertedWith("PLUVault: zero amount");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PLUVault — Tranche Release
  // ─────────────────────────────────────────────────────────────

  describe("PLUVault — tranche release", function () {
    let vaultId: bigint;
    const lockAmount = HALF_MIL;

    beforeEach(async function () {
      const schedule = await buildTimeSchedule(ONE_DAY);
      await pluVault
        .connect(creator)
        .createVault(await token.getAddress(), beneficiary.address, lockAmount, schedule);
      vaultId = 0n;
    });

    it("releases tranche 0 after releaseTime", async function () {
      // Fast-forward 1 day + 1 second
      await time.increase(ONE_DAY + 1);

      const trancheAmount = lockAmount / 4n; // 25%

      await expect(pluVault.connect(other).release(vaultId, 0))
        .to.emit(pluVault, "TrancheReleased")
        .withArgs(vaultId, 0, beneficiary.address, trancheAmount);

      expect(await token.balanceOf(beneficiary.address)).to.equal(trancheAmount);

      const tranche = await pluVault.getTranche(vaultId, 0);
      expect(tranche.released).to.be.true;
    });

    it("reverts if time condition not yet met", async function () {
      // No time travel — still in lockup
      await expect(pluVault.release(vaultId, 0)).to.be.revertedWith(
        "PLUVault: unlock condition not met"
      );
    });

    it("reverts if tranche already released", async function () {
      await time.increase(ONE_DAY + 1);
      await pluVault.release(vaultId, 0);

      await expect(pluVault.release(vaultId, 0)).to.be.revertedWith(
        "PLUVault: tranche already released"
      );
    });

    it("releaseAll releases multiple eligible tranches at once", async function () {
      // Jump past first two tranches
      await time.increase(ONE_DAY + ONE_WEEK + 1);

      await pluVault.connect(other).releaseAll(vaultId);

      // 25% + 25% = 50% released
      expect(await token.balanceOf(beneficiary.address)).to.equal(lockAmount / 2n);

      const t0 = await pluVault.getTranche(vaultId, 0);
      const t1 = await pluVault.getTranche(vaultId, 1);
      const t2 = await pluVault.getTranche(vaultId, 2);
      expect(t0.released).to.be.true;
      expect(t1.released).to.be.true;
      expect(t2.released).to.be.false; // not yet
    });

    it("isConditionMet returns correct values before and after time passes", async function () {
      expect(await pluVault.isConditionMet(vaultId, 0)).to.be.false;
      await time.increase(ONE_DAY + 1);
      expect(await pluVault.isConditionMet(vaultId, 0)).to.be.true;
    });

    it("full lifecycle: all 4 tranches released", async function () {
      await time.increase(ONE_DAY + ONE_MONTH * 2 + ONE_WEEK + 1);
      await pluVault.releaseAll(vaultId);

      expect(await token.balanceOf(beneficiary.address)).to.equal(lockAmount);
      expect(await token.balanceOf(await pluVault.getAddress())).to.equal(0);

      const vault = await pluVault.getVault(vaultId);
      expect(vault.totalReleased).to.equal(lockAmount);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PLUVault — Cancellation
  // ─────────────────────────────────────────────────────────────

  describe("PLUVault — cancellation", function () {
    it("creator can cancel vault before any release and reclaim tokens", async function () {
      const schedule = await buildTimeSchedule();
      await pluVault
        .connect(creator)
        .createVault(await token.getAddress(), beneficiary.address, HALF_MIL, schedule);

      const balanceBefore = await token.balanceOf(creator.address);

      await expect(pluVault.connect(creator).cancelVault(0))
        .to.emit(pluVault, "VaultCancelled")
        .withArgs(0, creator.address, HALF_MIL);

      expect(await token.balanceOf(creator.address)).to.equal(balanceBefore + HALF_MIL);

      const vault = await pluVault.getVault(0);
      expect(vault.active).to.be.false;
    });

    it("reverts if non-creator tries to cancel", async function () {
      const schedule = await buildTimeSchedule();
      await pluVault
        .connect(creator)
        .createVault(await token.getAddress(), beneficiary.address, HALF_MIL, schedule);

      await expect(pluVault.connect(other).cancelVault(0)).to.be.revertedWith(
        "PLUVault: not vault creator"
      );
    });

    it("cannot cancel after a tranche has been released", async function () {
      const schedule = await buildTimeSchedule(ONE_DAY);
      await pluVault
        .connect(creator)
        .createVault(await token.getAddress(), beneficiary.address, HALF_MIL, schedule);

      await time.increase(ONE_DAY + 1);
      await pluVault.release(0, 0);

      await expect(pluVault.connect(creator).cancelVault(0)).to.be.revertedWith(
        "PLUVault: cannot cancel after partial release"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PLUVault — Enumeration
  // ─────────────────────────────────────────────────────────────

  describe("PLUVault — enumeration", function () {
    it("tracks vaults by token and beneficiary", async function () {
      const schedule = await buildTimeSchedule();
      await pluVault
        .connect(creator)
        .createVault(await token.getAddress(), beneficiary.address, HALF_MIL, schedule);

      const byToken = await pluVault.getVaultsByToken(await token.getAddress());
      expect(byToken.length).to.equal(1);
      expect(byToken[0]).to.equal(0n);

      const byBeneficiary = await pluVault.getVaultsByBeneficiary(beneficiary.address);
      expect(byBeneficiary.length).to.equal(1);
    });

    it("totalVaults increments per creation", async function () {
      const schedule = await buildTimeSchedule();
      expect(await pluVault.totalVaults()).to.equal(0);
      await pluVault.connect(creator).createVault(await token.getAddress(), beneficiary.address, HALF_MIL / 2n, schedule);

      // Approve and create second vault
      await pluVault.connect(creator).createVault(await token.getAddress(), other.address, HALF_MIL / 2n, schedule);
      expect(await pluVault.totalVaults()).to.equal(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DAMMManager — Pool Configuration
  // ─────────────────────────────────────────────────────────────

  describe("DAMMManager — pool configuration", function () {
    const tokenAddr = () => token.getAddress();

    const baseConfig = () => ({
      initialPrice: ethers.parseEther("0.001"),
      feeTier: 30,            // 0.3%
      dynamicFeesEnabled: false,
      antiWhaleEnabled: true,
      maxBuyBps: 200,         // 2%
      maxSellBps: 100,        // 1%
      curveModel: 1,          // BondingCurve
      configured: false,
    });

    it("platform owner can configure a pool", async function () {
      const cfg = baseConfig();
      await expect(dammManager.connect(deployer).configurePool(await tokenAddr(), cfg))
        .to.emit(dammManager, "PoolConfigured");

      expect(await dammManager.isConfigured(await tokenAddr())).to.be.true;

      const stored = await dammManager.getConfig(await tokenAddr());
      expect(stored.feeTier).to.equal(30);
      expect(stored.antiWhaleEnabled).to.be.true;
      expect(stored.curveModel).to.equal(1);
    });

    it("assigned configuror can configure their token's pool", async function () {
      await dammManager.connect(deployer).setConfigurator(await tokenAddr(), creator.address);
      await expect(
        dammManager.connect(creator).configurePool(await tokenAddr(), baseConfig())
      ).to.emit(dammManager, "PoolConfigured");
    });

    it("unauthorized address cannot configure a pool", async function () {
      await expect(
        dammManager.connect(other).configurePool(await tokenAddr(), baseConfig())
      ).to.be.revertedWith("DAMMManager: not authorized");
    });

    it("rejects fee tier over 10%", async function () {
      const badConfig = { ...baseConfig(), feeTier: 1_001 };
      await expect(
        dammManager.connect(deployer).configurePool(await tokenAddr(), badConfig)
      ).to.be.revertedWith("DAMMManager: fee exceeds 10%");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DAMMManager — Param Updates
  // ─────────────────────────────────────────────────────────────

  describe("DAMMManager — parameter updates", function () {
    beforeEach(async function () {
      await dammManager.connect(deployer).configurePool(await token.getAddress(), {
        initialPrice: ethers.parseEther("0.001"),
        feeTier: 30,
        dynamicFeesEnabled: false,
        antiWhaleEnabled: false,
        maxBuyBps: 0,
        maxSellBps: 0,
        curveModel: 0,
        configured: false,
      });
    });

    it("owner can update fee", async function () {
      await expect(dammManager.updateFee(await token.getAddress(), 50))
        .to.emit(dammManager, "FeeUpdated")
        .withArgs(await token.getAddress(), 30, 50);

      const cfg = await dammManager.getConfig(await token.getAddress());
      expect(cfg.feeTier).to.equal(50);
    });

    it("owner can enable anti-whale", async function () {
      await expect(
        dammManager.setAntiWhale(await token.getAddress(), true, 300, 150)
      )
        .to.emit(dammManager, "AntiWhaleToggled")
        .withArgs(await token.getAddress(), true, 300, 150);

      const cfg = await dammManager.getConfig(await token.getAddress());
      expect(cfg.antiWhaleEnabled).to.be.true;
      expect(cfg.maxBuyBps).to.equal(300);
    });

    it("owner can toggle dynamic fees", async function () {
      await expect(dammManager.toggleDynamicFees(await token.getAddress(), true))
        .to.emit(dammManager, "DynamicFeesToggled")
        .withArgs(await token.getAddress(), true);
    });

    it("owner can update curve model", async function () {
      await expect(dammManager.updateCurveModel(await token.getAddress(), 2)) // Exponential
        .to.emit(dammManager, "CurveModelUpdated")
        .withArgs(await token.getAddress(), 2);
    });

    it("reverts update on unconfigured token", async function () {
      await expect(
        dammManager.updateFee(other.address, 50)
      ).to.be.revertedWith("DAMMManager: pool not configured");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DAMMManager — Enumeration
  // ─────────────────────────────────────────────────────────────

  describe("DAMMManager — enumeration", function () {
    it("tracks all configured tokens", async function () {
      expect(await dammManager.configuredTokenCount()).to.equal(0);

      await dammManager.configurePool(await token.getAddress(), {
        initialPrice: ethers.parseEther("0.001"),
        feeTier: 30,
        dynamicFeesEnabled: false,
        antiWhaleEnabled: false,
        maxBuyBps: 0,
        maxSellBps: 0,
        curveModel: 0,
        configured: false,
      });

      expect(await dammManager.configuredTokenCount()).to.equal(1);
      const tokens = await dammManager.getAllConfiguredTokens();
      expect(tokens[0]).to.equal(await token.getAddress());
    });
  });
});
