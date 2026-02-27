/**
 * Chart data generation for AgentLaunch bonding curve tokens.
 *
 * When contracts are not yet deployed (or for mock tokens), this module
 * generates deterministic, realistic-looking price + volume data based
 * on the bonding curve formula: price = (virtualBNB + bnbRaised) / supply.
 */

import type { MockToken } from "./mock-data";

export type TimeRange = "1H" | "6H" | "24H" | "7D" | "ALL";

export interface ChartPoint {
  time: number;       // unix ms
  price: number;      // BNB per token (raw float)
  priceUSD: number;   // USD per token
  buyVol: number;     // USD volume from buys in this bucket
  sellVol: number;    // USD volume from sells in this bucket
  open: number;       // OHLC open (priceUSD)
  close: number;      // OHLC close (priceUSD)
  high: number;
  low: number;
}

export const BNB_USD = 620; // approximate — replace with live feed later

const RANGE_MS: Record<TimeRange, number> = {
  "1H":  3_600_000,
  "6H":  21_600_000,
  "24H": 86_400_000,
  "7D":  604_800_000,
  "ALL": Infinity,
};

/** Seeded, deterministic LCG random generator keyed on a token address. */
function makeRng(seed: string) {
  let s = parseInt(seed.slice(2, 10), 16) || 0xdeadbeef;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 15), 0x119de1f3);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Generate simulated price + volume history for a mock token.
 * Results are deterministic for the same (token, timeRange) pair.
 */
export function generatePriceHistory(
  token: MockToken,
  range: TimeRange,
  N = 180
): ChartPoint[] {
  const rng = makeRng(token.address);

  const virtualBNB = 10;
  const gradTarget = 69;
  const supply = 1_000_000_000;

  const now = Date.now();
  const age = Math.max(now - token.createdAt, 3_600_000); // min 1h for display

  const windowMs = Math.min(RANGE_MS[range], age);
  const startTime = now - windowMs;

  const maxProgress = token.graduationProgress / 100;

  const points: ChartPoint[] = [];

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const time = startTime + t * windowMs;
    const lifeFrac = Math.max(0, Math.min(1, (time - token.createdAt) / age));

    // S-curve progress: slow start, fast middle, levelling off
    const sCurve = 1 / (1 + Math.exp(-10 * (lifeFrac - 0.45)));
    const progress = maxProgress * sCurve;

    const bnbRaised = progress * gradTarget;
    const basePrice = (virtualBNB + bnbRaised) / supply; // BNB per token

    // Decreasing volatility over time (chaotic at launch, smoother later)
    const vol = 0.18 * Math.exp(-lifeFrac * 1.2) + 0.03;
    const noise = 1 + (rng() - 0.5) * 2 * vol;
    const price = Math.max(basePrice * 0.5, basePrice * noise);

    // OHLC within this bucket
    const o = price * (1 + (rng() - 0.5) * vol * 0.5);
    const c = price * (1 + (rng() - 0.5) * vol * 0.5);
    const h = Math.max(o, c) * (1 + rng() * vol * 0.3);
    const l = Math.min(o, c) * (1 - rng() * vol * 0.3);

    // Volume: spiky with higher volume near launch and big moves
    const baseVol = (800 + rng() * 6000) * (1 + (1 - lifeFrac) * 3) * BNB_USD;
    const isBuy = rng() > 0.38;

    points.push({
      time,
      price,
      priceUSD: price * BNB_USD,
      buyVol:   isBuy ? baseVol : 0,
      sellVol:  isBuy ? 0 : baseVol,
      open:  o * BNB_USD,
      close: c * BNB_USD,
      high:  h * BNB_USD,
      low:   l * BNB_USD,
    });
  }

  return points;
}

/** Format a USD price with appropriate precision. */
export function fmtUSD(usd: number, compact = false): string {
  if (usd === 0) return "$0";
  if (compact) {
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(1)}K`;
    return `$${usd.toFixed(2)}`;
  }
  if (usd < 0.000001) return `$${usd.toExponential(2)}`;
  if (usd < 0.0001)   return `$${usd.toFixed(8)}`;
  if (usd < 0.01)     return `$${usd.toFixed(6)}`;
  if (usd < 1)        return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/** Format a time axis label for a given range. */
export function fmtAxisTime(ts: number, range: TimeRange): string {
  const d = new Date(ts);
  if (range === "1H" || range === "6H") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (range === "24H") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Compute 24h stats from chart data. */
export function compute24hStats(points: ChartPoint[]): {
  priceChange: number;
  volumeUSD: number;
  high: number;
  low: number;
} {
  if (points.length < 2) return { priceChange: 0, volumeUSD: 0, high: 0, low: 0 };
  const first = points[0]!.priceUSD;
  const last  = points[points.length - 1]!.priceUSD;
  const volumeUSD = points.reduce((s, p) => s + p.buyVol + p.sellVol, 0);
  const prices    = points.map((p) => p.priceUSD);
  return {
    priceChange: first > 0 ? ((last - first) / first) * 100 : 0,
    volumeUSD,
    high: Math.max(...prices),
    low:  Math.min(...prices),
  };
}

/** Generate a plausible mock trade history for a token. */
export interface MockTrade {
  type: "buy" | "sell";
  wallet: string;
  tokenAmount: number;
  bnbAmount: number;
  usdAmount: number;
  timestamp: number;
  txHash: string;
}

export function generateTradeHistory(token: MockToken, count = 30): MockTrade[] {
  const rng = makeRng(token.address + "trades");
  const now = Date.now();
  const age = now - token.createdAt;
  const trades: MockTrade[] = [];

  const virtualBNB = 10;
  const gradTarget = 69;
  const supply = 1_000_000_000;
  const maxProgress = token.graduationProgress / 100;

  for (let i = 0; i < count; i++) {
    const lifeFrac = 1 - i / count; // recent trades first
    const bnbRaised = lifeFrac * maxProgress * gradTarget;
    const price = (virtualBNB + bnbRaised) / supply;

    const isBuy = rng() > 0.35;
    const bnbAmount = 0.05 + rng() * (isBuy ? 2 : 1);
    const tokenAmount = isBuy
      ? Math.round(bnbAmount / price)
      : Math.round(bnbAmount / price * 0.95);

    // Generate a fake wallet address
    const w = "0x" + Array.from({ length: 40 }, () =>
      Math.floor(rng() * 16).toString(16)
    ).join("");
    const txHash = "0x" + Array.from({ length: 64 }, () =>
      Math.floor(rng() * 16).toString(16)
    ).join("");

    trades.push({
      type: isBuy ? "buy" : "sell",
      wallet: `${w.slice(0, 6)}…${w.slice(-4)}`,
      tokenAmount,
      bnbAmount: parseFloat(bnbAmount.toFixed(4)),
      usdAmount: parseFloat((bnbAmount * BNB_USD).toFixed(2)),
      timestamp: now - Math.floor(rng() * age * (i / count + 0.01)),
      txHash,
    });
  }

  return trades.sort((a, b) => b.timestamp - a.timestamp);
}
