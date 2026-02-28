"use client";

import { useReadContract, useReadContracts, useAccount } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatEther } from "viem";
import { ADDRESSES } from "../lib/contracts";
import { useState, useEffect } from "react";
import { Lock, Unlock, ExternalLink, Cpu, Zap } from "lucide-react";
import Link from "next/link";

// ── Skill icon mapping ────────────────────────────────────────────────────────

const SKILL_ICONS: Record<string, string> = {
  RAG: "📡", DEBUG: "🔧", TRADE: "📈", RESEARCH: "🔬",
  VISION: "👁️", SPEECH: "🎤", CODE: "💻", DATA: "📊",
  AUDIT: "🛡️", SOCIAL: "🌐", LEARN: "🧠", PLAN: "🗂️",
};

function getSkillIcon(symbol: string): string {
  const key = Object.keys(SKILL_ICONS).find((k) => symbol.toUpperCase().includes(k));
  return key ? SKILL_ICONS[key]! : "🧩";
}

// ── Minimal ABIs ──────────────────────────────────────────────────────────────

const AGENT_TOKEN_ABI = [
  { name: "agentId", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

const REGISTRY_ABI = [
  { name: "getAgentRecord", type: "function", stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "agentToken", type: "address" }, { name: "skillTokens", type: "address[]" }] },
] as const;

const SKILL_ABI = [
  { name: "name",        type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string"  }] },
  { name: "symbol",      type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string"  }] },
  { name: "costPerUse",  type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "verifySkillAccess", type: "function", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "bool" }] },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkillInfo {
  address: `0x${string}`;
  name:       string;
  symbol:     string;
  costPerUse: bigint;
  hasAccess:  boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentSkillGraph({
  agentTokenAddress,
  agentName,
  agentSymbol,
}: {
  agentTokenAddress: `0x${string}`;
  agentName:   string;
  agentSymbol: string;
}) {
  const { address: userAddress } = useAccount();
  const [hovered,  setHovered]  = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pulse,    setPulse]    = useState(0);
  const registryAddr = ADDRESSES.agentRegistry;

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => (p + 1) % 100), 50);
    return () => clearInterval(id);
  }, []);

  // 1. Read agentId from the AgentToken contract
  const { data: agentId } = useReadContract({
    address: agentTokenAddress,
    abi:     AGENT_TOKEN_ABI,
    functionName: "agentId",
    chainId: bscTestnet.id,
  });

  // 2. Read skill token list from AgentRegistry
  const { data: agentRecord } = useReadContract({
    address: registryAddr,
    abi:     REGISTRY_ABI,
    functionName: "getAgentRecord",
    args:    agentId != null ? [agentId] : undefined,
    chainId: bscTestnet.id,
    query:   { enabled: agentId != null && !!registryAddr },
  });

  const skillAddresses = ((agentRecord as [string, string[]] | undefined)?.[1] ?? []) as `0x${string}`[];

  // 3. Batch-read each skill's name / symbol / costPerUse and (if connected) access
  const perSkill = userAddress ? 4 : 3;
  const skillCalls = skillAddresses.flatMap((addr) => [
    { address: addr, abi: SKILL_ABI, functionName: "name"       as const, chainId: bscTestnet.id },
    { address: addr, abi: SKILL_ABI, functionName: "symbol"     as const, chainId: bscTestnet.id },
    { address: addr, abi: SKILL_ABI, functionName: "costPerUse" as const, chainId: bscTestnet.id },
    ...(userAddress
      ? [{ address: addr, abi: SKILL_ABI, functionName: "verifySkillAccess" as const,
           args: [userAddress] as [`0x${string}`], chainId: bscTestnet.id }]
      : []),
  ]);

  const { data: skillResults } = useReadContracts({
    contracts: skillCalls,
    query: { enabled: skillAddresses.length > 0 },
  });

  const skills: SkillInfo[] = skillAddresses.map((addr, i) => {
    const base = i * perSkill;
    return {
      address:    addr,
      name:       (skillResults?.[base    ]?.result as string  | undefined) ?? addr.slice(0, 6) + "…",
      symbol:     (skillResults?.[base + 1]?.result as string  | undefined) ?? "???",
      costPerUse: (skillResults?.[base + 2]?.result as bigint  | undefined) ?? 0n,
      hasAccess:  userAddress
        ? ((skillResults?.[base + 3]?.result as boolean | undefined) ?? false)
        : false,
    };
  });

  if (!registryAddr) return null;

  // ── SVG layout ──────────────────────────────────────────────────────────────

  const W = 620, H = 320;
  const cx = W / 2, cy = H / 2;
  const n = skills.length;
  const baseR = n <= 3 ? 120 : n <= 6 ? 135 : 150;

  const positions = skills.map((_, i) => {
    const r = i % 2 === 0 ? baseR : baseR + 18;
    const angle = (2 * Math.PI * i / Math.max(n, 1)) - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const dashOffset = -(pulse * 0.4);
  const selectedSkill = selected !== null ? skills[selected] : null;

  return (
    <div className="rounded-2xl border border-bnb-yellow/10 glass overflow-hidden">
      {/* Top accent bar */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Cpu size={14} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Skill Graph</h3>
            <p className="text-[11px] text-gray-600 mt-px">
              {n > 0
                ? `${n} skill module${n !== 1 ? "s" : ""} connected`
                : "No skills deployed yet"}
            </p>
          </div>
        </div>
        {n > 0 && (
          <div className="flex items-center gap-2">
            {userAddress && (
              <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/5 px-2.5 py-1 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                <span className="font-mono text-green-400">{skills.filter((s) => s.hasAccess).length}</span>
                <span className="text-gray-600">/ {n} unlocked</span>
              </div>
            )}
            <div className="rounded-full border border-bnb-yellow/15 bg-bnb-yellow/5 px-2.5 py-1 text-[11px] font-mono text-bnb-yellow/70">
              {n} skill{n !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {n === 0 ? (
        <div className="flex flex-col items-center gap-4 py-14 px-6">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-purple-400/20 animate-pulse" />
            <div className="absolute inset-3 rounded-full border border-bnb-yellow/10" />
            <span className="text-3xl">🤖</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-200">{agentName}</p>
            <p className="mt-1 text-xs text-gray-600 max-w-xs">
              No skill modules attached yet. Developers can deploy skill tokens to extend this agent&apos;s capabilities.
            </p>
          </div>
          <Link
            href="/launch"
            className="flex items-center gap-1.5 rounded-full border border-bnb-yellow/30 bg-bnb-yellow/10 px-4 py-1.5 text-xs font-semibold text-bnb-yellow hover:bg-bnb-yellow/20 transition-all"
          >
            <Zap size={11} /> Deploy a Skill Module
          </Link>
        </div>
      ) : (
        <>
          {/* SVG Graph */}
          <div className="relative mx-4 mb-0 overflow-hidden rounded-xl border border-white/[0.04] bg-[#060609]">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 310 }}>
              <defs>
                <radialGradient id="sgAgentGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#f0b90b" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#f0b90b" stopOpacity="0"    />
                </radialGradient>
                <radialGradient id="sgGreenGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0"    />
                </radialGradient>
                <filter id="sgGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="sgStrongGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {positions.map((pos, i) => (
                  <linearGradient
                    key={`sg-lg-${i}`}
                    id={`sg-lineGrad-${i}`}
                    x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%"   stopColor="#f0b90b" stopOpacity="0.8" />
                    <stop offset="100%" stopColor={skills[i]?.hasAccess ? "#22c55e" : "#7c3aed"} stopOpacity="0.6" />
                  </linearGradient>
                ))}
              </defs>

              {/* Radial grid rings */}
              {[50, 95, 145].map((r) => (
                <circle key={r} cx={cx} cy={cy} r={r}
                  fill="none" stroke="white" strokeOpacity={0.025} strokeWidth={1} />
              ))}

              {/* Connection lines */}
              {positions.map((pos, i) => {
                const skill = skills[i];
                if (!skill) return null;
                const isHov = hovered === i || selected === i;
                return (
                  <g key={`sg-line-${i}`}>
                    <line x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                      stroke={skill.hasAccess ? "#22c55e" : "#f0b90b"}
                      strokeWidth={3} strokeOpacity={0.04}
                    />
                    <line x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                      stroke={`url(#sg-lineGrad-${i})`}
                      strokeWidth={isHov ? 1.8 : 1.1}
                      strokeDasharray={skill.hasAccess ? undefined : "6 4"}
                      strokeDashoffset={skill.hasAccess ? undefined : dashOffset}
                      strokeOpacity={isHov ? 0.9 : 0.38}
                    />
                    {skill.hasAccess && (
                      <circle r={2.5} fill="#f0b90b" opacity={0.85} filter="url(#sgGlow)">
                        <animateMotion dur="2.8s" repeatCount="indefinite"
                          path={`M ${cx} ${cy} L ${pos.x} ${pos.y}`} />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* Agent center glow */}
              <circle cx={cx} cy={cy} r={72} fill="url(#sgAgentGlow)" />

              {/* Animated pulse ring */}
              <circle cx={cx} cy={cy} r={46}
                fill="none" stroke="#f0b90b" strokeWidth={1} strokeOpacity={0.1}
              >
                <animate attributeName="r" values="44;50;44" dur="3s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.1;0.2;0.1" dur="3s" repeatCount="indefinite" />
              </circle>

              {/* Agent center node */}
              <circle cx={cx} cy={cy} r={40} fill="#0b0b0e" stroke="#f0b90b" strokeWidth={2.5} filter="url(#sgGlow)" />
              <circle cx={cx} cy={cy} r={36} fill="#111118" stroke="#f0b90b" strokeWidth={0.5} strokeOpacity={0.25} />
              <text x={cx} y={cy - 8}  textAnchor="middle" fontSize={20} dominantBaseline="middle">🤖</text>
              <text x={cx} y={cy + 16} textAnchor="middle" fontSize={8.5}
                fill="#f0b90b" fontFamily="monospace" fontWeight="700" letterSpacing="1">
                {agentSymbol.slice(0, 7)}
              </text>
              <rect x={cx - 17} y={cy + 27} width={34} height={10} rx={5}
                fill="#f0b90b" fillOpacity={0.13} />
              <text x={cx} y={cy + 32.5} textAnchor="middle" fontSize={6}
                fill="#f0b90b" fontFamily="monospace" dominantBaseline="middle">
                AI AGENT
              </text>

              {/* Skill nodes */}
              {positions.map((pos, i) => {
                const skill = skills[i];
                if (!skill) return null;
                const isHov = hovered === i;
                const isSel = selected === i;
                const isAcc = skill.hasAccess;
                const ring  = isAcc ? "#22c55e" : (isHov || isSel) ? "#f0b90b" : "#6d28d9";
                const txt   = isAcc ? "#4ade80" : (isHov || isSel) ? "#f0b90b" : "#9ca3af";
                const icon  = getSkillIcon(skill.symbol);
                return (
                  <g key={`sg-node-${i}`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected(selected === i ? null : i)}
                    style={{ cursor: "pointer" }}
                  >
                    {(isHov || isSel || isAcc) && (
                      <circle cx={pos.x} cy={pos.y} r={38}
                        fill={isAcc ? "url(#sgGreenGlow)" : "url(#sgAgentGlow)"} />
                    )}
                    {(isHov || isSel) && (
                      <circle cx={pos.x} cy={pos.y} r={32}
                        fill="none" stroke={isAcc ? "#22c55e" : "#f0b90b"}
                        strokeWidth={1} strokeOpacity={0.35}
                      >
                        <animate attributeName="r" values="29;35;29" dur="1.6s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.35;0;0.35" dur="1.6s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle cx={pos.x} cy={pos.y} r={26}
                      fill="#0c0c0f" stroke={ring}
                      strokeWidth={(isHov || isSel) ? 2.2 : 1.5}
                      filter={(isHov || isSel) ? "url(#sgStrongGlow)" : undefined}
                    />
                    <circle cx={pos.x} cy={pos.y} r={23}
                      fill={isAcc ? "#14532d" : (isHov || isSel) ? "#2d1800" : "#1a0d2e"}
                      fillOpacity={0.45}
                    />
                    <text x={pos.x} y={pos.y - 7} textAnchor="middle" fontSize={13} dominantBaseline="middle">
                      {icon}
                    </text>
                    <text x={pos.x} y={pos.y + 8} textAnchor="middle" fontSize={7}
                      fill={txt} fontFamily="monospace" fontWeight="700">
                      ${skill.symbol.slice(0, 7)}
                    </text>
                    <text x={pos.x} y={pos.y + 17} textAnchor="middle" fontSize={5.5}
                      fill={isAcc ? "#4ade80" : "#6b7280"} fontFamily="sans-serif">
                      {isAcc ? "✓ unlocked" : "🔒 locked"}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Selected skill detail panel */}
          {selectedSkill ? (
            <div className="mx-4 mt-3 mb-4 rounded-xl border border-bnb-yellow/20 bg-gradient-to-br from-bnb-yellow/[0.04] to-purple-500/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-bnb-yellow/15 glass text-xl shadow-[0_0_12px_rgba(243,186,47,0.15)]">
                    {getSkillIcon(selectedSkill.symbol)}
                  </div>
                  <div>
                    <p className="font-semibold text-white leading-tight">{selectedSkill.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-mono">${selectedSkill.symbol}</p>
                  </div>
                </div>
                {!userAddress ? (
                  <span className="text-[11px] text-gray-600 mt-1">Connect wallet to check access</span>
                ) : selectedSkill.hasAccess ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-green-400">
                    <Unlock size={9} /> Unlocked
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-red-400">
                    <Lock size={9} /> Locked
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg glass border border-white/[0.05] p-2.5">
                  <p className="text-gray-600">Cost Per Use</p>
                  <p className="mt-0.5 font-mono font-bold text-white">
                    {selectedSkill.costPerUse === 0n
                      ? "Free"
                      : `${parseFloat(formatEther(selectedSkill.costPerUse)).toFixed(4)} ${selectedSkill.symbol}`}
                  </p>
                </div>
                <div className="rounded-lg glass border border-white/[0.05] p-2.5">
                  <p className="text-gray-600">Contract</p>
                  <p className="mt-0.5 font-mono text-gray-400 truncate text-[10px]">
                    {selectedSkill.address.slice(0, 10)}…{selectedSkill.address.slice(-6)}
                  </p>
                </div>
              </div>
              <Link
                href={`/token/${selectedSkill.address}`}
                className="mt-3 flex items-center gap-1.5 rounded-full border border-bnb-yellow/25 bg-bnb-yellow/10 px-3 py-1.5 text-[11px] font-semibold text-bnb-yellow hover:bg-bnb-yellow/20 hover:shadow-[0_0_12px_rgba(243,186,47,0.2)] transition-all w-fit"
              >
                View Skill Token <ExternalLink size={9} />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-5 px-5 py-3 text-[11px] text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-px w-5 bg-green-500" /> Accessible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-px w-5 border-t border-dashed border-purple-600" /> Locked
              </span>
              <span className="ml-auto text-gray-700 italic">Click a node to inspect</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
