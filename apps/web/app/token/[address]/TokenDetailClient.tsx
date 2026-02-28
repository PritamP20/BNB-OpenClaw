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
  agent:  { label: "AI Agent", Icon: Bot,    color: "#1B4EF8", bg: "rgba(27,78,248,0.1)",  border: "#1B4EF8" },
  normal: { label: "Token",    Icon: Coins,  color: "#F5C220", bg: "rgba(245,194,32,0.08)", border: "#F5C220" },
  skill:  { label: "Skill",    Icon: Puzzle, color: "#D62828", bg: "rgba(214,40,40,0.1)",   border: "#D62828" },
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
      title="Copy address"
      style={{ color: "#555555" }}
    >
      {copied ? <Check size={11} style={{ color: "#4ade80" }} /> : <Copy size={11} />}
    </button>
  );
}

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center px-4 py-3 text-center"
      style={{ background: "#1A1A1A", border: "1px solid #333333" }}
    >
      <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest" style={{ color: "#555555" }}>
        {icon && <span style={{ opacity: 0.6 }}>{icon}</span>}
        {label}
      </div>
      <span className="mt-1 font-mono text-base font-black" style={{ color: accent ?? "#F5F5F5" }}>{value}</span>
    </div>
  );
}

// ── BondingCurveBar ───────────────────────────────────────────────────────────

const MILESTONES = [
  { pct: 25, label: "Early",   color: "#1B4EF8" },
  { pct: 50, label: "Growing", color: "#F5C220" },
  { pct: 75, label: "Hot",     color: "#D62828" },
  { pct: 100, label: "Grad",   color: "#4ade80" },
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

  const barColor = progress >= 75 ? "#D62828" : progress >= 50 ? "#F5C220" : "#1B4EF8";

  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #333333", padding: "20px", borderTop: "3px solid #F5C220" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>Bonding Curve Progress</h3>
        <span
          className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider"
          style={{
            background: token.isGraduated ? "#4ade80"
              : progress >= 75 ? "#D62828"
              : "#F5C220",
            color: "#0F0F0F",
          }}
        >
          {token.isGraduated ? "Graduated" : `${progress}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-4 w-full bh-progress-track">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${Math.min(progress, 100)}%`, background: barColor }}
        />
        {/* Milestone ticks */}
        {MILESTONES.slice(0, -1).map(({ pct }) => (
          <div
            key={pct}
            className="absolute top-0 h-full w-px"
            style={{ left: `${pct}%`, background: "#333333" }}
          />
        ))}
      </div>

      {/* Milestone labels */}
      <div className="mt-1.5 flex justify-between px-0.5 text-[9px] font-black uppercase tracking-wider" style={{ color: "#444444" }}>
        {MILESTONES.map(({ pct, label }) => (
          <span key={pct} style={{ color: progress >= pct ? "#888888" : "#444444" }}>
            {label}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-0" style={{ border: "1px solid #333333" }}>
        {[
          { label: "BNB Raised", value: `${bnbRaised} BNB`, accent: "#F5C220" },
          { label: "Target",     value: "69 BNB",            accent: "#F5F5F5" },
          { label: "Remaining",  value: `${(69 - parseFloat(bnbRaised)).toFixed(2)} BNB`, accent: "#F5C220" },
        ].map(({ label, value, accent }, i) => (
          <div
            key={label}
            className="p-2.5 text-center"
            style={{ borderRight: i < 2 ? "1px solid #333333" : "none", background: "#111111" }}
          >
            <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#555555" }}>{label}</p>
            <p className="font-mono font-black mt-0.5 text-sm" style={{ color: accent }}>{value}</p>
          </div>
        ))}
      </div>

      {token.isGraduated ? (
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#4ade80" }}>
          This token has graduated — liquidity is now on PancakeSwap DEX.
        </p>
      ) : (
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#444444" }}>
          Raise {(69 - parseFloat(bnbRaised)).toFixed(2)} more BNB to graduate to PancakeSwap.
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
    <div style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
      {/* Tab bar */}
      <div className="flex" style={{ borderBottom: "1px solid #333333" }}>
        <button
          onClick={() => setTab("trades")}
          className="flex items-center gap-1.5 px-4 py-3 text-xs font-black uppercase tracking-wider transition-all"
          style={{
            background: tab === "trades" ? "#222222" : "#1A1A1A",
            color: tab === "trades" ? "#F5C220" : "#555555",
            borderBottom: tab === "trades" ? "2px solid #F5C220" : "2px solid transparent",
            borderRight: "1px solid #333333",
          }}
        >
          <Activity size={11} /> Trades
        </button>
        <button
          onClick={() => setTab("info")}
          className="flex items-center gap-1.5 px-4 py-3 text-xs font-black uppercase tracking-wider transition-all"
          style={{
            background: tab === "info" ? "#222222" : "#1A1A1A",
            color: tab === "info" ? "#F5C220" : "#555555",
            borderBottom: tab === "info" ? "2px solid #F5C220" : "2px solid transparent",
          }}
        >
          <Info size={11} /> Token Info
        </button>
      </div>

      {tab === "trades" && (
        <div className="flex flex-col divide-y" style={{ borderColor: "#222222" }}>
          {/* Header row */}
          <div
            className="grid grid-cols-5 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest"
            style={{ background: "#111111", color: "#444444" }}
          >
            <span>Type</span>
            <span>Wallet</span>
            <span className="text-right">Tokens</span>
            <span className="text-right">BNB</span>
            <span className="text-right">Age</span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold uppercase tracking-wider" style={{ color: "#444444" }}>
              <Loader2 size={13} className="animate-spin" style={{ color: "#F5C220" }} /> Fetching trades from chain…
            </div>
          )}

          {/* No curve found on-chain */}
          {fetched && !loading && !curveFound && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Activity size={22} style={{ color: "#333333" }} />
              <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#555555" }}>No trades yet</p>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#444444" }}>This token has no on-chain bonding curve.</p>
            </div>
          )}

          {/* No trades yet (real curve, zero events) */}
          {fetched && !loading && curveFound && trades.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Activity size={22} style={{ color: "#333333" }} />
              <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#555555" }}>No trades yet</p>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#444444" }}>Be the first to buy this token.</p>
            </div>
          )}

          {/* Real trades */}
          {trades.map((t, i) => (
            <div
              key={i}
              className="grid grid-cols-5 items-center px-4 py-2.5 text-xs transition-colors"
              style={{ borderBottom: "1px solid #222222" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#1A1A1A"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <span
                className="w-fit px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                style={{
                  background: t.type === "buy" ? "rgba(74,222,128,0.1)" : "rgba(214,40,40,0.1)",
                  border: `1px solid ${t.type === "buy" ? "#4ade80" : "#D62828"}`,
                  color: t.type === "buy" ? "#4ade80" : "#D62828",
                }}
              >
                {t.type}
              </span>
              <a
                href={`https://testnet.bscscan.com/address/${t.walletFull}`}
                target="_blank" rel="noopener noreferrer"
                className="font-mono transition-colors"
                style={{ color: "#555555" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#F5F5F5"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#555555"; }}
              >
                {t.wallet}
              </a>
              <span className="text-right font-mono" style={{ color: "#888888" }}>
                {t.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-right font-mono font-bold" style={{ color: "#F5F5F5" }}>{t.bnbAmount}</span>
              <a
                href={`https://testnet.bscscan.com/tx/${t.txHash}`}
                target="_blank" rel="noopener noreferrer"
                className="text-right transition-colors"
                style={{ color: "#444444" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#888888"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#444444"; }}
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
            <span className="font-mono text-xs" style={{ color: "#888888" }}>
              {token.address.slice(0, 10)}…{token.address.slice(-8)}
            </span>
            <CopyButton text={token.address} />
            <a
              href={`https://testnet.bscscan.com/address/${token.address}`}
              target="_blank" rel="noopener noreferrer"
              style={{ color: "#555555" }}
            >
              <ExternalLink size={11} />
            </a>
          </InfoRow>
          {token.creator && (
            <InfoRow label="Creator">
              <span className="font-mono text-xs" style={{ color: "#888888" }}>
                {token.creator.slice(0, 8)}…{token.creator.slice(-6)}
              </span>
              <CopyButton text={token.creator} />
              <a
                href={`https://testnet.bscscan.com/address/${token.creator}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: "#555555" }}
              >
                <ExternalLink size={11} />
              </a>
            </InfoRow>
          )}
          <InfoRow label="Token Type">
            <span
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
            >
              <cfg.Icon size={9} />
              {cfg.label}
            </span>
          </InfoRow>
          {token.agentId != null && (
            <InfoRow label="Agent ID">
              <span className="font-mono font-bold" style={{ color: "#888888" }}>#{token.agentId.toString()}</span>
            </InfoRow>
          )}
          {token.parentAgent && (
            <InfoRow label="Parent Agent">
              <span className="font-mono font-bold" style={{ color: "#888888" }}>{token.parentAgent}</span>
            </InfoRow>
          )}
          <InfoRow label="Total Supply">
            <span className="font-mono font-bold" style={{ color: "#888888" }}>{totalSupply ?? "—"}</span>
          </InfoRow>
          <InfoRow label="Fee">
            <span className="font-mono font-bold" style={{ color: "#888888" }}>{(token.feeBps ?? 100) / 100}%</span>
          </InfoRow>
          <InfoRow label="Network">
            <span className="font-mono font-bold" style={{ color: "#888888" }}>BNB Chain Testnet</span>
          </InfoRow>
          <InfoRow label="Created">
            <span style={{ color: "#888888" }}>{new Date(token.createdAt).toLocaleDateString(undefined, {
              year: "numeric", month: "short", day: "numeric",
            })}</span>
          </InfoRow>
          <InfoRow label="Curve Type">
            <span className="font-mono font-bold" style={{ color: "#888888" }}>xy=k (constant product)</span>
          </InfoRow>
          <InfoRow label="Virtual BNB">
            <span className="font-mono font-bold" style={{ color: "#888888" }}>10 BNB</span>
          </InfoRow>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid #222222" }}>
      <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#555555" }}>{label}</span>
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
  const publicClient = usePublicClient({ chainId: bscTestnet.id });
  const [holders, setHolders] = useState<number | null>(null);

  // ── Discover bonding curve address ───────────────────────────────────────
  const [curveAddress, setCurveAddress] = useState<`0x${string}` | undefined>(
    token.curveAddress
  );
  const [curveLoading, setCurveLoading] = useState(!token.curveAddress);

  useEffect(() => {
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
        const unique = new Set(
          logs
            .map((l: any) => l.args?.to as string | undefined)
            .filter((a): a is string => !!a && a !== "0x0000000000000000000000000000000000000000")
        );
        setHolders(unique.size);
      } catch {
        // Non-critical
      }
    })();
    return () => { cancelled = true; };
  }, [token.address, publicClient]);

  // ── Batch on-chain reads ──────────────────────────────────────────────────
  const repAddr = ADDRESSES.reputationEngine;
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

  type RepTuple = { score: bigint; launchTime: bigint; graduated: boolean; snapshotBNBRaised: bigint; snapshotTokensSold: bigint };
  const repData  = repSlot >= 0 ? (chainMeta?.[repSlot]?.result as RepTuple | undefined) : undefined;
  const chainRepScore    = repData?.score        ?? undefined;
  const chainLaunchTime  = repData?.launchTime   ?? undefined;
  const chainGraduated   = repData?.graduated    ?? undefined;
  const repBNBRaised     = repData?.snapshotBNBRaised   ?? 0n;
  const repTokensSold    = repData?.snapshotTokensSold  ?? 0n;

  const detectedType: Token["type"] =
    chainSkillId != null && chainSkillId !== ZERO_BYTES32
      ? "skill"
      : chainAgentId != null
        ? "agent"
        : "normal";

  const cfg = TYPE_CONFIG[detectedType];

  const totalSupplyDisplay = chainSupply != null
    ? Number(formatEther(chainSupply)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "—";

  const snapshotProgress = repBNBRaised > 0n
    ? Math.min(100, Math.round(Number(repBNBRaised * 100n) / Number(GRADUATION_TARGET_WEI)))
    : 0;

  const VIRTUAL_BNB = BigInt(10) * BigInt(1e18);
  const snapshotPriceBNB = (chainSupply != null && chainSupply > repTokensSold)
    ? Number(VIRTUAL_BNB + repBNBRaised) / Number(chainSupply - repTokensSold)
    : 0;

  // ── Live on-chain reads ──────────────────────────────────────────────────

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

  const livePriceBNB = livePrice != null ? parseFloat(formatEther(livePrice)) : 0;
  const isGraduated  = liveGraduated ?? token.isGraduated;

  const finalPrice       = livePriceBNB > 0 ? livePriceBNB : snapshotPriceBNB;
  const finalProgress    = liveProgress != null ? Number(liveProgress) : snapshotProgress;
  const finalIsGraduated = chainGraduated ?? isGraduated;
  const finalCreatedAt   = chainLaunchTime && chainLaunchTime > 0n
    ? Number(chainLaunchTime) * 1000
    : token.createdAt;
  const finalMarketCap = chainSupply != null && finalPrice > 0
    ? Number(formatEther(chainSupply)) * finalPrice * liveBNBUSD
    : token.marketCap;

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

  // ── Compute real 24h stats ───────────────────────────────────────────────
  const MS_24H = 86_400_000;
  const now24 = Date.now();

  const liveVolume24h = chartEvents
    .filter((e) => e.ts >= now24 - MS_24H)
    .reduce((s, e) => s + e.bnbAmount * liveBNBUSD, 0);

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
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider transition-colors group"
        style={{ color: "#555555" }}
        onMouseEnter={e => { e.currentTarget.style.color = "#F5C220"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#555555"; }}
      >
        <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to Explore
      </Link>

      {/* ── Token header ────────────────────────────────────────────────────── */}
      <div
        className="mb-6 p-4"
        style={{ background: "#1A1A1A", border: "1px solid #333333", borderLeft: `4px solid ${cfg.color}` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="flex h-14 w-14 items-center justify-center text-3xl"
              style={{ background: "#222222", border: `2px solid ${cfg.border}` }}
            >
              {detectedType === "agent" ? "🤖" : detectedType === "skill" ? "🧩" : "🟡"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight" style={{ color: "#F5F5F5", letterSpacing: "-0.02em" }}>{chainName}</h1>
                {/* Type badge */}
                <span
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
                >
                  <cfg.Icon size={9} />
                  {cfg.label}
                </span>
                {isGraduated && (
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ background: "#4ade80", color: "#0F0F0F" }}>
                    GRADUATED
                  </span>
                )}
                {!curveAddress && (
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ background: "#222222", color: "#555555", border: "1px solid #333333" }}>
                    MOCK
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span className="font-bold" style={{ color: "#888888" }}>${chainSymbol}</span>
                <span className="flex items-center gap-1 font-mono" style={{ color: "#444444" }}>
                  {shortAddr}
                  <CopyButton text={token.address} />
                </span>
                <a
                  href={`https://testnet.bscscan.com/address/${token.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 transition-colors"
                  style={{ color: "#444444" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#888888"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#444444"; }}
                >
                  BscScan <ExternalLink size={10} />
                </a>
              </div>
            </div>
          </div>

          {/* Price + change */}
          <div className="flex flex-col items-end gap-1">
            <p className="font-mono text-3xl font-black" style={{ color: "#F5F5F5" }}>
              {fmtUSD(finalPrice * liveBNBUSD)}
            </p>
            <p className="font-mono text-xs" style={{ color: "#444444" }}>
              {finalPrice.toFixed(10)} BNB
            </p>
            <div
              className="flex items-center gap-1 text-sm font-bold"
              style={{ color: isUp ? "#4ade80" : "#D62828" }}
            >
              {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {isUp ? "+" : ""}{livePriceChange24h.toFixed(2)}% (24h)
            </div>
            {!isGraduated && (
              <div
                className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5"
                style={{ background: "#222222", border: "1px solid #333333" }}
              >
                <Flame size={9} style={{ color: "#F5C220" }} />
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#888888" }}>
                  {finalProgress}% to graduation
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick stats strip ────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-0 sm:grid-cols-4" style={{ border: "1px solid #333333" }}>
        <div style={{ borderRight: "1px solid #333333" }}>
          <StatPill label="Market Cap" value={fmtUSD(liveToken.marketCap, true)} icon={<TrendingUp size={9} />} />
        </div>
        <div style={{ borderRight: "1px solid #333333" }}>
          <StatPill label="24h Volume" value={fmtUSD(liveVolume24h, true)} icon={<Activity size={9} />} accent="#4ade80" />
        </div>
        <div style={{ borderRight: "1px solid #333333" }}>
          <StatPill
            label="Holders"
            value={(holders ?? liveToken.holders).toLocaleString()}
            icon={<span style={{ fontSize: 9 }}>👥</span>}
          />
        </div>
        <div>
          <StatPill
            label="Rep Score"
            value={`${liveToken.reputationScore}/100`}
            icon={<span style={{ fontSize: 9 }}>⭐</span>}
            accent={
              liveToken.reputationScore >= 75 ? "#4ade80"
                : liveToken.reputationScore >= 50 ? "#F5C220"
                  : "#D62828"
            }
          />
        </div>
      </div>

      {/* Description */}
      {token.description && (
        <div className="mb-6 flex gap-3">
          <div className="w-1 flex-shrink-0 self-stretch" style={{ background: "#F5C220" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>{token.description}</p>
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

        {/* ── Left: chart + curve + trades ──────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Price chart */}
          <div style={{ background: "#1A1A1A", border: "1px solid #333333", borderTop: "3px solid #1B4EF8", padding: "20px" }}>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center" style={{ background: "#222222" }}>
                <Activity size={12} style={{ color: "#1B4EF8" }} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>Price Chart</h3>
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
          <div style={{ background: "#1A1A1A", border: "1px solid #333333", padding: "16px" }}>
            <h4 className="flex items-center gap-2 mb-3 text-xs font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>
              <span className="h-3 w-1" style={{ background: "#F5C220" }} />
              Details
            </h4>
            {[
              { label: "Supply",       value: totalSupplyDisplay },
              { label: "Platform fee", value: `${(token.feeBps ?? 100) / 100}%` },
              { label: "Curve",        value: "xy=k" },
              { label: "Network",      value: "BNB Chain" },
              ...(token.agentId != null ? [{ label: "Agent ID", value: `#${token.agentId}` }] : []),
              ...(token.parentAgent ? [{ label: "Parent Agent", value: "Agent" }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2" style={{ borderBottom: "1px solid #222222" }}>
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#555555" }}>{label}</span>
                <span className="font-mono text-xs font-bold" style={{ color: "#888888" }}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2">
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#555555" }}>Created</span>
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: "#888888" }}>
                <Clock size={9} />
                {timeAgo(token.createdAt)}
              </span>
            </div>
            {!isGraduated && (
              <div className="mt-3 p-2.5" style={{ background: "#222222", border: "1px solid #333333", borderLeft: "3px solid #F5C220" }}>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "#888888" }}>
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
