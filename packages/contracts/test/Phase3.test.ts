import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BondingCurve,
  BuybackBurn,
  ReputationEngine,
  IncentiveEngine,
  NormalToken,
} from "../typechain-types";

// ─── Tiny Merkle tree helper (no external lib needed for tests) ────────────────
function buildMerkleTree(leaves: { address: string; amount: bigint }[]) {
  // leaf = keccak256(abi.encodePacked(address, amount))
  const leafHashes = leaves.map((l) =>
    ethers.solidityPackedKeccak256(["address", "uint256"], [l.address, l.amount])
  );

  // Single-level tree (works for ≤2 leaves in tests)
  const getRoot = (hashes: string[]): string => {
    if (hashes.length === 1) return hashes[0];
    const pairs: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = i + 1 < hashes.length ? hashes[i + 1] : hashes[i];
      // Sort for determinism
      const sorted = [left, right].sort();
      pairs.push(ethers.solidityPackedKeccak256(["bytes32", "bytes32"], sorted));
    }
    return getRoot(pairs);
  };

  const getProof = (hashes: string[], index: number): string[] => {
    if (hashes.length === 1) return [];
    const pairs: string[] = [];
    const siblings: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = i + 1 < hashes.length ? hashes[i + 1] : hashes[i];
      if (i === index || i + 1 === index) {
        siblings.push(i === index ? right : left);
      }
      const sorted = [left, right].sort();
      pairs.push(ethers.solidityPackedKeccak256(["bytes32", "bytes32"], sorted));
    }
    return [...siblings, ...getProof(pairs, Math.floor(index / 2))];
  };

  return {
    root: getRoot(leafHashes),
    getProof: (index: number) => getProof(leafHashes, index),
    leafHashes,
  };
}

describe("AgentLaunch — Phase 3 (Bonding Curve + Growth Tools)", function () {
  // ─── Signers ────────────────────────────────────────────────
  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  // ─── Constants ──────────────────────────────────────────────
  const TOKEN_SUPPLY = ethers.parseEther("800000000"); // 800M tokens
  const VIRTUAL_BNB = ethers.parseEther("30");         // 30 BNB virtual reserve
  const GRAD_THRESHOLD = ethers.parseEther("85");      // 85 BNB to graduate
  const FEE_BPS = 100n;                                // 1% fee

  // ─── Contracts ──────────────────────────────────────────────
  let token: NormalToken;
  let curve: BondingCurve;
  let buybackBurn: BuybackBurn;
  let reputationEngine: ReputationEngine;
  let incentiveEngine: IncentiveEngine;

  // ─── Setup ──────────────────────────────────────────────────
  beforeEach(async function () {
    [deployer, creator, alice, bob, feeRecipient] = await ethers.getSigners();

    // Deploy token
    const TokenF = await ethers.getContractFactory("NormalToken");
    token = (await TokenF.deploy("Meme Token", "MEME", TOKEN_SUPPLY, 0, creator.address)) as NormalToken;

    // Deploy BondingCurve
    const CurveF = await ethers.getContractFactory("BondingCurve");
    curve = (await CurveF.deploy(
      await token.getAddress(),
      VIRTUAL_BNB,
      GRAD_THRESHOLD,
      FEE_BPS,
      feeRecipient.address,
      creator.address
    )) as BondingCurve;

    // Deploy growth contracts
    const BBF = await ethers.getContractFactory("BuybackBurn");
    buybackBurn = (await BBF.deploy()) as BuybackBurn;

    const REF = await ethers.getContractFactory("ReputationEngine");
    reputationEngine = (await REF.deploy()) as ReputationEngine;
    await reputationEngine.setBuybackBurn(await buybackBurn.getAddress());

    const IEF = await ethers.getContractFactory("IncentiveEngine");
    incentiveEngine = (await IEF.deploy()) as IncentiveEngine;

    // Init curve: creator approves + deposits all tokens
    await token.connect(creator).approve(await curve.getAddress(), TOKEN_SUPPLY);
    await curve.connect(creator).init(TOKEN_SUPPLY);
  });

  // ─────────────────────────────────────────────────────────────
  // BondingCurve — Initialisation
  // ─────────────────────────────────────────────────────────────

  describe("BondingCurve — initialisation", function () {
    it("holds the full token supply after init", async function () {
      expect(await token.balanceOf(await curve.getAddress())).to.equal(TOKEN_SUPPLY);
      expect(await curve.initialized()).to.be.true;
      expect(await curve.graduated()).to.be.false;
    });

    it("cannot init twice", async function () {
      const TokenF = await ethers.getContractFactory("NormalToken");
      const t2 = await TokenF.deploy("T2", "T2", TOKEN_SUPPLY, 0, creator.address);
      const CurveF = await ethers.getContractFactory("BondingCurve");
      const c2 = await CurveF.deploy(
        await t2.getAddress(), VIRTUAL_BNB, GRAD_THRESHOLD, FEE_BPS, feeRecipient.address, creator.address
      );
      await t2.connect(creator).approve(await c2.getAddress(), TOKEN_SUPPLY);
      await c2.connect(creator).init(TOKEN_SUPPLY);

      await expect(c2.connect(creator).init(TOKEN_SUPPLY)).to.be.revertedWith(
        "BondingCurve: already initialized"
      );
    });

    it("initial price is virtualBNB / tokenSupply", async function () {
      // price = effectiveBNB * 1e18 / tokensLeft = 30e18 * 1e18 / 800e24
      const expected = (VIRTUAL_BNB * ethers.parseEther("1")) / TOKEN_SUPPLY;
      expect(await curve.getPrice()).to.equal(expected);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // BondingCurve — Buy
  // ─────────────────────────────────────────────────────────────

  describe("BondingCurve — buy", function () {
    it("buyer receives tokens and fee goes to feeRecipient", async function () {
      const bnbIn = ethers.parseEther("1");
      const fee = (bnbIn * FEE_BPS) / 10_000n;
      const bnbNet = bnbIn - fee;

      const expectedOut = (TOKEN_SUPPLY * bnbNet) / (VIRTUAL_BNB + bnbNet);
      const feeBalBefore = await ethers.provider.getBalance(feeRecipient.address);

      const tx = await curve.connect(alice).buy(0, { value: bnbIn });
      await expect(tx).to.emit(curve, "Buy");

      const tokenBal = await token.balanceOf(alice.address);
      expect(tokenBal).to.be.closeTo(expectedOut, ethers.parseEther("1")); // ±1 token rounding

      const feeBalAfter = await ethers.provider.getBalance(feeRecipient.address);
      expect(feeBalAfter - feeBalBefore).to.equal(fee);

      expect(await curve.bnbRaised()).to.equal(bnbNet);
    });

    it("price increases after a buy", async function () {
      const priceBefore = await curve.getPrice();
      await curve.connect(alice).buy(0, { value: ethers.parseEther("5") });
      const priceAfter = await curve.getPrice();
      expect(priceAfter).to.be.gt(priceBefore);
    });

    it("reverts on slippage: minTokenOut not met", async function () {
      const quote = await curve.getBuyQuote(ethers.parseEther("1"));
      await expect(
        curve.connect(alice).buy(quote * 2n, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("BondingCurve: slippage exceeded");
    });

    it("reverts if curve not initialized", async function () {
      const CurveF = await ethers.getContractFactory("BondingCurve");
      const freshCurve = await CurveF.deploy(
        await token.getAddress(), VIRTUAL_BNB, GRAD_THRESHOLD, FEE_BPS, feeRecipient.address, creator.address
      );
      await expect(
        freshCurve.connect(alice).buy(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("BondingCurve: not initialized");
    });

    it("getBuyQuote matches actual output (approx)", async function () {
      const bnbIn = ethers.parseEther("2");
      const quoted = await curve.getBuyQuote(bnbIn);

      const balBefore = await token.balanceOf(alice.address);
      await curve.connect(alice).buy(0, { value: bnbIn });
      const balAfter = await token.balanceOf(alice.address);

      const actual = balAfter - balBefore;
      // Allow 1 token unit rounding difference
      expect(actual).to.be.closeTo(quoted, 1n);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // BondingCurve — Sell
  // ─────────────────────────────────────────────────────────────

  describe("BondingCurve — sell", function () {
    beforeEach(async function () {
      // Alice buys some tokens first
      await curve.connect(alice).buy(0, { value: ethers.parseEther("5") });
    });

    it("seller receives BNB and fee goes to feeRecipient", async function () {
      const tokensBal = await token.balanceOf(alice.address);
      const sellAmount = tokensBal / 2n;

      const quoted = await curve.getSellQuote(sellAmount);
      expect(quoted).to.be.gt(0);

      await token.connect(alice).approve(await curve.getAddress(), sellAmount);

      const bnbBefore = await ethers.provider.getBalance(alice.address);
      const feeBefore = await ethers.provider.getBalance(feeRecipient.address);

      const tx = await curve.connect(alice).sell(sellAmount, 0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const bnbAfter = await ethers.provider.getBalance(alice.address);
      const feeAfter = await ethers.provider.getBalance(feeRecipient.address);

      // Net received ≈ quoted (within 1 wei rounding)
      expect(bnbAfter - bnbBefore + gasUsed).to.be.closeTo(quoted, ethers.parseEther("0.001"));

      // Fee increased
      expect(feeAfter).to.be.gt(feeBefore);
    });

    it("price decreases after a sell", async function () {
      const priceBefore = await curve.getPrice();
      const tokens = await token.balanceOf(alice.address);
      await token.connect(alice).approve(await curve.getAddress(), tokens);
      await curve.connect(alice).sell(tokens, 0);
      const priceAfter = await curve.getPrice();
      expect(priceAfter).to.be.lt(priceBefore);
    });

    it("reverts on slippage: minBNBOut not met", async function () {
      const tokens = await token.balanceOf(alice.address);
      await token.connect(alice).approve(await curve.getAddress(), tokens);
      await expect(
        curve.connect(alice).sell(tokens, ethers.parseEther("1000"))
      ).to.be.revertedWith("BondingCurve: slippage exceeded");
    });

    it("xy=k reversibility: buy then sell same amount returns ≈ original BNB (minus fees)", async function () {
      const bnbIn = ethers.parseEther("1");
      const fee1 = (bnbIn * FEE_BPS) / 10_000n;

      const balBefore = await token.balanceOf(alice.address);
      await curve.connect(alice).buy(0, { value: bnbIn });
      const received = (await token.balanceOf(alice.address)) - balBefore;

      const grossSell = await curve.getSellQuote(received);
      // Gross + fee reconstruction: grossSell already accounts for fee deduction
      // So what we get back ≈ (bnbIn - buyFee) - sellFee
      const expectedNet = bnbIn - fee1 - ((bnbIn - fee1) * FEE_BPS) / 10_000n;
      expect(grossSell).to.be.closeTo(expectedNet, ethers.parseEther("0.01"));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // BondingCurve — Graduation
  // ─────────────────────────────────────────────────────────────

  describe("BondingCurve — graduation", function () {
    it("graduates when bnbRaised reaches threshold", async function () {
      // Buy enough to surpass 85 BNB threshold
      // Each buy with large BNB; we need net raised to reach threshold
      const bigBuy = GRAD_THRESHOLD * 2n;
      await expect(curve.connect(alice).buy(0, { value: bigBuy }))
        .to.emit(curve, "Graduated");

      expect(await curve.graduated()).to.be.true;
    });

    it("rejects buy and sell after graduation", async function () {
      await curve.connect(alice).buy(0, { value: GRAD_THRESHOLD * 2n });
      expect(await curve.graduated()).to.be.true;

      await expect(
        curve.connect(bob).buy(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("BondingCurve: graduated -- trade on DEX");
    });

    it("owner can withdraw BNB + tokens after graduation", async function () {
      await curve.connect(alice).buy(0, { value: GRAD_THRESHOLD * 2n });

      const bnbBefore = await ethers.provider.getBalance(bob.address);
      const tokensBefore = await token.balanceOf(bob.address);

      await curve.connect(creator).withdrawForLiquidity(bob.address);

      expect(await ethers.provider.getBalance(bob.address)).to.be.gt(bnbBefore);
      expect(await token.balanceOf(bob.address)).to.be.gt(tokensBefore);
    });

    it("graduationProgress returns 100 after graduating", async function () {
      await curve.connect(alice).buy(0, { value: GRAD_THRESHOLD * 2n });
      expect(await curve.graduationProgress()).to.equal(100);
    });

    it("graduationProgress is proportional before graduating", async function () {
      const spend = (GRAD_THRESHOLD / 2n) * 2n; // ~half threshold net of fee
      await curve.connect(alice).buy(0, { value: spend });
      const progress = await curve.graduationProgress();
      expect(progress).to.be.gt(0);
      expect(progress).to.be.lte(100);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // BuybackBurn
  // ─────────────────────────────────────────────────────────────

  describe("BuybackBurn", function () {
    beforeEach(async function () {
      // Fund the BuybackBurn contract with 2 BNB treasury
      await deployer.sendTransaction({
        to: await buybackBurn.getAddress(),
        value: ethers.parseEther("2"),
      });
    });

    it("buys tokens from bonding curve and burns them", async function () {
      const bnbSpend = ethers.parseEther("1");
      const totalSupplyBefore = await token.totalSupply();

      await expect(
        buybackBurn.connect(deployer).executeBuyback(await curve.getAddress(), bnbSpend, 0)
      ).to.emit(buybackBurn, "BuybackExecuted");

      // Total supply decreased (tokens were burned)
      expect(await token.totalSupply()).to.be.lt(totalSupplyBefore);

      // totalBurned tracked
      const burned = await buybackBurn.totalBurned(await token.getAddress());
      expect(burned).to.be.gt(0);
    });

    it("tracks totalBNBSpent per token", async function () {
      await buybackBurn.executeBuyback(await curve.getAddress(), ethers.parseEther("1"), 0);
      expect(await buybackBurn.totalBNBSpent(await token.getAddress())).to.equal(ethers.parseEther("1"));
    });

    it("owner can withdraw excess BNB", async function () {
      const before = await ethers.provider.getBalance(creator.address);
      await buybackBurn.withdrawBNB(creator.address, ethers.parseEther("1"));
      expect(await ethers.provider.getBalance(creator.address)).to.be.gt(before);
    });

    it("reverts if insufficient treasury balance", async function () {
      await expect(
        buybackBurn.executeBuyback(await curve.getAddress(), ethers.parseEther("100"), 0)
      ).to.be.revertedWith("BuybackBurn: insufficient balance");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ReputationEngine
  // ─────────────────────────────────────────────────────────────

  describe("ReputationEngine", function () {
    it("scores a token at 0 with no activity", async function () {
      await reputationEngine.updateScore(await curve.getAddress());
      const score = await reputationEngine.getScore(await token.getAddress());
      // No buys, no graduation, no burns, just launched → 0 pts
      expect(score).to.equal(0);
    });

    it("score increases after buys", async function () {
      await curve.connect(alice).buy(0, { value: ethers.parseEther("10") });
      await reputationEngine.updateScore(await curve.getAddress());
      const score = await reputationEngine.getScore(await token.getAddress());
      expect(score).to.be.gt(0);
    });

    it("score jumps to max fundraising + graduation after graduating", async function () {
      await curve.connect(alice).buy(0, { value: GRAD_THRESHOLD * 2n });
      await reputationEngine.updateScore(await curve.getAddress());

      const score = await reputationEngine.getScore(await token.getAddress());
      // fundraising = 30, graduation = 20 = 50 minimum
      expect(score).to.be.gte(50);
    });

    it("burn ratio contributes to score", async function () {
      await curve.connect(alice).buy(0, { value: ethers.parseEther("10") });
      await reputationEngine.updateScore(await curve.getAddress());
      const scoreBefore = await reputationEngine.getScore(await token.getAddress());

      // Fund and execute buyback
      await deployer.sendTransaction({
        to: await buybackBurn.getAddress(),
        value: ethers.parseEther("2"),
      });
      await buybackBurn.executeBuyback(await curve.getAddress(), ethers.parseEther("1"), 0);

      await reputationEngine.updateScore(await curve.getAddress());
      const scoreAfter = await reputationEngine.getScore(await token.getAddress());

      expect(scoreAfter).to.be.gt(scoreBefore);
    });

    it("longevity score kicks in after 7 days", async function () {
      await curve.connect(alice).buy(0, { value: ethers.parseEther("10") });
      await reputationEngine.updateScore(await curve.getAddress());
      const scoreBefore = await reputationEngine.getScore(await token.getAddress());

      // Fast-forward 8 days
      await time.increase(8 * 86400);
      await reputationEngine.updateScore(await curve.getAddress());
      const scoreAfter = await reputationEngine.getScore(await token.getAddress());

      expect(scoreAfter - scoreBefore).to.equal(10n);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // IncentiveEngine — Referrals
  // ─────────────────────────────────────────────────────────────

  describe("IncentiveEngine — referrals", function () {
    it("registers a referral and increments count", async function () {
      await expect(incentiveEngine.connect(alice).registerReferral(creator.address))
        .to.emit(incentiveEngine, "ReferralRegistered")
        .withArgs(alice.address, creator.address);

      expect(await incentiveEngine.referralCount(creator.address)).to.equal(1);
      expect(await incentiveEngine.getReferrer(alice.address)).to.equal(creator.address);
      expect(await incentiveEngine.hasReferral(alice.address)).to.be.true;
    });

    it("cannot register referral twice", async function () {
      await incentiveEngine.connect(alice).registerReferral(creator.address);
      await expect(
        incentiveEngine.connect(alice).registerReferral(bob.address)
      ).to.be.revertedWith("IncentiveEngine: already registered");
    });

    it("cannot self-refer", async function () {
      await expect(
        incentiveEngine.connect(alice).registerReferral(alice.address)
      ).to.be.revertedWith("IncentiveEngine: self-referral not allowed");
    });

    it("multiple users can be referred by same referrer", async function () {
      await incentiveEngine.connect(alice).registerReferral(creator.address);
      await incentiveEngine.connect(bob).registerReferral(creator.address);
      expect(await incentiveEngine.referralCount(creator.address)).to.equal(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // IncentiveEngine — Airdrops
  // ─────────────────────────────────────────────────────────────

  describe("IncentiveEngine — airdrops", function () {
    const AIRDROP_AMOUNT = ethers.parseEther("1000");
    const ALICE_ALLOC = ethers.parseEther("600");
    const BOB_ALLOC = ethers.parseEther("400");
    let campaignId: bigint;
    let tree: ReturnType<typeof buildMerkleTree>;
    let deadline: number;

    beforeEach(async function () {
      // Build Merkle tree with alice + bob allocations
      tree = buildMerkleTree([
        { address: alice.address, amount: ALICE_ALLOC },
        { address: bob.address, amount: BOB_ALLOC },
      ]);

      deadline = (await time.latest()) + 7 * 86400; // 7 days

      // Mint extra tokens to creator for airdrop (all tokens were deposited to curve in outer beforeEach)
      await token.connect(creator).mint(creator.address, AIRDROP_AMOUNT);

      // Creator approves and creates campaign
      await token.connect(creator).approve(await incentiveEngine.getAddress(), AIRDROP_AMOUNT);
      const tx = await incentiveEngine
        .connect(creator)
        .createAirdrop(await token.getAddress(), tree.root, AIRDROP_AMOUNT, deadline);

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log) => {
        try {
          return incentiveEngine.interface.parseLog(log)?.name === "AirdropCreated";
        } catch {
          return false;
        }
      });
      campaignId = incentiveEngine.interface.parseLog(event!)?.args.campaignId;
    });

    it("creates campaign and pulls tokens from creator", async function () {
      const campaign = await incentiveEngine.getCampaign(campaignId);
      expect(campaign.totalAmount).to.equal(AIRDROP_AMOUNT);
      expect(campaign.merkleRoot).to.equal(tree.root);
      expect(await token.balanceOf(await incentiveEngine.getAddress())).to.equal(AIRDROP_AMOUNT);
    });

    it("alice claims her allocation with valid proof", async function () {
      const proof = tree.getProof(0); // index 0 = alice

      await expect(
        incentiveEngine.connect(alice).claimAirdrop(campaignId, ALICE_ALLOC, proof)
      )
        .to.emit(incentiveEngine, "AirdropClaimed")
        .withArgs(campaignId, alice.address, ALICE_ALLOC);

      expect(await token.balanceOf(alice.address)).to.equal(ALICE_ALLOC);
      expect(await incentiveEngine.hasClaimed(campaignId, alice.address)).to.be.true;
    });

    it("bob claims his allocation independently", async function () {
      const proof = tree.getProof(1); // index 1 = bob
      await incentiveEngine.connect(bob).claimAirdrop(campaignId, BOB_ALLOC, proof);
      expect(await token.balanceOf(bob.address)).to.equal(BOB_ALLOC);
    });

    it("cannot claim twice", async function () {
      const proof = tree.getProof(0);
      await incentiveEngine.connect(alice).claimAirdrop(campaignId, ALICE_ALLOC, proof);
      await expect(
        incentiveEngine.connect(alice).claimAirdrop(campaignId, ALICE_ALLOC, proof)
      ).to.be.revertedWith("IncentiveEngine: already claimed");
    });

    it("rejects invalid proof", async function () {
      const wrongProof = [ethers.randomBytes(32)].map(ethers.hexlify);
      await expect(
        incentiveEngine.connect(alice).claimAirdrop(campaignId, ALICE_ALLOC, wrongProof)
      ).to.be.revertedWith("IncentiveEngine: invalid proof");
    });

    it("rejects wrong amount (valid address, wrong amount)", async function () {
      const proof = tree.getProof(0);
      await expect(
        incentiveEngine.connect(alice).claimAirdrop(campaignId, ALICE_ALLOC + 1n, proof)
      ).to.be.revertedWith("IncentiveEngine: invalid proof");
    });

    it("creator reclaims unclaimed tokens after deadline", async function () {
      // Alice claims, bob does not
      await incentiveEngine.connect(alice).claimAirdrop(campaignId, ALICE_ALLOC, tree.getProof(0));

      await time.increase(8 * 86400); // past deadline

      const balBefore = await token.balanceOf(creator.address);
      await expect(incentiveEngine.connect(creator).reclaimExpired(campaignId))
        .to.emit(incentiveEngine, "AirdropReclaimed")
        .withArgs(campaignId, creator.address, BOB_ALLOC);

      expect(await token.balanceOf(creator.address)).to.equal(balBefore + BOB_ALLOC);
    });

    it("cannot claim after deadline", async function () {
      await time.increase(8 * 86400);
      await expect(
        incentiveEngine.connect(alice).claimAirdrop(campaignId, ALICE_ALLOC, tree.getProof(0))
      ).to.be.revertedWith("IncentiveEngine: campaign expired");
    });
  });
});
