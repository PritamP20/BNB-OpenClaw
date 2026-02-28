"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Info,
  Flame,
  Puzzle,
  Cpu,
  Zap,
  Shield,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Globe,
  Star,
  Users,
  Loader2,
} from "lucide-react";
import {
  useReadContract,
  useReadContracts,
  usePublicClient,
  useAccount,
} from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatEther } from "viem";
import type { Token } from "../../../hooks/useTokens";
import { timeAgo } from "../../../lib/mock-data";
import { PriceChart } from "../../../components/PriceChart";
import { BuySellPanel } from "../../../components/BuySellPanel";
import { ReputationScore } from "../../../components/ReputationScore";
import {
  BONDING_CURVE_ABI,
  ERC20_ABI,
  REPUTATION_ENGINE_ABI,
  ADDRESSES,
} from "../../../lib/contracts";
import { fmtUSD, BNB_USD } from "../../../lib/chart-data";
import { fetchAllLogs } from "../../../lib/fetchLogs";
import { useTrades } from "../../../hooks/useTrades";

// ── Mini ABIs ─────────────────────────────────────────────────────────────────

const AGENT_DETECT_ABI = [
  { name: "agentId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

const CREATOR_ABI = [
  { name: "creator", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

const REGISTRY_ABI = [
  {
    name: "getAgentRecord",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "agentToken", type: "address" }, { name: "skillTokens", type: "address[]" }],
  },
] as const;

const SKILL_ABI = [
  { name: "name",        type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string"  }] },
  { name: "symbol",      type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string"  }] },
  { name: "costPerUse",  type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "verifySkillAccess", type: "function", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "bool" }] },
] as const;

const TRANSFER_EVENT = {
  name: "Transfer", type: "event",
  inputs: [
    { name: "from",  type: "address", indexed: true },
    { name: "to",    type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

type RepTuple = {
  score: bigint;
  launchTime: bigint;
  graduated: boolean;
  snapshotBNBRaised: bigint;
  snapshotTokensSold: bigint;
};

const GRADUATION_TARGET_WEI = BigInt(69) * BigInt(1e18);
const VIRTUAL_BNB = BigInt(10) * BigInt(1e18);

// ── Skill categories mapping (heuristic by symbol suffix) ────────────────────

const SKILL_ICONS: Record<string, string> = {
  RAG: "📡", DEBUG: "🔧", TRADE: "📈", RESEARCH: "🔬",
  VISION: "👁️", SPEECH: "🎤", CODE: "💻", DATA: "📊",
  AUDIT: "🛡️", SOCIAL: "🌐", LEARN: "🧠", PLAN: "🗂️",
};

function getSkillIcon(symbol: string): string {
  const key = Object.keys(SKILL_ICONS).find((k) => symbol.toUpperCase().includes(k));
  return key ? SKILL_ICONS[key]! : "🧩";
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-gray-600 hover:text-gray-400 transition-colors"
    >
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
    </button>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function StatPill({
  label, value, accent, sub, icon,
}: {
  label: string; value: string; accent?: string; sub?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="group flex flex-col items-center rounded-xl border border-white/[0.04] glass px-4 py-3 text-center transition-all duration-200 hover:border-white/[0.08] ">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-gray-600 group-hover:text-gray-500 transition-colors">
        {icon && <span className="opacity-60">{icon}</span>}
        {label}
      </div>
      <span className={`mt-1 font-mono text-base font-bold ${accent ?? "text-white"}`}>{value}</span>
      {sub && <span className="mt-0.5 text-[10px] text-gray-600">{sub}</span>}
    </div>
  );
}

// ── Bonding Curve Bar ──────────────────────────────────────────────────────────

const MILESTONES = [
  { pct: 25, label: "Early", color: "bg-blue-400" },
  { pct: 50, label: "Growing", color: "bg-bnb-yellow" },
  { pct: 75, label: "Hot 🔥", color: "bg-orange-400" },
  { pct: 100, label: "Grad 🎓", color: "bg-green-400" },
];

function BondingCurveBar({
  token, liveProgress, liveBNBRaised,
}: {
  token: Token; liveProgress?: number; liveBNBRaised?: bigint;
}) {
  const progress = liveProgress ?? token.graduationProgress;
  const bnbRaised = liveBNBRaised != null
    ? parseFloat(formatEther(liveBNBRaised)).toFixed(2)
    : ((token.graduationProgress / 100) * 69).toFixed(2);

  const barColor =
    progress >= 75 ? "from-orange-500 to-green-500"
      : progress >= 50 ? "from-bnb-yellow to-orange-400"
        : "from-blue-500 to-bnb-yellow";

  return (
    <div className="rounded-2xl border border-white/[0.04] glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Bonding Curve</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
          token.isGraduated ? "bg-green-400/10 text-green-400"
            : progress >= 75 ? "bg-orange-400/10 text-orange-400"
              : "bg-bnb-yellow/10 text-bnb-yellow"
          }`}>
          {token.isGraduated ? "Graduated 🎓" : `${progress}%`}
        </span>
      </div>
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
        {MILESTONES.slice(0, -1).map(({ pct }) => (
          <div key={pct} className="absolute top-0 h-full w-px bg-white/10" style={{ left: `${pct}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between px-0.5 text-[10px] text-gray-600">
        {MILESTONES.map(({ pct, label }) => (
          <span key={pct} className={progress >= pct ? "text-gray-400 font-medium" : ""}>{label}</span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg glass border border-white/[0.04] p-2.5 text-center hover:border-white/[0.08] transition-colors">
          <p className="text-gray-600">BNB Raised</p>
          <p className="font-mono font-bold text-bnb-yellow mt-0.5">{bnbRaised} BNB</p>
        </div>
        <div className="rounded-lg glass border border-white/[0.04] p-2.5 text-center hover:border-white/[0.08] transition-colors">
          <p className="text-gray-600">Target</p>
          <p className="font-mono font-bold text-white mt-0.5">69 BNB</p>
        </div>
        <div className="rounded-lg glass border border-white/[0.04] p-2.5 text-center hover:border-white/[0.08] transition-colors">
          <p className="text-gray-600">Remaining</p>
          <p className="font-mono font-bold text-bnb-yellow mt-0.5">
            {(69 - parseFloat(bnbRaised)).toFixed(2)} BNB
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Trade History ──────────────────────────────────────────────────────────────

function TradeHistory({ token, totalSupply }: { token: Token; totalSupply?: string }) {
  const [tab, setTab] = useState<"trades" | "info">("trades");
  const { trades, loading, fetched, curveFound } = useTrades(token.address);

  return (
    <div className="rounded-2xl border border-white/[0.04] glass">
      <div className="flex items-center gap-0.5 border-b border-white/[0.04] p-2">
        {(["trades", "info"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-150 ${
              tab === t
                ? "bg-bnb-yellow/10 text-bnb-yellow border border-bnb-yellow/25"
                : "text-gray-500 border border-transparent hover:text-bnb-yellow/70"
            }`}
          >
            {t === "trades" ? <><Activity size={12} /> Trades</> : <><Info size={12} /> Token Info</>}
          </button>
        ))}
      </div>

      {tab === "trades" && (
        <div className="flex flex-col divide-y divide-white/[0.04]">
          <div className="grid grid-cols-5 px-4 py-2 text-[10px] uppercase tracking-widest text-gray-600">
            <span>Type</span><span>Wallet</span>
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
              <p className="text-xs text-gray-700">This agent token has no on-chain bonding curve.</p>
            </div>
          )}

          {/* Real curve, zero events */}
          {fetched && !loading && curveFound && trades.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Activity size={24} className="text-gray-700" />
              <p className="text-sm font-medium text-gray-500">No trades yet</p>
              <p className="text-xs text-gray-700">Be the first to buy this agent token.</p>
            </div>
          )}

          {/* Real trades */}
          {trades.map((t, i) => (
            <div key={i} className="grid grid-cols-5 items-center px-4 py-2.5 text-xs hover:bg-bnb-yellow/[0.025] transition-colors">
              <span className={`w-fit rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                t.type === "buy"
                  ? "bg-green-400/10 text-green-400 shadow-[0_0_8px_rgba(74,222,128,0.2)]"
                  : "bg-red-400/10 text-red-400 shadow-[0_0_8px_rgba(248,113,113,0.2)]"
              }`}>{t.type}</span>
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
        <div className="flex flex-col gap-3 p-5 text-sm">
          <InfoRow label="Contract">
            <span className="font-mono text-xs text-gray-300">{token.address.slice(0,10)}…{token.address.slice(-8)}</span>
            <CopyButton text={token.address} />
            <a href={`https://testnet.bscscan.com/address/${token.address}`} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400"><ExternalLink size={11} /></a>
          </InfoRow>
          {token.creator && (
            <InfoRow label="Creator">
              <span className="font-mono text-xs text-gray-300">{token.creator.slice(0,8)}…{token.creator.slice(-6)}</span>
              <CopyButton text={token.creator} />
            </InfoRow>
          )}
          <InfoRow label="Token Type">
            <span className="flex items-center gap-1 rounded-full border border-purple-400/20 bg-purple-400/10 px-2 py-0.5 text-xs font-medium text-purple-400">
              <Bot size={10} /> AI Agent
            </span>
          </InfoRow>
          {token.agentId != null && (
            <InfoRow label="Agent ID">
              <span className="font-mono text-gray-300">#{token.agentId.toString()}</span>
            </InfoRow>
          )}
          <InfoRow label="Total Supply">
            <span className="font-mono text-gray-300">{totalSupply ?? "—"}</span>
          </InfoRow>
          <InfoRow label="Platform Fee">
            <span className="font-mono text-gray-300">{(token.feeBps ?? 100) / 100}%</span>
          </InfoRow>
          <InfoRow label="Network">
            <span className="flex items-center gap-1 text-gray-300">
              <span className="h-2 w-2 rounded-full bg-bnb-yellow animate-pulse" /> BNB Chain Testnet
            </span>
          </InfoRow>
          <InfoRow label="Created">
            <span className="text-gray-300">{new Date(token.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
          </InfoRow>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Skill Branch Graph ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

interface SkillInfo {
  address: `0x${string}`;
  name: string;
  symbol: string;
  costPerUse: bigint;
  hasAccess: boolean;
}

function SkillBranchGraph({
  agentTokenAddress,
  agentName,
  agentSymbol,
}: {
  agentTokenAddress: `0x${string}`;
  agentName: string;
  agentSymbol: string;
}) {
  const { address: userAddress } = useAccount();
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);
  const registryAddr = ADDRESSES.agentRegistry;

  // Animate pulse
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => (p + 1) % 100), 50);
    return () => clearInterval(id);
  }, []);

  // 1. agentId from AgentToken
  const { data: agentId } = useReadContract({
    address: agentTokenAddress,
    abi: AGENT_DETECT_ABI,
    functionName: "agentId",
    chainId: bscTestnet.id,
  });

  // 2. skill addresses from registry
  const { data: agentRecord } = useReadContract({
    address: registryAddr,
    abi: REGISTRY_ABI,
    functionName: "getAgentRecord",
    args: agentId != null ? [agentId] : undefined,
    chainId: bscTestnet.id,
    query: { enabled: agentId != null && !!registryAddr },
  });

  const skillAddresses = ((agentRecord as [string, string[]] | undefined)?.[1] ?? []) as `0x${string}`[];

  // 3. batch-read skill metadata
  const perSkill = userAddress ? 4 : 3;
  const skillCalls = skillAddresses.flatMap((addr) => [
    { address: addr, abi: SKILL_ABI, functionName: "name" as const, chainId: bscTestnet.id },
    { address: addr, abi: SKILL_ABI, functionName: "symbol" as const, chainId: bscTestnet.id },
    { address: addr, abi: SKILL_ABI, functionName: "costPerUse" as const, chainId: bscTestnet.id },
    ...(userAddress
      ? [{ address: addr, abi: SKILL_ABI, functionName: "verifySkillAccess" as const, args: [userAddress] as [`0x${string}`], chainId: bscTestnet.id }]
      : []),
  ]);

  const { data: skillResults } = useReadContracts({
    contracts: skillCalls,
    query: { enabled: skillAddresses.length > 0 },
  });

  const skills: SkillInfo[] = skillAddresses.map((addr, i) => {
    const base = i * perSkill;
    return {
      address: addr,
      name: (skillResults?.[base]?.result as string | undefined) ?? addr.slice(0, 6) + "…",
      symbol: (skillResults?.[base + 1]?.result as string | undefined) ?? "???",
      costPerUse: (skillResults?.[base + 2]?.result as bigint | undefined) ?? 0n,
      hasAccess: userAddress
        ? ((skillResults?.[base + 3]?.result as boolean | undefined) ?? false)
        : false,
    };
  });

  // ── SVG geometry ──────────────────────────────────────────────────────────

  const W = 700, H = 380;
  const cx = W / 2, cy = H / 2;
  const n = skills.length;

  // Radial positions — spread evenly around the agent core
  const positions = skills.map((_, i) => {
    const minR = 155, maxR = n > 6 ? 175 : 155;
    const r = i % 2 === 0 ? minR : maxR;
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  // Animated dash offset for connection lines
  const dashOffset = -(pulse * 0.4);

  const selectedSkill = selected !== null ? skills[selected] : null;

  if (!registryAddr) return null;

  return (
    <div className="rounded-2xl border border-white/[0.04] glass p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-400/10 text-purple-400">
              <Cpu size={13} />
            </span>
            Skill Branch Graph
          </h3>
          <p className="mt-0.5 text-xs text-gray-600">
            {n > 0
              ? `${n} skill module${n !== 1 ? "s" : ""} connected to this agent`
              : "No skill modules deployed yet — be the first to build one"}
          </p>
        </div>
        {userAddress && n > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-white/[0.04] bg-[#060608] px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-green-400 font-mono">{skills.filter((s) => s.hasAccess).length}</span>
            <span className="text-gray-600">/ {n} accessible</span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {n === 0 ? (
        <div className="flex flex-col items-center gap-4 py-14">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-purple-400/20 animate-pulse" />
            <div className="absolute inset-3 rounded-full border border-white/[0.04]" />
            <span className="text-4xl">🤖</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-200">{agentName}</p>
            <p className="mt-1 text-xs text-gray-600 max-w-xs">
              This agent has no skill modules yet. Skill tokens can be deployed by developers to extend the agent&apos;s capabilities.
            </p>
          </div>
          <Link
            href="/launch"
            className="mt-1 flex items-center gap-1.5 rounded-full border border-bnb-yellow/30 bg-bnb-yellow/10 px-4 py-1.5 text-xs font-semibold text-bnb-yellow transition-all hover:bg-bnb-yellow/20"
          >
            <Zap size={12} /> Deploy a Skill Module
          </Link>
        </div>
      ) : (
        <>
          {/* SVG graph */}
          <div className="relative overflow-hidden rounded-xl border border-white/[0.04] bg-[#0a0a0d]">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 380 }}>
              <defs>
                {/* Agent glow */}
                <radialGradient id="agentGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f0b90b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f0b90b" stopOpacity="0" />
                </radialGradient>

                {/* Green glow for accessible */}
                <radialGradient id="greenGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </radialGradient>

                {/* Glow filter */}
                <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Strong glow */}
                <filter id="strongGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Connection line gradients */}
                {positions.map((pos, i) => (
                  <linearGradient
                    key={`lg-${i}`}
                    id={`lineGrad-${i}`}
                    x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#f0b90b" stopOpacity="0.8" />
                    <stop offset="100%" stopColor={skills[i]?.hasAccess ? "#22c55e" : "#6b21a8"} stopOpacity="0.6" />
                  </linearGradient>
                ))}

                {/* Animated pulse gradient for active connections */}
                <linearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f0b90b" stopOpacity="0" />
                  <stop offset="50%" stopColor="#f0b90b" stopOpacity="1" />
                  <stop offset="100%" stopColor="#f0b90b" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Subtle radial grid rings */}
              {[60, 110, 165].map((r) => (
                <circle
                  key={r} cx={cx} cy={cy} r={r}
                  fill="none" stroke="white" strokeOpacity={0.03} strokeWidth={1}
                />
              ))}

              {/* Connection lines */}
              {positions.map((pos, i) => {
                const skill = skills[i];
                if (!skill) return null;
                const isHov = hovered === i || selected === i;
                const isAcc = skill.hasAccess;

                return (
                  <g key={`line-${i}`}>
                    {/* Base glow line */}
                    <line
                      x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                      stroke={isAcc ? "#22c55e" : "#f0b90b"}
                      strokeWidth={2.5}
                      strokeOpacity={0.05}
                    />
                    {/* Gradient line */}
                    <line
                      x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                      stroke={`url(#lineGrad-${i})`}
                      strokeWidth={isHov ? 2 : 1.2}
                      strokeDasharray={isAcc ? "none" : "6 4"}
                      strokeDashoffset={isAcc ? undefined : dashOffset}
                      strokeOpacity={isHov ? 1 : 0.45}
                    />
                    {/* Traveling pulse dot on accessible lines */}
                    {isAcc && (
                      <circle r={3} fill="#f0b90b" opacity={0.9} filter="url(#glow)">
                        <animateMotion
                          dur="2.5s"
                          repeatCount="indefinite"
                          path={`M ${cx} ${cy} L ${pos.x} ${pos.y}`}
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* Agent center — large glow */}
              <circle cx={cx} cy={cy} r={80} fill="url(#agentGlow)" />

              {/* Agent center ring animations */}
              <circle cx={cx} cy={cy} r={50}
                fill="none" stroke="#f0b90b" strokeWidth={1} strokeOpacity={0.12}
              >
                <animate attributeName="r" values="48;54;48" dur="3s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.12;0.22;0.12" dur="3s" repeatCount="indefinite" />
              </circle>

              {/* Agent center node */}
              <circle cx={cx} cy={cy} r={42} fill="#060608" stroke="#f0b90b" strokeWidth={2.5} filter="url(#glow)" />
              <circle cx={cx} cy={cy} r={38} fill="#111117" stroke="#f0b90b" strokeWidth={0.5} strokeOpacity={0.3} />

              <text x={cx} y={cy - 9}  textAnchor="middle" fontSize={22} dominantBaseline="middle">🤖</text>
              <text x={cx} y={cy + 18} textAnchor="middle" fontSize={9}
                fill="#f0b90b" fontFamily="monospace" fontWeight="700" letterSpacing="1">
                {agentSymbol.slice(0, 8)}
              </text>

              {/* Agent ID badge */}
              <rect x={cx - 18} y={cy + 28} width={36} height={11} rx={5.5}
                fill="#f0b90b" fillOpacity={0.15} />
              <text x={cx} y={cy + 34.5} textAnchor="middle" fontSize={6.5}
                fill="#f0b90b" fontFamily="monospace" dominantBaseline="middle">
                AI AGENT
              </text>

              {/* Skill nodes */}
              {positions.map((pos, i) => {
                const skill = skills[i];
                if (!skill) return null;
                const isHov   = hovered === i;
                const isSel   = selected === i;
                const isAcc   = skill.hasAccess;
                const nodeCol = isAcc ? "#22c55e" : isHov || isSel ? "#f0b90b" : "#6b21a8";
                const textCol = isAcc ? "#4ade80" : isHov || isSel ? "#f0b90b" : "#9ca3af";
                const icon    = getSkillIcon(skill.symbol);

                return (
                  <g
                    key={`node-${i}`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected(selected === i ? null : i)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Outer glow ring */}
                    {(isHov || isSel || isAcc) && (
                      <circle
                        cx={pos.x} cy={pos.y} r={40}
                        fill={isAcc ? "url(#greenGlow)" : "url(#agentGlow)"}
                      />
                    )}

                    {/* Pulsing ring on hover/select */}
                    {(isHov || isSel) && (
                      <circle
                        cx={pos.x} cy={pos.y} r={33}
                        fill="none"
                        stroke={isAcc ? "#22c55e" : "#f0b90b"}
                        strokeWidth={1}
                        strokeOpacity={0.4}
                      >
                        <animate attributeName="r" values="30;36;30" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Node circle */}
                    <circle
                      cx={pos.x} cy={pos.y} r={28}
                      fill="#0d0d10"
                      stroke={nodeCol}
                      strokeWidth={isHov || isSel ? 2.5 : 1.5}
                      filter={(isHov || isSel) ? "url(#strongGlow)" : undefined}
                    />

                    {/* Inner subtle fill */}
                    <circle
                      cx={pos.x} cy={pos.y} r={25}
                      fill={isAcc ? "#14532d" : isHov || isSel ? "#2d1a00" : "#120d1a"}
                      fillOpacity={0.5}
                    />

                    {/* Skill icon */}
                    <text x={pos.x} y={pos.y - 7} textAnchor="middle" fontSize={14} dominantBaseline="middle">
                      {icon}
                    </text>

                    {/* Symbol */}
                    <text x={pos.x} y={pos.y + 8} textAnchor="middle" fontSize={7.5}
                      fill={textCol} fontFamily="monospace" fontWeight="700">
                      ${skill.symbol.slice(0, 7)}
                    </text>

                    {/* Access badge */}
                    <text x={pos.x} y={pos.y + 18} textAnchor="middle" fontSize={6}
                      fill={isAcc ? "#4ade80" : "#6b7280"} fontFamily="sans-serif">
                      {isAcc ? "✓ unlocked" : "🔒 locked"}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Skill count badge overlay */}
            <div className="absolute top-3 right-3 rounded-full border border-white/[0.04] glass/80 px-2.5 py-1 text-[11px] font-mono text-gray-500 backdrop-blur">
              {n} skill{n !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Selected skill detail panel */}
          {selectedSkill && (
            <div className="mt-3 rounded-xl border border-bnb-yellow/20 bg-bnb-yellow/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl glass text-xl border border-white/[0.04]">
                    {getSkillIcon(selectedSkill.symbol)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{selectedSkill.name}</p>
                    <p className="text-xs text-gray-500">${selectedSkill.symbol}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {!userAddress ? (
                    <span className="text-gray-600">Connect wallet to check access</span>
                  ) : selectedSkill.hasAccess ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-400/10 px-2 py-0.5 text-green-400 font-medium">
                      <Unlock size={10} /> Access Granted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-red-400/10 px-2 py-0.5 text-red-400 font-medium">
                      <Lock size={10} /> No Access
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg glass p-2.5">
                  <p className="text-gray-600">Cost Per Use</p>
                  <p className="mt-0.5 font-mono font-bold text-white">
                    {selectedSkill.costPerUse === 0n
                      ? "Free"
                      : `${formatEther(selectedSkill.costPerUse)} ${selectedSkill.symbol}`}
                  </p>
                </div>
                <div className="rounded-lg glass p-2.5">
                  <p className="text-gray-600">Contract</p>
                  <p className="mt-0.5 font-mono text-gray-400 truncate">
                    {selectedSkill.address.slice(0, 10)}…{selectedSkill.address.slice(-6)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <Link
                  href={`/token/${selectedSkill.address}`}
                  className="flex items-center gap-1.5 rounded-full bg-bnb-yellow/10 border border-bnb-yellow/20 px-3 py-1 text-xs font-semibold text-bnb-yellow hover:bg-bnb-yellow/20 transition-all"
                >
                  View Skill Token <ExternalLink size={10} />
                </Link>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-gray-600 hover:text-white transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Skill list */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-600">Skill Modules</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {skills.map((skill, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(selected === i ? null : i)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    selected === i
                      ? "border-bnb-yellow/40 bg-bnb-yellow/5"
                      : "border-white/[0.04] bg-[#060608] hover:border-white/[0.04]/80 hover:bg-white/[0.03]"
                  }`}
                >
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border text-lg ${
                    skill.hasAccess
                      ? "border-green-400/20 bg-green-400/10"
                      : "border-purple-400/20 bg-purple-400/10"
                  }`}>
                    {getSkillIcon(skill.symbol)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{skill.name}</p>
                    <p className="text-[11px] text-gray-600">${skill.symbol}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {skill.hasAccess ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-400">
                        <Unlock size={9} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-600">
                        <Lock size={9} /> Locked
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-gray-600">
                      {skill.costPerUse === 0n ? "Free" : formatEther(skill.costPerUse).slice(0, 7)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-5 text-[11px] text-gray-600">
            <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-green-500 inline-block" /> Active connection</span>
            <span className="flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-purple-700 inline-block" /> Locked skill</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-bnb-yellow inline-block" /> Traveling pulse = active data flow</span>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Main Agent Page ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function AgentPageClient({ token }: { token: Token }) {
  const shortAddr = `${token.address.slice(0, 8)}…${token.address.slice(-6)}`;

  const publicClient = usePublicClient({ chainId: bscTestnet.id });
  const [holders, setHolders] = useState<number | null>(null);

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((l: any) => l.args?.to as string | undefined)
            .filter((a): a is string => !!a && a !== "0x0000000000000000000000000000000000000000")
        );
        setHolders(unique.size);
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [token.address, publicClient]);

  // On-chain reads
  const repAddr = ADDRESSES.reputationEngine;
  const { data: chainMeta } = useReadContracts({
    contracts: [
      { address: token.address, abi: ERC20_ABI,              functionName: "name"        },
      { address: token.address, abi: ERC20_ABI,              functionName: "symbol"      },
      { address: token.address, abi: ERC20_ABI,              functionName: "totalSupply" },
      { address: token.address, abi: AGENT_DETECT_ABI,       functionName: "agentId"     },
      ...(repAddr ? [{ address: repAddr, abi: REPUTATION_ENGINE_ABI, functionName: "getReputation", args: [token.address] }] : []),
      { address: token.address, abi: CREATOR_ABI,            functionName: "creator"     },
    ] as any,
    allowFailure: true,
  });

  const repSlot     = repAddr ? 4 : -1;
  const creatorSlot = repAddr ? 5 : 4;

  const chainName    = (chainMeta?.[0]?.result as string | undefined) ?? token.name;
  const chainSymbol  = (chainMeta?.[1]?.result as string | undefined) ?? token.symbol;
  const chainSupply  = chainMeta?.[2]?.result as bigint | undefined;
  const chainAgentId = chainMeta?.[3]?.result as bigint | undefined;
  const chainCreator = chainMeta?.[creatorSlot]?.result as `0x${string}` | undefined;

  const repData         = repSlot >= 0 ? (chainMeta?.[repSlot]?.result as RepTuple | undefined) : undefined;
  const chainRepScore   = repData?.score ?? undefined;
  const chainLaunchTime = repData?.launchTime ?? undefined;
  const chainGraduated  = repData?.graduated ?? undefined;
  const repBNBRaised    = repData?.snapshotBNBRaised ?? 0n;
  const repTokensSold   = repData?.snapshotTokensSold ?? 0n;

  const snapshotProgress = repBNBRaised > 0n
    ? Math.min(100, Math.round(Number(repBNBRaised * 100n) / Number(GRADUATION_TARGET_WEI)))
    : 0;

  const snapshotPriceBNB = chainSupply != null && chainSupply > repTokensSold
    ? Number(VIRTUAL_BNB + repBNBRaised) / Number(chainSupply - repTokensSold)
    : 0;

  // Live curve reads
  const { data: liveProgress  } = useReadContract({ address: token.curveAddress, abi: BONDING_CURVE_ABI, functionName: "graduationProgress", query: { enabled: !!token.curveAddress, refetchInterval: 30_000 } });
  const { data: liveBNBRaised } = useReadContract({ address: token.curveAddress, abi: BONDING_CURVE_ABI, functionName: "bnbRaised",          query: { enabled: !!token.curveAddress, refetchInterval: 30_000 } });
  const { data: livePrice     } = useReadContract({ address: token.curveAddress, abi: BONDING_CURVE_ABI, functionName: "getPrice",           query: { enabled: !!token.curveAddress, refetchInterval: 30_000 } });
  const { data: liveGraduated } = useReadContract({ address: token.curveAddress, abi: BONDING_CURVE_ABI, functionName: "graduated",          query: { enabled: !!token.curveAddress } });

  const livePriceBNB = livePrice != null ? parseFloat(formatEther(livePrice as bigint)) : 0;
  const isGraduated  = (liveGraduated as boolean | undefined) ?? token.isGraduated;

  const finalPrice       = livePriceBNB > 0 ? livePriceBNB : snapshotPriceBNB;
  const finalProgress    = liveProgress != null ? Number(liveProgress) : snapshotProgress;
  const finalIsGraduated = chainGraduated ?? isGraduated;
  const finalCreatedAt   = chainLaunchTime && (chainLaunchTime as bigint) > 0n
    ? Number(chainLaunchTime as bigint) * 1000
    : token.createdAt;
  const finalMarketCap   = chainSupply != null && finalPrice > 0
    ? Number(formatEther(chainSupply)) * finalPrice * BNB_USD
    : token.marketCap;

  const totalSupplyDisplay = chainSupply != null
    ? Number(formatEther(chainSupply)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "—";

  const isUp = token.priceChange24h >= 0;

  const liveToken: Token = {
    ...token,
    name: chainName,
    symbol: chainSymbol,
    type: "agent",
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Back */}
      <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-bnb-yellow/50 hover:text-bnb-yellow transition-colors group">
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Explore
      </Link>

      {/* ── Agent Hero ──────────────────────────────────────────────────────── */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.04] glass">
        {/* Yellow accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-bnb-yellow/80 via-purple-500/60 to-transparent" />

        <div className="p-6">
          <div className="flex flex-wrap items-start gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-bnb-yellow/30 bg-gradient-to-br from-bnb-yellow/10 to-purple-500/10 text-4xl shadow-lg shadow-bnb-yellow/10">
                🤖
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-bnb-card bg-purple-500 text-[9px]">
                <Bot size={9} className="text-white" />
              </span>
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight shimmer-text">{chainName}</h1>
                <span className="flex items-center gap-1 rounded-full border border-purple-400/25 bg-purple-400/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400">
                  <Bot size={10} /> AI Agent
                </span>
                {finalIsGraduated && (
                  <span className="rounded-md bg-green-400/15 px-2 py-0.5 text-xs font-bold text-green-400">GRADUATED</span>
                )}
                {!token.curveAddress && (
                  <span className="rounded-md bg-bnb-yellow/10 px-2 py-0.5 text-[10px] font-medium text-bnb-yellow/60">MOCK</span>
                )}
              </div>

              <p className="mt-1 text-sm text-gray-500">
                <span className="font-medium text-gray-400">${chainSymbol}</span>
                <span className="mx-2 text-gray-700">·</span>
                <span className="font-mono text-gray-700 text-xs">{shortAddr}</span>
                <CopyButton text={token.address} />
                <a href={`https://testnet.bscscan.com/address/${token.address}`} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-xs text-gray-700 hover:text-gray-400 transition-colors">
                  BscScan <ExternalLink size={9} />
                </a>
              </p>

              {/* Description */}
              {token.description ? (
                <div className="mt-3 flex gap-3">
                  <div className="w-0.5 flex-shrink-0 rounded-full bg-bnb-yellow/20 self-stretch" />
                  <p className="text-sm leading-relaxed text-gray-500 max-w-2xl">{token.description}</p>
                </div>
              ) : (
                <div className="mt-3 flex gap-3">
                  <div className="w-0.5 flex-shrink-0 rounded-full bg-bnb-yellow/20 self-stretch" />
                  <p className="text-sm leading-relaxed text-gray-700 max-w-2xl italic">
                    An AI Agent on BNB Chain. This agent can be extended with skill modules and used by token holders for automated tasks, research, trading signals, or custom AI workflows.
                  </p>
                </div>
              )}

              {/* Agent metadata chips */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {chainAgentId != null && (
                  <span className="flex items-center gap-1 rounded-full border border-white/[0.04] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-500">
                    <Cpu size={10} className="text-bnb-yellow" />
                    Agent #{chainAgentId.toString()}
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-full border border-white/[0.04] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-500">
                  <Globe size={10} className="text-blue-400" />
                  BNB Chain Testnet
                </span>
                <span className="flex items-center gap-1 rounded-full border border-white/[0.04] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-500">
                  <Clock size={10} className="text-gray-500" />
                  {timeAgo(finalCreatedAt)}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-white/[0.04] bg-white/[0.03] px-2.5 py-1 text-xs text-gray-500">
                  <Users size={10} className="text-gray-500" />
                  {liveToken.holders.toLocaleString()} holders
                </span>
              </div>
            </div>

            {/* Price panel */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <p className="font-mono text-3xl font-extrabold text-white">{fmtUSD(finalPrice * BNB_USD)}</p>
              <p className="font-mono text-xs text-gray-600">{finalPrice.toFixed(10)} BNB</p>
              <div className={`flex items-center gap-1 text-sm font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
                {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isUp ? "+" : ""}{token.priceChange24h.toFixed(2)}% (24h)
              </div>
              {!finalIsGraduated && (
                <div className="mt-2 rounded-xl bg-bnb-yellow/5 border border-white/[0.04] px-3 py-1.5 text-right">
                  <p className="text-[10px] text-bnb-yellow/70">
                    <Flame size={9} className="inline mr-1" />
                    {finalProgress}% to graduation
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Market Cap" value={fmtUSD(finalMarketCap, true)} icon={<TrendingUp size={9} />} />
        <StatPill label="24h Volume" value={fmtUSD(token.volume24h, true)} icon={<Activity size={9} />} accent="text-green-400" />
        <StatPill label="Holders" value={liveToken.holders.toLocaleString()} icon={<Users size={9} />} />
        <StatPill
          label="Rep Score"
          value={`${liveToken.reputationScore}/100`}
          icon={<Star size={9} />}
          accent={
            liveToken.reputationScore >= 75 ? "text-green-400"
              : liveToken.reputationScore >= 50 ? "text-bnb-yellow"
                : "text-red-400"
          }
          sub={
            liveToken.reputationScore >= 75 ? "Excellent"
              : liveToken.reputationScore >= 50 ? "Good"
                : "Building"
          }
        />
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

        {/* ── Left column ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Price chart */}
          <div className="rounded-2xl border border-white/[0.04] glass p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-bnb-yellow/10 border border-bnb-yellow/20">
                <Activity size={12} className="text-bnb-yellow" />
              </div>
              <h3 className="text-sm font-semibold text-white">Price Chart</h3>
            </div>
            <PriceChart token={liveToken as never} />
          </div>

          {/* Skill Branch Graph (full width, prominent) */}
          <SkillBranchGraph
            agentTokenAddress={token.address as `0x${string}`}
            agentName={chainName}
            agentSymbol={chainSymbol}
          />

          {/* Bonding curve */}
          <BondingCurveBar
            token={liveToken}
            liveProgress={liveProgress != null ? Number(liveProgress) : undefined}
            liveBNBRaised={liveBNBRaised as bigint | undefined}
          />

          {/* Reputation */}
          <ReputationScore token={liveToken} />

          {/* Trade history */}
          <TradeHistory token={liveToken} totalSupply={totalSupplyDisplay} />
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:self-start lg:sticky lg:top-20">
          <BuySellPanel token={liveToken} curveAddress={token.curveAddress} />

          {/* Agent info card */}
          <div className="rounded-2xl border border-white/[0.04] glass p-4 flex flex-col gap-2.5 text-xs">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-bnb-yellow/10">
                <Shield size={11} className="text-bnb-yellow" />
              </span>
              Agent Details
            </h4>

            <InfoRow label="Contract">
              <span className="font-mono text-xs text-gray-300">{token.address.slice(0, 10)}…{token.address.slice(-8)}</span>
              <CopyButton text={token.address} />
            </InfoRow>
            {(chainCreator ?? token.creator) && (
              <InfoRow label="Creator">
                <span className="font-mono text-xs text-gray-300">
                  {((chainCreator ?? token.creator) as string).slice(0, 8)}…{((chainCreator ?? token.creator) as string).slice(-6)}
                </span>
                <CopyButton text={(chainCreator ?? token.creator) as string} />
              </InfoRow>
            )}
            {chainAgentId != null && (
              <InfoRow label="Agent ID">
                <span className="font-mono text-gray-300">#{chainAgentId.toString()}</span>
              </InfoRow>
            )}
            <InfoRow label="Total Supply">
              <span className="font-mono text-gray-300">{totalSupplyDisplay}</span>
            </InfoRow>
            <InfoRow label="Platform Fee">
              <span className="font-mono text-gray-300">{(token.feeBps ?? 100) / 100}%</span>
            </InfoRow>
            <InfoRow label="Curve">
              <span className="font-mono text-gray-300">xy=k</span>
            </InfoRow>
            <InfoRow label="Network">
              <span className="flex items-center gap-1 text-gray-300">
                <span className="h-2 w-2 rounded-full bg-bnb-yellow animate-pulse" /> BNB Chain
              </span>
            </InfoRow>
            <InfoRow label="Created">
              <span className="text-gray-300 flex items-center gap-1">
                <Clock size={10} /> {timeAgo(finalCreatedAt)}
              </span>
            </InfoRow>

            {!finalIsGraduated && (
              <div className="mt-1 rounded-xl bg-bnb-yellow/5 border border-white/[0.04] px-3 py-2">
                <p className="text-[10px] text-bnb-yellow/70">
                  <Flame size={10} className="inline mr-1" />
                  {finalProgress}% to graduation ·{" "}
                  {69 - (finalProgress / 100) * 69 < 1
                    ? "Almost there!"
                    : `${(69 - (finalProgress / 100) * 69).toFixed(1)} BNB remaining`}
                </p>
              </div>
            )}
          </div>

          {/* Agent capabilities card */}
          <div className="rounded-2xl border border-white/[0.04] glass p-4 flex flex-col gap-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <Cpu size={13} className="text-purple-400" /> Agent Capabilities
            </h4>
            <div className="flex flex-col gap-2 text-xs text-gray-600">
              {[
                { icon: <Puzzle size={11} className="text-purple-400" />, label: "Skill token support" },
                { icon: <Zap size={11} className="text-bnb-yellow" />, label: "Programmable logic" },
                { icon: <Shield size={11} className="text-blue-400" />, label: "NFA identity system" },
                { icon: <Star size={11} className="text-orange-400" />, label: "Reputation scoring" },
                { icon: <Activity size={11} className="text-green-400" />, label: "Progressive liquidity" },
              ].map(({ icon, label }, i) => (
                <div key={i} className="flex items-center gap-2">
                  {icon} <span>{label}</span>
                </div>
              ))}
            </div>
            <Link
              href="/launch"
              className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 py-2 text-xs font-semibold text-purple-300 transition-all hover:bg-purple-500/25 hover:shadow-[0_0_16px_rgba(168,85,247,0.3)] hover:-translate-y-0.5"
            >
              <Puzzle size={11} /> Deploy Skill for this Agent
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
