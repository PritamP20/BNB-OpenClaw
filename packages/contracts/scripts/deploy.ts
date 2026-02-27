/**
 * AgentLaunch — Phase 1 + 2 + 3 Deployment Script
 *
 * Deployment order:
 *   1. NFAManager          (identity layer — ERC-721)
 *   2. AgentRegistry       (links agents → tokens)
 *   3. TokenFactory        (deploys all token types)
 *   4. Grant FACTORY_ROLE on AgentRegistry → TokenFactory
 *   5. PLUVault            (progressive liquidity unlock)
 *   6. DAMMManager         (dynamic AMM configuration layer)
 *   7. BuybackBurn         (treasury buyback + burn)
 *   8. ReputationEngine    (token health scoring)
 *   9. IncentiveEngine     (airdrops + referrals)
 *  10. Wire BuybackBurn → ReputationEngine
 *
 * Note: BondingCurve is deployed per-token by the token creator, not here.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network bscTestnet
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("AgentLaunch — Phase 1 Deployment");
  console.log("=".repeat(60));
  console.log(`Network:   ${(await ethers.provider.getNetwork()).name}`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(
    `Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB`
  );
  console.log("-".repeat(60));

  // ── 1. NFAManager ──────────────────────────────────────────

  console.log("\n[1/4] Deploying NFAManager...");
  const NFAManager = await ethers.getContractFactory("NFAManager");
  const nfaManager = await NFAManager.deploy();
  await nfaManager.waitForDeployment();
  const nfaManagerAddress = await nfaManager.getAddress();
  console.log(`      NFAManager deployed → ${nfaManagerAddress}`);

  // ── 2. AgentRegistry ───────────────────────────────────────

  console.log("\n[2/4] Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy(nfaManagerAddress);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log(`      AgentRegistry deployed → ${agentRegistryAddress}`);

  // ── 3. TokenFactory ────────────────────────────────────────

  // Launch fee: 0 BNB for testnet (adjust for mainnet)
  const launchFee = ethers.parseEther("0");
  const feeCollector = deployer.address;

  console.log("\n[3/4] Deploying TokenFactory...");
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  const tokenFactory = await TokenFactory.deploy(
    nfaManagerAddress,
    agentRegistryAddress,
    launchFee,
    feeCollector
  );
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log(`      TokenFactory deployed → ${tokenFactoryAddress}`);

  // ── 4. Grant FACTORY_ROLE ──────────────────────────────────

  console.log("\n[4/6] Granting FACTORY_ROLE to TokenFactory on AgentRegistry...");
  const tx = await agentRegistry.grantFactoryRole(tokenFactoryAddress);
  await tx.wait();
  console.log(`      FACTORY_ROLE granted ✓`);

  // ── 5. PLUVault ────────────────────────────────────────────

  console.log("\n[5/6] Deploying PLUVault...");
  const PLUVault = await ethers.getContractFactory("PLUVault");
  const pluVault = await PLUVault.deploy();
  await pluVault.waitForDeployment();
  const pluVaultAddress = await pluVault.getAddress();
  console.log(`      PLUVault deployed → ${pluVaultAddress}`);

  // ── 6. DAMMManager ─────────────────────────────────────────

  console.log("\n[6/6] Deploying DAMMManager...");
  const DAMMManager = await ethers.getContractFactory("DAMMManager");
  const dammManager = await DAMMManager.deploy();
  await dammManager.waitForDeployment();
  const dammManagerAddress = await dammManager.getAddress();
  console.log(`      DAMMManager deployed → ${dammManagerAddress}`);

  // ── 7. BuybackBurn ─────────────────────────────────────────

  console.log("\n[7/10] Deploying BuybackBurn...");
  const BuybackBurn = await ethers.getContractFactory("BuybackBurn");
  const buybackBurn = await BuybackBurn.deploy();
  await buybackBurn.waitForDeployment();
  const buybackBurnAddress = await buybackBurn.getAddress();
  console.log(`      BuybackBurn deployed → ${buybackBurnAddress}`);

  // ── 8. ReputationEngine ────────────────────────────────────

  console.log("\n[8/10] Deploying ReputationEngine...");
  const ReputationEngine = await ethers.getContractFactory("ReputationEngine");
  const reputationEngine = await ReputationEngine.deploy();
  await reputationEngine.waitForDeployment();
  const reputationEngineAddress = await reputationEngine.getAddress();
  console.log(`      ReputationEngine deployed → ${reputationEngineAddress}`);

  // ── 9. IncentiveEngine ─────────────────────────────────────

  console.log("\n[9/10] Deploying IncentiveEngine...");
  const IncentiveEngine = await ethers.getContractFactory("IncentiveEngine");
  const incentiveEngine = await IncentiveEngine.deploy();
  await incentiveEngine.waitForDeployment();
  const incentiveEngineAddress = await incentiveEngine.getAddress();
  console.log(`      IncentiveEngine deployed → ${incentiveEngineAddress}`);

  // ── 10. Wire BuybackBurn into ReputationEngine ─────────────

  console.log("\n[10/10] Wiring BuybackBurn → ReputationEngine...");
  const wireTx = await reputationEngine.setBuybackBurn(buybackBurnAddress);
  await wireTx.wait();
  console.log(`      BuybackBurn wired ✓`);

  // ── Summary ────────────────────────────────────────────────

  console.log("\n" + "=".repeat(60));
  console.log("Deployment complete. Contract addresses:");
  console.log("=".repeat(60));
  console.log(`NFAManager       : ${nfaManagerAddress}`);
  console.log(`AgentRegistry    : ${agentRegistryAddress}`);
  console.log(`TokenFactory     : ${tokenFactoryAddress}`);
  console.log(`PLUVault         : ${pluVaultAddress}`);
  console.log(`DAMMManager      : ${dammManagerAddress}`);
  console.log(`BuybackBurn      : ${buybackBurnAddress}`);
  console.log(`ReputationEngine : ${reputationEngineAddress}`);
  console.log(`IncentiveEngine  : ${incentiveEngineAddress}`);
  console.log("=".repeat(60));
  console.log("\nBondingCurve: deployed per-token by creators (not here).");

  // ── Write env files ────────────────────────────────────────

  const root = path.resolve(__dirname, "../../..");

  // Frontend — apps/web/.env.local
  const webEnv = `# Auto-generated by deploy.ts — BSC Testnet
NEXT_PUBLIC_NFA_MANAGER=${nfaManagerAddress}
NEXT_PUBLIC_AGENT_REGISTRY=${agentRegistryAddress}
NEXT_PUBLIC_TOKEN_FACTORY=${tokenFactoryAddress}
NEXT_PUBLIC_PLU_VAULT=${pluVaultAddress}
NEXT_PUBLIC_DAMM_MANAGER=${dammManagerAddress}
NEXT_PUBLIC_BUYBACK_BURN=${buybackBurnAddress}
NEXT_PUBLIC_REPUTATION_ENGINE=${reputationEngineAddress}
NEXT_PUBLIC_INCENTIVE_ENGINE=${incentiveEngineAddress}
NEXT_PUBLIC_API_URL=http://localhost:4000
`;
  fs.writeFileSync(path.join(root, "apps/web/.env.local"), webEnv);
  console.log("\n✓ apps/web/.env.local written");

  // API — apps/api/.env
  const apiEnv = `# Auto-generated by deploy.ts — BSC Testnet
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/agentlaunch
BNB_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
TOKEN_GATE_THRESHOLD=1000000000000000000
SIGNATURE_TTL_SECONDS=300
CREATEOS_API_URL=https://api.createos.xyz
CREATEOS_API_KEY=your_createos_api_key_here
CREATEOS_CPU=200
CREATEOS_MEMORY=512
CREATEOS_REPLICAS=1
# Deployed contract addresses (for reference)
NFA_MANAGER=${nfaManagerAddress}
TOKEN_FACTORY=${tokenFactoryAddress}
REPUTATION_ENGINE=${reputationEngineAddress}
`;
  fs.writeFileSync(path.join(root, "apps/api/.env"), apiEnv);
  console.log("✓ apps/api/.env written");

  // ── Verification hint ──────────────────────────────────────

  const network = (await ethers.provider.getNetwork()).name;
  if (network !== "unknown" && network !== "hardhat") {
    console.log("\nTo verify contracts on BscScan:");
    console.log(
      `  npx hardhat verify --network ${network} ${nfaManagerAddress}`
    );
    console.log(
      `  npx hardhat verify --network ${network} ${agentRegistryAddress} "${nfaManagerAddress}"`
    );
    console.log(
      `  npx hardhat verify --network ${network} ${tokenFactoryAddress} "${nfaManagerAddress}" "${agentRegistryAddress}" "0" "${feeCollector}"`
    );
    console.log(
      `  npx hardhat verify --network ${network} ${pluVaultAddress}`
    );
    console.log(
      `  npx hardhat verify --network ${network} ${dammManagerAddress}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
