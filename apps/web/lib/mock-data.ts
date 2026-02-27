export type TokenType = "normal" | "agent" | "skill";

export interface MockToken {
  address: string;
  name: string;
  symbol: string;
  type: TokenType;
  description: string;
  avatar?: string;        // emoji
  price: number;          // BNB
  marketCap: number;      // USD
  volume24h: number;      // USD
  priceChange24h: number; // %
  graduationProgress: number; // 0–100
  reputationScore: number;    // 0–100
  isGraduated: boolean;
  holders: number;
  agentId?: number;
  parentAgent?: string;
  creator?: string;       // short wallet address
  feeBps?: number;        // platform fee in basis points (default 100 = 1%)
  curveAddress?: `0x${string}`; // deployed BondingCurve address (undefined until deployed)
  createdAt: number;      // timestamp ms
}

export const mockTokens: MockToken[] = [
  {
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    name: "ResearchAgent",
    symbol: "RSCH",
    type: "agent",
    description: "AI research agent specialising in on-chain analytics and DeFi intelligence.",
    price: 0.000042,
    marketCap: 168000,
    volume24h: 34200,
    priceChange24h: 18.4,
    graduationProgress: 78,
    reputationScore: 81,
    isGraduated: false,
    holders: 342,
    agentId: 1,
    createdAt: Date.now() - 3 * 86400000,
  },
  {
    address: "0x3f17F1962B36e491b30A40b2405849e597Ba5FB5",
    name: "TradeSage",
    symbol: "SAGE",
    type: "agent",
    description: "Autonomous trading agent with real-time market analysis and signal generation.",
    price: 0.000089,
    marketCap: 356000,
    volume24h: 87600,
    priceChange24h: -4.2,
    graduationProgress: 100,
    reputationScore: 94,
    isGraduated: true,
    holders: 1204,
    agentId: 2,
    createdAt: Date.now() - 14 * 86400000,
  },
  {
    address: "0xF4eE9631f4BE0a63756515141281A3E2B293Bbe5",
    name: "Void Protocol",
    symbol: "VOID",
    type: "normal",
    description: "Fair-launch community token with deflationary tokenomics.",
    price: 0.0000013,
    marketCap: 5200,
    volume24h: 1100,
    priceChange24h: 47.8,
    graduationProgress: 12,
    reputationScore: 34,
    isGraduated: false,
    holders: 67,
    createdAt: Date.now() - 1 * 86400000,
  },
  {
    address: "0x9D7f74d0C41E726EC95884E0e97Fa6129e3b5E99",
    name: "RAG Skill",
    symbol: "RAG",
    type: "skill",
    description: "Retrieval-augmented generation module for ResearchAgent — enables document Q&A.",
    price: 0.0000055,
    marketCap: 22000,
    volume24h: 5400,
    priceChange24h: 7.1,
    graduationProgress: 41,
    reputationScore: 61,
    isGraduated: false,
    holders: 189,
    agentId: 1,
    parentAgent: "ResearchAgent",
    createdAt: Date.now() - 5 * 86400000,
  },
  {
    address: "0xBcd76E37C8C36e1BBae74D7F4e7C36DF3A2D96BB",
    name: "AlphaHunter",
    symbol: "ALPHA",
    type: "agent",
    description: "Agent that scans new token launches and generates alpha signals.",
    price: 0.000031,
    marketCap: 124000,
    volume24h: 28700,
    priceChange24h: 2.3,
    graduationProgress: 55,
    reputationScore: 68,
    isGraduated: false,
    holders: 521,
    agentId: 3,
    createdAt: Date.now() - 6 * 86400000,
  },
  {
    address: "0xAbE55A438C4A5a7E90fA9c2C2Ca2e08D3E89C3B6",
    name: "Debug Module",
    symbol: "DEBUG",
    type: "skill",
    description: "On-chain debug skill for smart contract agents — trace analysis + error explanations.",
    price: 0.0000028,
    marketCap: 11200,
    volume24h: 2300,
    priceChange24h: -1.8,
    graduationProgress: 27,
    reputationScore: 49,
    isGraduated: false,
    holders: 94,
    agentId: 2,
    parentAgent: "TradeSage",
    createdAt: Date.now() - 8 * 86400000,
  },
  {
    address: "0x0D0707963952f2fBA59dD06f2b425ace40b492Fe",
    name: "BNBpepe",
    symbol: "BPEPE",
    type: "normal",
    description: "The official pepe of BNB Chain. No utility. Just vibes.",
    price: 0.00000021,
    marketCap: 840,
    volume24h: 6700,
    priceChange24h: 112.3,
    graduationProgress: 4,
    reputationScore: 18,
    isGraduated: false,
    holders: 38,
    createdAt: Date.now() - 2 * 3600000,
  },
  {
    address: "0x27a16DaB6D7F7b7C54E70b4a3bF8C56B4e4e4Cf",
    name: "TradeSage: Trade Skill",
    symbol: "TRADE",
    type: "skill",
    description: "Execute autonomous trades through TradeSage agent — requires SAGE holdings.",
    price: 0.000012,
    marketCap: 48000,
    volume24h: 11200,
    priceChange24h: 5.6,
    graduationProgress: 69,
    reputationScore: 75,
    isGraduated: false,
    holders: 312,
    agentId: 2,
    parentAgent: "TradeSage",
    createdAt: Date.now() - 10 * 86400000,
  },
];

export const platformStats = {
  totalLaunched: 1247,
  totalVolume: 4_820_000,
  activeAgents: 89,
  totalBurned: 12_400_000,
};

export function formatBNB(wei: number): string {
  return wei.toFixed(wei < 0.001 ? 8 : 4);
}

export function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
