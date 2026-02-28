"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Coins,
  Puzzle,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Info,
  Flame,
  Loader2,
} from "lucide-react";
import { useReadContract, useReadContracts, usePublicClient } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatEther } from "viem";
import { Token } from "../../../hooks/useTokens";
import { timeAgo } from "../../../lib/mock-data";
import { PriceChart } from "../../../components/PriceChart";
import { BuySellPanel } from "../../../components/BuySellPanel";
import { ReputationScore } from "../../../components/ReputationScore";
import { AgentSkillGraph } from "../../../components/AgentSkillGraph";
import { BONDING_CURVE_ABI, ERC20_ABI, REPUTATION_ENGINE_ABI, ADDRESSES } from "../../../lib/contracts";

// Mini ABIs for on-chain type detection
const AGENT_DETECT_ABI = [
  { name: "agentId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

const SKILL_DETECT_ABI = [
  { name: "skillId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
] as const;

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const CREATOR_ABI = [
  { name: "creator", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

const TRANSFER_EVENT = {
  name: "Transfer", type: "event",
  inputs: [
    { name: "from",  type: "address", indexed: true },
    { name: "to",    type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

// Graduation target: 69 BNB in wei
const GRADUATION_TARGET_WEI = BigInt(69) * BigInt(1e18);
import { fmtUSD, BNB_USD } from "../../../lib/chart-data";
import { fetchAllLogs } from "../../../lib/fetchLogs";
import { discoverBondingCurve } from "../../../lib/curveDiscovery";
import { useTrades } from "../../../hooks/useTrades";
import { useChartData } from "../../../hooks/useChartData";
import { useLiveBNBPrice } from "../../../hooks/useLiveBNBPrice";

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  agent: { label: "AI Agent", Icon: Bot, color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  normal: { label: "Token", Icon: Coins, color: "text-blue-400   bg-blue-400/10   border-blue-400/20" },
  skill: { label: "Skill", Icon: Puzzle, color: "text-green-400  bg-green-400/10  border-green-400/20" },
};

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-gray-600 hover:text-gray-400 transition-colors"
      title="Copy address"
    >
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
    </button>
  );
}

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="group flex flex-col items-center rounded-xl border border-bnb-yellow/10 glass px-4 py-3 text-center transition-all duration-200 hover:border-bnb-yellow/25 hover:shadow-[0_0_16px_rgba(243,186,47,0.1)]">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-gray-600 group-hover:text-gray-500 transition-colors">
        {icon && <span className="opacity-60">{icon}</span>}
        {label}
      </div>
      <span className={`mt-1 font-mono text-base font-bold ${accent ?? "text-white"}`}>{value}</span>
    </div>
  );
}

// ── BondingCurveBar ───────────────────────────────────────────────────────────

const MILESTONES = [
  { pct: 25, label: "Early", color: "bg-blue-400" },
  { pct: 50, label: "Growing", color: "bg-bnb-yellow" },
  { pct: 75, label: "Hot 🔥", color: "bg-orange-400" },
  { pct: 100, label: "Grad 🎓", color: "bg-green-400" },
];

function BondingCurveBar({
  token,
  liveProgress,
  liveBNBRaised,
}: {
  token: Token;
  liveProgress?: number;
  liveBNBRaised?: bigint;
}) {
  const progress = liveProgress ?? token.graduationProgress;
  const bnbRaised = liveBNBRaised != null
    ? parseFloat(formatEther(liveBNBRaised)).toFixed(2)
    : ((token.graduationProgress / 100) * 69).toFixed(2);

  const barColor = progress >= 75
    ? "from-orange-500 to-green-500"
    : progress >= 50
      ? "from-bnb-yellow to-orange-400"
      : "from-blue-500 to-bnb-yellow";

  return (
    <div className="rounded-2xl border border-bnb-yellow/10 glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Bonding Curve Progress</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${token.isGraduated
          ? "bg-green-400/10 text-green-400"
          : progress >= 75
            ? "bg-orange-400/10 text-orange-400"
            : "bg-bnb-yellow/10 text-bnb-yellow"
          }`}>
          {token.isGraduated ? "Graduated 🎓" : `${progress}%`}
        </span>
      </div>

      {/* Progress bar with gradient */}
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
          style={{
            width: `${Math.min(progress, 100)}%`,
            boxShadow: progress >= 75
              ? "0 0 14px rgba(74,222,128,0.5), 0 0 28px rgba(74,222,128,0.2)"
              : progress >= 50
              ? "0 0 14px rgba(243,186,47,0.5), 0 0 28px rgba(243,186,47,0.2)"
              : "0 0 14px rgba(59,130,246,0.4)",
          }}
        />
        {/* Milestone ticks */}
        {MILESTONES.slice(0, -1).map(({ pct }) => (
          <div
            key={pct}
            className="absolute top-0 h-full w-px bg-white/10"
            style={{ left: `${pct}%` }}
          />
        ))}
      </div>

      {/* Milestone labels */}
      <div className="mt-1.5 flex justify-between px-0.5 text-[10px] text-gray-600">
        {MILESTONES.map(({ pct, label }) => (
          <span key={pct} className={progress >= pct ? "text-gray-400 font-medium" : ""}>
            {label}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg glass border border-bnb-yellow/10 p-2.5 text-center hover:border-bnb-yellow/25 transition-colors">
          <p className="text-gray-600">BNB Raised</p>
          <p className="font-mono font-bold text-bnb-yellow mt-0.5">{bnbRaised} BNB</p>
        </div>
        <div className="rounded-lg glass border border-bnb-yellow/10 p-2.5 text-center hover:border-bnb-yellow/25 transition-colors">
          <p className="text-gray-600">Target</p>
          <p className="font-mono font-bold text-white mt-0.5">69 BNB</p>
        </div>
        <div className="rounded-lg glass border border-bnb-yellow/10 p-2.5 text-center hover:border-bnb-yellow/25 transition-colors">
          <p className="text-gray-600">Remaining</p>
          <p className="font-mono font-bold text-bnb-yellow mt-0.5">
            {(69 - parseFloat(bnbRaised)).toFixed(2)} BNB
          </p>
        </div>
      </div>

      {token.isGraduated ? (
        <p className="mt-3 text-xs text-green-400/80">
          This token has graduated — liquidity is now on PancakeSwap DEX.
        </p>
      ) : (
        <p className="mt-3 text-xs text-gray-600">
          Raise {(69 - parseFloat(bnbRaised)).toFixed(2)} more BNB to graduate to PancakeSwap and unlock DEX liquidity.
        </p>
      )}
    </div>
  );
}

// ── TradeHistory ──────────────────────────────────────────────────────────────

type TradeTab = "trades" | "info";

function TradeHistory({ token, totalSupply }: { token: Token; totalSupply?: string }) {
  const [tab, setTab] = useState<TradeTab>("trades");
  const { trades, loading, fetched, curveFound } = useTrades(token.address);
  const cfg = TYPE_CONFIG[token.type];

  return (
    <div className="rounded-2xl border border-bnb-yellow/10 glass">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-bnb-yellow/10 p-2">
        <button
          onClick={() => setTab("trades")}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 ${
            tab === "trades"
              ? "bg-bnb-yellow/10 text-bnb-yellow border border-bnb-yellow/25"
              : "text-gray-500 border border-transparent hover:text-bnb-yellow/70"
            }`}
        >
          <Activity size={12} /> Trades
        </button>
        <button
          onClick={() => setTab("info")}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 ${
            tab === "info"
              ? "bg-bnb-yellow/10 text-bnb-yellow border border-bnb-yellow/25"
              : "text-gray-500 border border-transparent hover:text-bnb-yellow/70"
            }`}
        >
          <Info size={12} /> Token Info
        </button>
      </div>

      {tab === "trades" && (
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {/* Header row */}
          <div className="grid grid-cols-5 px-4 py-2 text-[10px] uppercase tracking-widest text-gray-600">
            <span>Type</span>
            <span>Wallet</span>
            <span className="text-right">Tokens</span>
            <span className="text-right">BNB</span>
            <span className="text-right">Age</span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-600">
              <Loader2 size={13} className="animate-spin" /> Fetching trades from chain…
            </div>
          )}

          {/* No curve found on-chain */}
          {fetched && !loading && !curveFound && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Activity size={24} className="text-gray-700" />
              <p className="text-sm font-medium text-gray-500">No trades yet</p>
              <p className="text-xs text-gray-700">This token has no on-chain bonding curve.</p>
            </div>
          )}

          {/* No trades yet (real curve, zero events) */}
          {fetched && !loading && curveFound && trades.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Activity size={24} className="text-gray-700" />
              <p className="text-sm font-medium text-gray-500">No trades yet</p>
              <p className="text-xs text-gray-700">Be the first to buy this token.</p>
            </div>
          )}

          {/* Real trades */}
          {trades.map((t, i) => (
            <div
              key={i}
              className="grid grid-cols-5 items-center px-4 py-2.5 text-xs hover:bg-bnb-yellow/[0.025] transition-colors"
            >
              <span className={`w-fit rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                t.type === "buy"
                  ? "bg-green-400/10 text-green-400 shadow-[0_0_8px_rgba(74,222,128,0.2)]"
                  : "bg-red-400/10 text-red-400 shadow-[0_0_8px_rgba(248,113,113,0.2)]"
              }`}>
                {t.type}
              </span>
              <a
                href={`https://testnet.bscscan.com/address/${t.walletFull}`}
                target="_blank" rel="noopener noreferrer"
                className="font-mono text-gray-500 hover:text-gray-300 transition-colors"
              >
                {t.wallet}
              </a>
              <span className="text-right font-mono text-gray-300">
                {t.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-right font-mono text-white">{t.bnbAmount}</span>
              <a
                href={`https://testnet.bscscan.com/tx/${t.txHash}`}
                target="_blank" rel="noopener noreferrer"
                className="text-right text-gray-600 hover:text-gray-400 transition-colors"
              >
                {timeAgo(t.estimatedTs)}
              </a>
            </div>
          ))}
        </div>
      )}

      {tab === "info" && (
        <div className="p-5 flex flex-col gap-3 text-sm">
          <InfoRow label="Contract Address">
            <span className="font-mono text-xs text-gray-300">
              {token.address.slice(0, 10)}…{token.address.slice(-8)}
            </span>
            <CopyButton text={token.address} />
            <a
              href={`https://testnet.bscscan.com/address/${token.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-400"
            >
              <ExternalLink size={11} />
            </a>
          </InfoRow>
          {token.creator && (
            <InfoRow label="Creator">
              <span className="font-mono text-xs text-gray-300">
                {token.creator.slice(0, 8)}…{token.creator.slice(-6)}
              </span>
              <CopyButton text={token.creator} />
              <a
                href={`https://testnet.bscscan.com/address/${token.creator}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-400"
              >
                <ExternalLink size={11} />
              </a>
            </InfoRow>
          )}
          <InfoRow label="Token Type">
            <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
              <cfg.Icon size={10} />
              {cfg.label}
            </span>
          </InfoRow>
          {token.agentId != null && (
            <InfoRow label="Agent ID">
              <span className="font-mono text-gray-300">#{token.agentId.toString()}</span>
            </InfoRow>
          )}
          {token.parentAgent && (
            <InfoRow label="Parent Agent">
              <span className="font-mono text-gray-300">{token.parentAgent}</span>
            </InfoRow>
          )}
          <InfoRow label="Total Supply">
            <span className="font-mono text-gray-300">{totalSupply ?? "—"}</span>
          </InfoRow>
          <InfoRow label="Fee">
            <span className="font-mono text-gray-300">{(token.feeBps ?? 100) / 100}%</span>
          </InfoRow>
          <InfoRow label="Network">
            <span className="font-mono text-gray-300">BNB Chain Testnet</span>
          </InfoRow>
          <InfoRow label="Created">
            <span className="text-gray-300">{new Date(token.createdAt).toLocaleDateString(undefined, {
              year: "numeric", month: "short", day: "numeric",
            })}</span>
          </InfoRow>
          <InfoRow label="Curve Type">
            <span className="font-mono text-gray-300">xy=k (constant product)</span>
          </InfoRow>
          <InfoRow label="Virtual BNB">
            <span className="font-mono text-gray-300">10 BNB</span>
          </InfoRow>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TokenDetailClient({ token }: { token: Token }) {
  const shortAddr = `${token.address.slice(0, 8)}…${token.address.slice(-6)}`;

  // ── Live BNB/USD price (Binance, refreshes every 30s) ──────────────────────
  const liveBNBUSD = useLiveBNBPrice();

  // ── Chart events for volume + priceChange computation ───────────────────
  const { events: chartEvents } = useChartData(token.address as `0x${string}`);

  // ── On-chain metadata hydration ───────────────────────────────────────────
  // Reads name/symbol/totalSupply from ERC-20, then probes agentId/skillId
  // to detect the real token type. Falls back to stub values until resolved.

  // ── Holders count from Transfer events ───────────────────────────────────
  const publicClient = usePublicClient({ chainId: bscTestnet.id });
  const [holders, setHolders] = useState<number | null>(null);

  // ── Discover bonding curve address ───────────────────────────────────────
  const [curveAddress, setCurveAddress] = useState<`0x${string}` | undefined>(
    token.curveAddress
  );
  const [curveLoading, setCurveLoading] = useState(!token.curveAddress);

  useEffect(() => {
    // token.curveAddress is never populated by useTokens events — discover it
    if (!publicClient) return;
    let cancelled = false;
    setCurveLoading(true);
    discoverBondingCurve(publicClient, token.address as `0x${string}`).then((addr) => {
      if (cancelled) return;
      if (addr) setCurveAddress(addr);
      setCurveLoading(false);
    }).catch(() => {
      if (!cancelled) setCurveLoading(false);
    });
    return () => { cancelled = true; };
  }, [token.address, publicClient]);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        const logs = await fetchAllLogs({
          client: publicClient,
          address: token.address,
          event: TRANSFER_EVENT,
          fromBlock: ADDRESSES.startBlock,
        });
        if (cancelled) return;
        // Count unique recipient addresses that aren't the zero address
        const unique = new Set(
          logs
            .map((l: any) => l.args?.to as string | undefined)
            .filter((a): a is string => !!a && a !== "0x0000000000000000000000000000000000000000")
        );
        setHolders(unique.size);
      } catch {
        // Non-critical — leave holders as null
      }
    })();
    return () => { cancelled = true; };
  }, [token.address, publicClient]);

  // ── Batch on-chain reads ──────────────────────────────────────────────────
  // Slots: 0=name 1=symbol 2=totalSupply 3=agentId 4=skillId 5=reputation 6=creator
  const repAddr = ADDRESSES.reputationEngine;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chainMeta } = useReadContracts({
    contracts: [
      { address: token.address, abi: ERC20_ABI,              functionName: "name" },
      { address: token.address, abi: ERC20_ABI,              functionName: "symbol" },
      { address: token.address, abi: ERC20_ABI,              functionName: "totalSupply" },
      { address: token.address, abi: AGENT_DETECT_ABI,       functionName: "agentId" },
      { address: token.address, abi: SKILL_DETECT_ABI,       functionName: "skillId" },
      ...(repAddr
        ? [{ address: repAddr, abi: REPUTATION_ENGINE_ABI,   functionName: "getReputation", args: [token.address] }]
        : []),
      { address: token.address, abi: CREATOR_ABI,            functionName: "creator" },
    ] as any,
    allowFailure: true,
  });

  const repSlot     = repAddr ? 5 : -1;
  const creatorSlot = repAddr ? 6 : 5;

  const chainName    = (chainMeta?.[0]?.result as string  | undefined) ?? token.name;
  const chainSymbol  = (chainMeta?.[1]?.result as string  | undefined) ?? token.symbol;
  const chainSupply  = chainMeta?.[2]?.result as bigint   | undefined;
  const chainAgentId = chainMeta?.[3]?.result as bigint   | undefined;
  const chainSkillId = chainMeta?.[4]?.result as `0x${string}` | undefined;
  const chainCreator = chainMeta?.[creatorSlot]?.result as `0x${string}` | undefined;

  // Full reputation tuple
  type RepTuple = { score: bigint; launchTime: bigint; graduated: boolean; snapshotBNBRaised: bigint; snapshotTokensSold: bigint };
  const repData  = repSlot >= 0 ? (chainMeta?.[repSlot]?.result as RepTuple | undefined) : undefined;
  const chainRepScore    = repData?.score        ?? undefined;
  const chainLaunchTime  = repData?.launchTime   ?? undefined;
  const chainGraduated   = repData?.graduated    ?? undefined;
  const repBNBRaised     = repData?.snapshotBNBRaised   ?? 0n;
  const repTokensSold    = repData?.snapshotTokensSold  ?? 0n;

  // Detect real token type from probed public getters
  const detectedType: Token["type"] =
    chainSkillId != null && chainSkillId !== ZERO_BYTES32
      ? "skill"
      : chainAgentId != null          // agentId() exists on this contract (even if 0)
        ? "agent"
        : "normal";

  const cfg = TYPE_CONFIG[detectedType];

  // Formatted total supply (real on-chain value when available)
  const totalSupplyDisplay = chainSupply != null
    ? Number(formatEther(chainSupply)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "—";

  // Derive graduation progress from reputation snapshot when no live curve
  const snapshotProgress = repBNBRaised > 0n
    ? Math.min(100, Math.round(Number(repBNBRaised * 100n) / Number(GRADUATION_TARGET_WEI)))
    : 0;

  // Derive price from bonding curve snapshot (virtual BNB = 10 BNB)
  // price [BNB/token] = (virtualBNB + bnbRaised) / (totalSupply - tokensSold)
  const VIRTUAL_BNB = BigInt(10) * BigInt(1e18);
  const snapshotPriceBNB = (chainSupply != null && chainSupply > repTokensSold)
    ? Number(VIRTUAL_BNB + repBNBRaised) / Number(chainSupply - repTokensSold)
    : 0;

  // ── Live on-chain reads (when curveAddress is available) ──────────────────

  const { data: liveProgress } = useReadContract({
    address: curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "graduationProgress",
    query: { enabled: !!curveAddress, refetchInterval: 30_000 },
  });

  const { data: liveBNBRaised } = useReadContract({
    address: curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "bnbRaised",
    query: { enabled: !!curveAddress, refetchInterval: 30_000 },
  });

  const { data: livePrice } = useReadContract({
    address: curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "getPrice",
    query: { enabled: !!curveAddress, refetchInterval: 30_000 },
  });

  const { data: liveGraduated } = useReadContract({
    address: curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: "graduated",
    query: { enabled: !!curveAddress },
  });

  // Merge live curve data with snapshot/chain fallbacks
  const livePriceBNB = livePrice != null ? parseFloat(formatEther(livePrice)) : 0;
  const isGraduated  = liveGraduated ?? token.isGraduated;

  const finalPrice       = livePriceBNB > 0 ? livePriceBNB : snapshotPriceBNB;
  const finalProgress    = liveProgress != null ? Number(liveProgress) : snapshotProgress;
  const finalIsGraduated = chainGraduated ?? isGraduated;
  const finalCreatedAt   = chainLaunchTime && chainLaunchTime > 0n
    ? Number(chainLaunchTime) * 1000   // unix → ms
    : token.createdAt;
  const finalMarketCap = chainSupply != null && finalPrice > 0
    ? Number(formatEther(chainSupply)) * finalPrice * liveBNBUSD
    : token.marketCap;

  // Live token for sub-components (merge all on-chain data)
  const liveToken: Token = {
    ...token,
    name: chainName,
    symbol: chainSymbol,
    type: detectedType,
    agentId: chainAgentId ?? token.agentId,
    creator: chainCreator ?? token.creator,
    reputationScore: chainRepScore != null ? Number(chainRepScore) : token.reputationScore,
    graduationProgress: finalProgress,
    price: finalPrice,
    marketCap: finalMarketCap,
    isGraduated: finalIsGraduated,
    holders: holders ?? token.holders,
    createdAt: finalCreatedAt,
  };

  // ── Compute real 24h stats from on-chain chart events ───────────────────
  const MS_24H = 86_400_000;
  const now24 = Date.now();

  // Volume = sum of BNB in all trades in last 24h × live BNB/USD
  const liveVolume24h = chartEvents
    .filter((e) => e.ts >= now24 - MS_24H)
    .reduce((s, e) => s + e.bnbAmount * liveBNBUSD, 0);

  // priceChange = (currentPrice - price24hAgo) / price24hAgo × 100
  // price24hAgo = priceAfter of the last event that occurred before the 24h window
  const sortedEvents = [...chartEvents].sort((a, b) => a.ts - b.ts);
  const eventsBefore24h = sortedEvents.filter((e) => e.ts < now24 - MS_24H);
  const price24hAgo = eventsBefore24h.length > 0
    ? eventsBefore24h[eventsBefore24h.length - 1]!.priceAfterBNB
    : sortedEvents.length > 0
      ? sortedEvents[0]!.priceAfterBNB
      : finalPrice;
  const livePriceChange24h = price24hAgo > 0 && finalPrice > 0
    ? ((finalPrice - price24hAgo) / price24hAgo) * 100
    : 0;

  const isUp = livePriceChange24h >= 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Back link */}
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-bnb-yellow/50 hover:text-bnb-yellow transition-colors group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to Explore
      </Link>

      {/* ── Token header ────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl border ${
            detectedType === "agent"
              ? "bg-purple-400/10 border-purple-400/25 shadow-[0_0_20px_rgba(192,132,252,0.2)]"
              : detectedType === "skill"
              ? "bg-green-400/10 border-green-400/25 shadow-[0_0_20px_rgba(74,222,128,0.2)]"
              : "bg-bnb-yellow/10 border-bnb-yellow/25 shadow-[0_0_20px_rgba(243,186,47,0.2)]"
          }`}>
            {detectedType === "agent" ? "🤖" : detectedType === "skill" ? "🧩" : "🟡"}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">{chainName}</h1>
              <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
                <cfg.Icon size={10} />
                {cfg.label}
              </span>
              {isGraduated && (
                <span className="rounded-md bg-green-400/15 px-2 py-0.5 text-xs font-bold text-green-400">
                  GRADUATED
                </span>
              )}
              {!curveAddress && (
                <span className="rounded-md bg-bnb-yellow/10 px-2 py-0.5 text-[10px] font-medium text-bnb-yellow/70">
                  MOCK
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs">
              <span className="text-gray-500 font-medium">${chainSymbol}</span>
              <span className="flex items-center gap-1 font-mono text-gray-700">
                {shortAddr}
                <CopyButton text={token.address} />
              </span>
              <a
                href={`https://testnet.bscscan.com/address/${token.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-gray-700 hover:text-gray-400 transition-colors"
              >
                BscScan <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

          {/* Price + change */}
          <div className="flex flex-col items-end gap-1">
            <p className="font-mono text-3xl font-extrabold text-white" style={{ textShadow: "0 0 30px rgba(255,255,255,0.15)" }}>
              {fmtUSD(finalPrice * liveBNBUSD)}
            </p>
            <p className="font-mono text-xs text-gray-600">
              {finalPrice.toFixed(10)} BNB
            </p>
            <div className={`flex items-center gap-1 text-sm font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
              {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {isUp ? "+" : ""}{livePriceChange24h.toFixed(2)}% (24h)
            </div>
            {!isGraduated && (
              <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-bnb-yellow/5 border border-bnb-yellow/15 px-3 py-1.5">
                <Flame size={10} className="text-bnb-yellow/60" />
                <span className="text-[10px] text-bnb-yellow/70 font-medium">{finalProgress}% to graduation</span>
              </div>
            )}
          </div>
      </div>

      {/* ── Quick stats strip ────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Market Cap" value={fmtUSD(liveToken.marketCap, true)} icon={<TrendingUp size={9} />} />
        <StatPill label="24h Volume" value={fmtUSD(liveVolume24h, true)} icon={<Activity size={9} />} accent="text-green-400" />
        <StatPill
          label="Holders"
          value={(holders ?? liveToken.holders).toLocaleString()}
          icon={<span style={{ fontSize: 9 }}>👥</span>}
        />
        <StatPill
          label="Rep Score"
          value={`${liveToken.reputationScore}/100`}
          icon={<span style={{ fontSize: 9 }}>⭐</span>}
          accent={
            liveToken.reputationScore >= 75 ? "text-green-400"
              : liveToken.reputationScore >= 50 ? "text-bnb-yellow"
                : "text-red-400"
          }
        />
      </div>

      {/* Description */}
      {token.description && (
        <div className="mb-6 flex gap-3">
          <div className="mt-1 h-full w-0.5 flex-shrink-0 rounded-full bg-bnb-yellow/20" />
          <p className="text-sm leading-relaxed text-gray-500">{token.description}</p>
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

        {/* ── Left: chart + curve + trades ──────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Price chart card */}
          <div className="rounded-2xl border border-bnb-yellow/10 glass p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-bnb-yellow/10 border border-bnb-yellow/20">
                <Activity size={12} className="text-bnb-yellow" />
              </div>
              <h3 className="text-sm font-semibold text-white">Price Chart</h3>
            </div>
            <PriceChart token={liveToken as any} />
          </div>

          {/* Bonding curve */}
          <BondingCurveBar
            token={liveToken}
            liveProgress={liveProgress != null ? Number(liveProgress) : undefined}
            liveBNBRaised={liveBNBRaised}
          />

          {/* Reputation score */}
          <ReputationScore token={liveToken} />

          {/* Skill graph — agent tokens only */}
          {detectedType === "agent" && (
            <AgentSkillGraph
              agentTokenAddress={token.address as `0x${string}`}
              agentName={chainName}
              agentSymbol={chainSymbol}
            />
          )}

          {/* Trades + Info tabs */}
          <TradeHistory token={liveToken} totalSupply={totalSupplyDisplay} />
        </div>

        {/* ── Right: buy/sell (sticky) ───────────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:self-start lg:sticky lg:top-20">
          <BuySellPanel token={liveToken} curveAddress={curveAddress} curveLoading={curveLoading} />

          {/* Mini token info card */}
          <div className="rounded-2xl border border-bnb-yellow/10 glass p-4 flex flex-col gap-2.5 text-xs">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <span className="h-1 w-4 rounded-full bg-bnb-yellow/60" /> Details
            </h4>
            <div className="flex justify-between border-b border-bnb-yellow/5 pb-2">
              <span className="text-gray-600">Supply</span>
              <span className="font-mono text-gray-300">{totalSupplyDisplay}</span>
            </div>
            <div className="flex justify-between border-b border-bnb-yellow/5 pb-2">
              <span className="text-gray-600">Platform fee</span>
              <span className="font-mono text-gray-300">{(token.feeBps ?? 100) / 100}%</span>
            </div>
            <div className="flex justify-between border-b border-bnb-yellow/5 pb-2">
              <span className="text-gray-600">Curve</span>
              <span className="font-mono text-gray-300">xy=k</span>
            </div>
            <div className="flex justify-between border-b border-bnb-yellow/5 pb-2">
              <span className="text-gray-600">Network</span>
              <span className="flex items-center gap-1 text-gray-300">
                <span className="inline-block h-2 w-2 rounded-full bg-bnb-yellow animate-pulse" />
                BNB Chain
              </span>
            </div>
            {token.agentId != null && (
              <div className="flex justify-between">
                <span className="text-gray-600">Agent ID</span>
                <span className="font-mono text-gray-300">#{token.agentId}</span>
              </div>
            )}
            {token.parentAgent && (
              <div className="flex justify-between">
                <span className="text-gray-600">Parent Agent</span>
                <span className="font-mono text-gray-300">Agent</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Created</span>
              <span className="text-gray-300 flex items-center gap-1">
                <Clock size={10} />
                {timeAgo(token.createdAt)}
              </span>
            </div>
            {!isGraduated && (
              <div className="mt-1 rounded-xl bg-bnb-yellow/5 border border-bnb-yellow/10 px-3 py-2">
                <p className="text-[10px] text-bnb-yellow/70">
                  <Flame size={10} className="inline mr-1" />
                  {finalProgress}% to graduation · {69 - (finalProgress / 100) * 69 < 1
                    ? "Almost there!"
                    : `${((69 - (finalProgress / 100) * 69)).toFixed(1)} BNB remaining`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
