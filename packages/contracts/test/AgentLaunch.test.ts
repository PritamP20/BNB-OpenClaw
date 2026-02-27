import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  NFAManager,
  AgentRegistry,
  TokenFactory,
  NormalToken,
  AgentToken,
  SkillToken,
} from "../typechain-types";

describe("AgentLaunch — Phase 1", function () {
  // ─── Signers ────────────────────────────────────────────────
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress; // agent owner
  let bob: SignerWithAddress;   // skill developer / user

  // ─── Contracts ──────────────────────────────────────────────
  let nfaManager: NFAManager;
  let agentRegistry: AgentRegistry;
  let tokenFactory: TokenFactory;

  // ─── Constants ──────────────────────────────────────────────
  const ZERO_ADDR = ethers.ZeroAddress;
  const SKILL_ID = ethers.keccak256(ethers.toUtf8Bytes("debug"));
  const ONE_TOKEN = ethers.parseEther("1");
  const MILLION = ethers.parseEther("1000000");

  // ─── Setup ──────────────────────────────────────────────────
  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();

    // Deploy NFAManager
    const NFAManagerFactory = await ethers.getContractFactory("NFAManager");
    nfaManager = (await NFAManagerFactory.deploy()) as NFAManager;

    // Deploy AgentRegistry
    const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = (await AgentRegistryFactory.deploy(
      await nfaManager.getAddress()
    )) as AgentRegistry;

    // Deploy TokenFactory
    const TokenFactoryFactory = await ethers.getContractFactory("TokenFactory");
    tokenFactory = (await TokenFactoryFactory.deploy(
      await nfaManager.getAddress(),
      await agentRegistry.getAddress(),
      0, // no launch fee
      deployer.address
    )) as TokenFactory;

    // Grant FACTORY_ROLE to TokenFactory
    await agentRegistry.grantFactoryRole(await tokenFactory.getAddress());
  });

  // ─────────────────────────────────────────────────────────────
  // NFAManager
  // ─────────────────────────────────────────────────────────────

  describe("NFAManager", function () {
    it("mints an NFA with correct data", async function () {
      const tx = await nfaManager
        .connect(alice)
        .mintAgent(alice.address, ZERO_ADDR, "ipfs://metadata/0", false);

      await expect(tx)
        .to.emit(nfaManager, "AgentMinted")
        .withArgs(0, alice.address, ZERO_ADDR, "ipfs://metadata/0", false);

      expect(await nfaManager.ownerOf(0)).to.equal(alice.address);
      expect(await nfaManager.agentExists(0)).to.be.true;
      expect(await nfaManager.isActive(0)).to.be.true;

      const data = await nfaManager.getAgentData(0);
      expect(data.learningEnabled).to.be.false;
      expect(data.logicAddress).to.equal(ZERO_ADDR);
    });

    it("increments agentId for each mint", async function () {
      await nfaManager.mintAgent(alice.address, ZERO_ADDR, "ipfs://0", false);
      await nfaManager.mintAgent(bob.address, ZERO_ADDR, "ipfs://1", false);

      expect(await nfaManager.totalMinted()).to.equal(2);
      expect(await nfaManager.ownerOf(0)).to.equal(alice.address);
      expect(await nfaManager.ownerOf(1)).to.equal(bob.address);
    });

    it("owner can pause and resume an agent", async function () {
      await nfaManager.mintAgent(alice.address, ZERO_ADDR, "ipfs://0", false);

      await expect(nfaManager.connect(alice).pauseAgent(0))
        .to.emit(nfaManager, "AgentStateChanged");

      expect(await nfaManager.isActive(0)).to.be.false;

      await expect(nfaManager.connect(alice).resumeAgent(0))
        .to.emit(nfaManager, "AgentStateChanged");

      expect(await nfaManager.isActive(0)).to.be.true;
    });

    it("platform owner can terminate an agent", async function () {
      await nfaManager.mintAgent(alice.address, ZERO_ADDR, "ipfs://0", false);
      await nfaManager.connect(deployer).terminateAgent(0);

      const data = await nfaManager.getAgentData(0);
      expect(data.state).to.equal(2); // Terminated = 2
    });

    it("non-owner cannot pause another's agent", async function () {
      await nfaManager.mintAgent(alice.address, ZERO_ADDR, "ipfs://0", false);
      await expect(nfaManager.connect(bob).pauseAgent(0)).to.be.revertedWith(
        "NFAManager: caller not authorized"
      );
    });

    it("owner can update logic address", async function () {
      await nfaManager.mintAgent(alice.address, ZERO_ADDR, "ipfs://0", false);
      const newLogic = bob.address; // placeholder
      await expect(nfaManager.connect(alice).updateLogicAddress(0, newLogic))
        .to.emit(nfaManager, "AgentLogicUpdated")
        .withArgs(0, newLogic);

      const data = await nfaManager.getAgentData(0);
      expect(data.logicAddress).to.equal(newLogic);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // NormalToken via TokenFactory
  // ─────────────────────────────────────────────────────────────

  describe("TokenFactory — NormalToken", function () {
    it("deploys a NormalToken and assigns balance to creator", async function () {
      const tx = await tokenFactory
        .connect(alice)
        .deployNormalToken("My Token", "MTK", MILLION, 0);

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log) => {
        try {
          return tokenFactory.interface.parseLog(log)?.name === "NormalTokenDeployed";
        } catch {
          return false;
        }
      });

      expect(event).to.exist;
      const parsed = tokenFactory.interface.parseLog(event!);
      const tokenAddress = parsed?.args.token;

      const token = (await ethers.getContractAt("NormalToken", tokenAddress)) as NormalToken;
      expect(await token.balanceOf(alice.address)).to.equal(MILLION);
      expect(await token.creator()).to.equal(alice.address);
      expect(await token.maxSupply()).to.equal(0);
    });

    it("records NormalToken in allNormalTokens array", async function () {
      await tokenFactory.connect(alice).deployNormalToken("T1", "T1", MILLION, 0);
      await tokenFactory.connect(bob).deployNormalToken("T2", "T2", MILLION, 0);
      const counts = await tokenFactory.getTokenCounts();
      expect(counts.normal).to.equal(2);
    });

    it("enforces maxSupply cap on NormalToken", async function () {
      const cap = ethers.parseEther("500000");
      await expect(
        tokenFactory
          .connect(alice)
          .deployNormalToken("Capped", "CAP", MILLION, cap)
      ).to.be.revertedWith("NormalToken: initial supply exceeds cap");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AgentToken via TokenFactory
  // ─────────────────────────────────────────────────────────────

  describe("TokenFactory — AgentToken", function () {
    let agentId: bigint;

    beforeEach(async function () {
      // Alice mints an NFA
      const tx = await nfaManager
        .connect(alice)
        .mintAgent(alice.address, ZERO_ADDR, "ipfs://agent/0", false);
      const receipt = await tx.wait();
      agentId = 0n;
    });

    it("deploys AgentToken for agent owner", async function () {
      const tx = await tokenFactory
        .connect(alice)
        .deployAgentToken("Agent Token", "AGT", MILLION, 0, agentId, ZERO_ADDR);

      await expect(tx).to.emit(tokenFactory, "AgentTokenDeployed");

      const counts = await tokenFactory.getTokenCounts();
      expect(counts.agent).to.equal(1);

      const [agentTokenAddr] = await agentRegistry.getAgentRecord(agentId);
      expect(agentTokenAddr).to.not.equal(ZERO_ADDR);
    });

    it("registers agent in AgentRegistry", async function () {
      await tokenFactory
        .connect(alice)
        .deployAgentToken("AGT", "AGT", MILLION, 0, agentId, ZERO_ADDR);

      expect(await agentRegistry.hasAgentToken(agentId)).to.be.true;
      expect(await agentRegistry.isRegistered(agentId)).to.be.true;
    });

    it("reverts if caller is not the NFA owner", async function () {
      await expect(
        tokenFactory
          .connect(bob)
          .deployAgentToken("AGT", "AGT", MILLION, 0, agentId, ZERO_ADDR)
      ).to.be.revertedWith("TokenFactory: caller is not the agent owner");
    });

    it("reverts if agent already has a primary token", async function () {
      await tokenFactory
        .connect(alice)
        .deployAgentToken("First", "FRST", MILLION, 0, agentId, ZERO_ADDR);

      await expect(
        tokenFactory
          .connect(alice)
          .deployAgentToken("Second", "SCND", MILLION, 0, agentId, ZERO_ADDR)
      ).to.be.revertedWith("TokenFactory: agent already has a primary token");
    });

    it("reverts for non-existent agent", async function () {
      await expect(
        tokenFactory
          .connect(alice)
          .deployAgentToken("AGT", "AGT", MILLION, 0, 999n, ZERO_ADDR)
      ).to.be.revertedWith("TokenFactory: agent does not exist");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SkillToken via TokenFactory
  // ─────────────────────────────────────────────────────────────

  describe("TokenFactory — SkillToken", function () {
    let agentId: bigint;

    beforeEach(async function () {
      await nfaManager
        .connect(alice)
        .mintAgent(alice.address, ZERO_ADDR, "ipfs://agent/0", false);
      agentId = 0n;
    });

    it("deploys a SkillToken and links to agent", async function () {
      const tx = await tokenFactory
        .connect(bob)
        .deploySkillToken("Debug Skill", "DEBUG", MILLION, agentId, SKILL_ID, ONE_TOKEN);

      await expect(tx).to.emit(tokenFactory, "SkillTokenDeployed");

      const [, skills] = await agentRegistry.getAgentRecord(agentId);
      expect(skills.length).to.equal(1);
    });

    it("allows multiple skills per agent", async function () {
      const SKILL_2 = ethers.keccak256(ethers.toUtf8Bytes("rag"));
      await tokenFactory
        .connect(bob)
        .deploySkillToken("Debug", "DBG", MILLION, agentId, SKILL_ID, ONE_TOKEN);
      await tokenFactory
        .connect(alice)
        .deploySkillToken("RAG", "RAG", MILLION, agentId, SKILL_2, ONE_TOKEN);

      expect(await agentRegistry.skillTokenCount(agentId)).to.equal(2);
    });

    it("verifySkillAccess returns true when user has enough tokens", async function () {
      const tx = await tokenFactory
        .connect(bob)
        .deploySkillToken("Debug", "DBG", MILLION, agentId, SKILL_ID, ONE_TOKEN);

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log) => {
        try {
          return tokenFactory.interface.parseLog(log)?.name === "SkillTokenDeployed";
        } catch {
          return false;
        }
      });
      const parsed = tokenFactory.interface.parseLog(event!);
      const skillAddr = parsed?.args.token;

      const skill = (await ethers.getContractAt("SkillToken", skillAddr)) as SkillToken;
      expect(await skill.verifySkillAccess(bob.address)).to.be.true;
      expect(await skill.verifySkillAccess(alice.address)).to.be.false;
    });

    it("consumeSkill burns costPerUse from caller", async function () {
      const tx = await tokenFactory
        .connect(bob)
        .deploySkillToken("Debug", "DBG", MILLION, agentId, SKILL_ID, ONE_TOKEN);

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log) => {
        try {
          return tokenFactory.interface.parseLog(log)?.name === "SkillTokenDeployed";
        } catch {
          return false;
        }
      });
      const parsed = tokenFactory.interface.parseLog(event!);
      const skillAddr = parsed?.args.token;

      const skill = (await ethers.getContractAt("SkillToken", skillAddr)) as SkillToken;
      const balanceBefore = await skill.balanceOf(bob.address);

      await expect(skill.connect(bob).consumeSkill())
        .to.emit(skill, "SkillUsed")
        .withArgs(bob.address, ONE_TOKEN);

      expect(await skill.balanceOf(bob.address)).to.equal(balanceBefore - ONE_TOKEN);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Launch fee
  // ─────────────────────────────────────────────────────────────

  describe("TokenFactory — launch fee", function () {
    it("collects fee and refunds excess BNB", async function () {
      const fee = ethers.parseEther("0.01");
      await tokenFactory.connect(deployer).setLaunchFee(fee);

      const collectorBefore = await ethers.provider.getBalance(deployer.address);

      await tokenFactory
        .connect(alice)
        .deployNormalToken("Paid", "PAID", MILLION, 0, { value: ethers.parseEther("0.02") });

      const collectorAfter = await ethers.provider.getBalance(deployer.address);
      // Collector received exactly the fee (ignoring gas on collector's txns)
      expect(collectorAfter - collectorBefore).to.be.gte(fee);
    });

    it("reverts if fee is not paid", async function () {
      await tokenFactory.connect(deployer).setLaunchFee(ethers.parseEther("0.01"));
      await expect(
        tokenFactory
          .connect(alice)
          .deployNormalToken("Paid", "PAID", MILLION, 0, { value: 0 })
      ).to.be.revertedWith("TokenFactory: insufficient launch fee");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AgentRegistry enumeration
  // ─────────────────────────────────────────────────────────────

  describe("AgentRegistry enumeration", function () {
    it("returns all registered agent IDs", async function () {
      await nfaManager.mintAgent(alice.address, ZERO_ADDR, "ipfs://0", false);
      await nfaManager.mintAgent(bob.address, ZERO_ADDR, "ipfs://1", false);

      await tokenFactory
        .connect(alice)
        .deployAgentToken("AGT0", "A0", MILLION, 0, 0n, ZERO_ADDR);
      await tokenFactory
        .connect(bob)
        .deployAgentToken("AGT1", "A1", MILLION, 0, 1n, ZERO_ADDR);

      const ids = await agentRegistry.getAllAgentIds();
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(0n);
      expect(ids[1]).to.equal(1n);
    });
  });
});
