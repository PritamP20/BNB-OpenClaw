/**
 * AgentLaunch — Contract ABIs + deployed address config.
 *
 * Addresses are read from env vars (NEXT_PUBLIC_*). Until the contracts are
 * deployed to BSC Testnet, these will be undefined and the frontend falls back
 * to mock data seamlessly.
 */

// ── Addresses ────────────────────────────────────────────────────────────────

export const ADDRESSES = {
  nfaManager: process.env.NEXT_PUBLIC_NFA_MANAGER as `0x${string}` | undefined,
  agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY as `0x${string}` | undefined,
  tokenFactory: (process.env.NEXT_PUBLIC_TOKEN_FACTORY || "0x2D4D2807BC5c2CC1290e1ad41C7CCf300d8f9b84") as `0x${string}`,
  startBlock: BigInt(process.env.NEXT_PUBLIC_START_BLOCK || "92800000"), // Very recent block to avoid RPC limits
  pluVault: process.env.NEXT_PUBLIC_PLU_VAULT as `0x${string}` | undefined,
  dammManager: process.env.NEXT_PUBLIC_DAMM_MANAGER as `0x${string}` | undefined,
  buybackBurn: process.env.NEXT_PUBLIC_BUYBACK_BURN as `0x${string}` | undefined,
  reputationEngine: process.env.NEXT_PUBLIC_REPUTATION_ENGINE as `0x${string}` | undefined,
  incentiveEngine: process.env.NEXT_PUBLIC_INCENTIVE_ENGINE as `0x${string}` | undefined,
} as const;

// ── Bonding Curve ABI ─────────────────────────────────────────────────────────

export const BONDING_CURVE_ABI = [
  // Views
  { name: "token", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "tokenSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "tokensSold", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "bnbRaised", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "virtualBNB", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "graduationThreshold", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "graduated", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "initialized", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "feeBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "getPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "graduationProgress", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "tokensLeft", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "getBuyQuote", type: "function", stateMutability: "view", inputs: [{ name: "bnbIn", type: "uint256" }], outputs: [{ name: "tokenOut", type: "uint256" }] },
  { name: "getSellQuote", type: "function", stateMutability: "view", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [{ name: "bnbOut", type: "uint256" }] },
  // Writes
  { name: "init", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "buy", type: "function", stateMutability: "payable", inputs: [{ name: "minTokenOut", type: "uint256" }], outputs: [] },
  { name: "sell", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tokenAmount", type: "uint256" }, { name: "minBNBOut", type: "uint256" }], outputs: [] },
  // Events
  { name: "CurveInitialized", type: "event", inputs: [{ name: "token", type: "address", indexed: true }, { name: "tokenSupply", type: "uint256" }, { name: "virtualBNB", type: "uint256" }] },
  { name: "Buy", type: "event", inputs: [{ name: "buyer", type: "address", indexed: true }, { name: "bnbPaid", type: "uint256" }, { name: "bnbNet", type: "uint256" }, { name: "tokensOut", type: "uint256" }, { name: "fee", type: "uint256" }, { name: "priceAfter", type: "uint256" }] },
  { name: "Sell", type: "event", inputs: [{ name: "seller", type: "address", indexed: true }, { name: "tokensIn", type: "uint256" }, { name: "bnbGross", type: "uint256" }, { name: "bnbNet", type: "uint256" }, { name: "fee", type: "uint256" }, { name: "priceAfter", type: "uint256" }] },
  { name: "Graduated", type: "event", inputs: [{ name: "token", type: "address", indexed: true }, { name: "bnbRaised", type: "uint256" }, { name: "tokensRemaining", type: "uint256" }] },
] as const;

// ── TokenFactory ABI ──────────────────────────────────────────────────────────

export const TOKEN_FACTORY_ABI = [
  { name: "launchFee", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    name: "deployNormalToken", type: "function", stateMutability: "payable",
    inputs: [{ name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialSupply", type: "uint256" }, { name: "maxSupply", type: "uint256" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "deployAgentToken", type: "function", stateMutability: "payable",
    // Contract: (name, symbol, initialSupply, maxSupply, agentId, treasury)
    inputs: [{ name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialSupply", type: "uint256" }, { name: "maxSupply", type: "uint256" }, { name: "agentId", type: "uint256" }, { name: "treasury", type: "address" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "deploySkillToken", type: "function", stateMutability: "payable",
    inputs: [{ name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialSupply", type: "uint256" }, { name: "agentId", type: "uint256" }, { name: "skillId", type: "bytes32" }, { name: "costPerUse", type: "uint256" }],
    outputs: [{ name: "", type: "address" }]
  },
  { name: "NormalTokenDeployed", type: "event", inputs: [{ name: "token", type: "address", indexed: true }, { name: "creator", type: "address", indexed: true }, { name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialSupply", type: "uint256" }, { name: "maxSupply", type: "uint256" }] },
  { name: "AgentTokenDeployed", type: "event", inputs: [{ name: "token", type: "address", indexed: true }, { name: "agentId", type: "uint256", indexed: true }, { name: "creator", type: "address", indexed: true }, { name: "name", type: "string" }, { name: "symbol", type: "string" }] },
  { name: "SkillTokenDeployed", type: "event", inputs: [{ name: "token", type: "address", indexed: true }, { name: "agentId", type: "uint256", indexed: true }, { name: "skillId", type: "bytes32", indexed: true }, { name: "creator", type: "address" }, { name: "name", type: "string" }] },
] as const;

// ── NFAManager ABI ────────────────────────────────────────────────────────────

export const NFA_MANAGER_ABI = [
  {
    name: "mintAgent", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "logicAddress", type: "address" }, { name: "metadataURI", type: "string" }, { name: "learningEnabled", type: "bool" }],
    outputs: [{ name: "agentId", type: "uint256" }]
  },
  {
    name: "agentExists", type: "function", stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "getAgentData", type: "function", stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "logicAddress", type: "address" }, { name: "learningEnabled", type: "bool" }, { name: "state", type: "uint8" }, { name: "createdAt", type: "uint256" }]
  },
] as const;

// ── ReputationEngine ABI ──────────────────────────────────────────────────────

export const REPUTATION_ENGINE_ABI = [
  {
    name: "getReputation", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenAddr", type: "address" }],
    outputs: [{
      name: "", type: "tuple",
      components: [
        { name: "score", type: "uint256" },
        { name: "lastUpdated", type: "uint256" },
        { name: "launchTime", type: "uint256" },
        { name: "snapshotBNBRaised", type: "uint256" },
        { name: "snapshotTokensSold", type: "uint256" },
        { name: "snapshotBurned", type: "uint256" },
        { name: "graduated", type: "bool" },
      ],
    }],
  },
  {
    name: "getScore", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenAddr", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "updateScore", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "curve", type: "address" }],
    outputs: []
  },
] as const;

// ── ERC-20 ABI (minimal) ──────────────────────────────────────────────────────

export const ERC20_ABI = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
] as const;

// ── AgentRegistry ABI (minimal) ───────────────────────────────────────────────

export const AGENT_REGISTRY_ABI = [
  {
    name: "getAgentRecord",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "agentId",     type: "uint256"   },
          { name: "owner",       type: "address"   },
          { name: "agentToken",  type: "address"   },
          { name: "skillTokens", type: "address[]" },
          { name: "metadata",    type: "string"    },
          { name: "createdAt",   type: "uint256"   },
        ],
      },
    ],
  },
  {
    name: "registerAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentToken", type: "address" },
      { name: "metadata",   type: "string"  },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;
