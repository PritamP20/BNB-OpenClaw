"use client";

import { useReadContract, useReadContracts, useAccount } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatEther } from "viem";
import { ADDRESSES } from "../lib/contracts";
import { useState, useEffect } from "react";
import { Lock, Unlock, ExternalLink, Cpu, Zap, Info } from "lucide-react";
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
  const [showInfo, setShowInfo] = useState(true);
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

  const W = 700, H = 410;
  const cx = W / 2, cy = H / 2;
  const n = skills.length;
  const baseR = n <= 3 ? 140 : n <= 6 ? 165 : 190;

  const positions = skills.map((_, i) => {
    const r = i % 2 === 0 ? baseR : baseR + 22;
    const angle = (2 * Math.PI * i / Math.max(n, 1)) - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const dashOffset = -(pulse * 0.4);
  const selectedSkill = selected !== null ? skills[selected] : null;
  const unlockedCount = skills.filter(s => s.hasAccess).length;

  return (
    <div style={{ border: "1px solid #333333", borderTop: "3px solid #1B4EF8", background: "#1A1A1A", overflow: "hidden" }}>
      {/* Header with info toggle */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center" style={{ background: "#222222", border: "1px solid #333333" }}>
            <Cpu size={14} style={{ color: "#1B4EF8" }} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>
              Skill Ecosystem Graph
            </h3>
            <p className="text-[11px] font-bold mt-px" style={{ color: "#555555" }}>
              {n > 0
                ? `${n} skill module${n !== 1 ? "s" : ""} connected to this agent`
                : "No skills deployed yet"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {n > 0 && (
            <div className="flex items-center gap-2">
              {userAddress && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px]" style={{ border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.04)" }}>
                  <span className="h-1.5 w-1.5" style={{ background: "#4ade80" }} />
                  <span className="font-mono font-bold" style={{ color: "#4ade80" }}>{unlockedCount}</span>
                  <span className="font-bold uppercase tracking-wider" style={{ color: "#555555" }}>/ {n}</span>
                </div>
              )}
              <div className="px-2.5 py-1 text-[11px] font-mono font-bold" style={{ border: "1px solid #333333", color: "#888888" }}>
                {n}
              </div>
            </div>
          )}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1.5 transition-all hover:opacity-70"
            title="Toggle info panel"
          >
            <Info size={14} style={{ color: "#888888" }} />
          </button>
        </div>
      </div>

      {/* Info Panel - How Skills Work */}
      {showInfo && n > 0 && (
        <div className="px-5 py-3 border-b border-t border-[#333333]" style={{ background: "rgba(27,78,248,0.06)" }}>
          <div className="text-xs" style={{ color: "#888888", lineHeight: 1.6 }}>
            <p className="font-bold mb-2 flex items-center gap-1" style={{ color: "#F5C220" }}>
              <span>⚙️ How Skills Work:</span>
            </p>
            <ul className="space-y-1.5 ml-4">
              <li><strong style={{ color: "#aaa" }}>Central Agent (🤖):</strong> The AI agent core that processes requests</li>
              <li><strong style={{ color: "#aaa" }}>Skill Modules (🔵):</strong> Specialized ERC-20 tokens that extend agent capabilities</li>
              <li><strong style={{ color: "#aaa" }}>Connections:</strong> Golden lines = accessible, Purple dashed = locked</li>
              <li><strong style={{ color: "#aaa" }}>How to Use:</strong> Hold skill tokens to unlock features → agent uses skills in AI responses</li>
              <li><strong style={{ color: "#aaa" }}>Developer Revenue:</strong> Skill creators earn from skill token sales</li>
            </ul>
          </div>
        </div>
      )}

      {/* Empty state */}
      {n === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 px-6">
          <div className="flex h-20 w-20 items-center justify-center" style={{ background: "#222222", border: "1px solid #333333" }}>
            <span className="text-3xl">🤖</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>{agentName}</p>
            <p className="mt-2 text-xs font-bold max-w-sm" style={{ color: "#666666" }}>
              This agent has no skill modules attached. Skills are specialized ERC-20 tokens that extend agent capabilities through a modular architecture.
            </p>
            <p className="mt-2 text-[10px]" style={{ color: "#555555" }}>
              Developers can deploy skills to monetize their innovations while users get enhanced agent features.
            </p>
          </div>
          <Link
            href="/launch"
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all hover:opacity-80"
            style={{ border: "1px solid #F5C220", color: "#F5C220", background: "rgba(245,194,32,0.06)" }}
          >
            <Zap size={11} /> Deploy Your First Skill
          </Link>
        </div>
      ) : (
        <>
          {/* SVG Graph */}
          <div className="relative mx-4 mb-0 overflow-auto" style={{ border: "1px solid #222222", background: "#0F0F0F" }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minHeight: 390 }}>
              <defs>
                <radialGradient id="sgAgentGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#f0b90b" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#f0b90b" stopOpacity="0"    />
                </radialGradient>
                <radialGradient id="sgGreenGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.25" />
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
                    <stop offset="0%"   stopColor="#f0b90b" stopOpacity="0.85" />
                    <stop offset="100%" stopColor={skills[i]?.hasAccess ? "#22c55e" : "#a78bfa"} stopOpacity="0.65" />
                  </linearGradient>
                ))}
              </defs>

              {/* Background */}
              <rect x="0" y="0" width={W} height={H} fill="#0F0F0F" />

              {/* Grid rings */}
              {[70, 140, 210].map((r) => (
                <circle key={r} cx={cx} cy={cy} r={r}
                  fill="none" stroke="white" strokeOpacity={0.012} strokeWidth={0.8} strokeDasharray="5,5" />
              ))}

              {/* Connection lines with labels */}
              {positions.map((pos, i) => {
                const skill = skills[i];
                if (!skill) return null;
                const isHov = hovered === i || selected === i;
                const midX = (cx + pos.x) / 2;
                const midY = (cy + pos.y) / 2;
                return (
                  <g key={`sg-line-${i}`}>
                    {/* Base connection line */}
                    <line x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                      stroke={skill.hasAccess ? "#22c55e" : "#f0b90b"}
                      strokeWidth={4} strokeOpacity={0.035}
                    />
                    {/* Animated gradient line */}
                    <line x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                      stroke={`url(#sg-lineGrad-${i})`}
                      strokeWidth={isHov ? 2.4 : 1.5}
                      strokeDasharray={skill.hasAccess ? undefined : "10 6"}
                      strokeDashoffset={skill.hasAccess ? undefined : dashOffset}
                      strokeOpacity={isHov ? 0.95 : 0.48}
                    />
                    {/* Connection status label */}
                    {isHov || selected === i ? (
                      <text x={midX} y={midY - 7} textAnchor="middle" fontSize={8}
                        fill={skill.hasAccess ? "#4ade80" : "#f0b90b"}
                        fontFamily="monospace" fontWeight="700" opacity={0.9}>
                        {skill.hasAccess ? "✓ CONNECTED" : "⚠ LOCKED"}
                      </text>
                    ) : null}
                    {/* Animated particles for unlocked skills */}
                    {skill.hasAccess && (
                      <circle r={3} fill="#f0b90b" opacity={0.95} filter="url(#sgGlow)">
                        <animateMotion dur="3.2s" repeatCount="indefinite"
                          path={`M ${cx} ${cy} L ${pos.x} ${pos.y}`} />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* Agent center glow halo */}
              <circle cx={cx} cy={cy} r={85} fill="url(#sgAgentGlow)" />

              {/* Animated pulse rings */}
              <circle cx={cx} cy={cy} r={62}
                fill="none" stroke="#f0b90b" strokeWidth={1.2} strokeOpacity={0.14}
              >
                <animate attributeName="r" values="58;68;58" dur="3.5s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.14;0.28;0.14" dur="3.5s" repeatCount="indefinite" />
              </circle>

              {/* Agent center node */}
              <circle cx={cx} cy={cy} r={52} fill="#0b0b0e" stroke="#f0b90b" strokeWidth={3.5} filter="url(#sgGlow)" />
              <circle cx={cx} cy={cy} r={47} fill="#111118" stroke="#f0b90b" strokeWidth={0.5} strokeOpacity={0.35} />

              {/* Agent labels */}
              <text x={cx} y={cy - 14}  textAnchor="middle" fontSize={28} dominantBaseline="middle">🤖</text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10}
                fill="#f0b90b" fontFamily="monospace" fontWeight="700" letterSpacing="0.5">
                {agentSymbol}
              </text>
              <text x={cx} y={cy + 26} textAnchor="middle" fontSize={8}
                fill="#888888" fontFamily="sans-serif" fontWeight="600">
                AI AGENT CORE
              </text>

              {/* Skill nodes */}
              {positions.map((pos, i) => {
                const skill = skills[i];
                if (!skill) return null;
                const isHov = hovered === i;
                const isSel = selected === i;
                const isAcc = skill.hasAccess;
                const ring  = isAcc ? "#22c55e" : (isHov || isSel) ? "#f0b90b" : "#a78bfa";
                const txt   = isAcc ? "#4ade80" : (isHov || isSel) ? "#f0b90b" : "#c4b5fd";
                const icon  = getSkillIcon(skill.symbol);
                return (
                  <g key={`sg-node-${i}`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected(selected === i ? null : i)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Glow effect */}
                    {(isHov || isSel || isAcc) && (
                      <circle cx={pos.x} cy={pos.y} r={46}
                        fill={isAcc ? "url(#sgGreenGlow)" : "url(#sgAgentGlow)"} />
                    )}
                    {/* Pulsing ring on interaction */}
                    {(isHov || isSel) && (
                      <circle cx={pos.x} cy={pos.y} r={39}
                        fill="none" stroke={isAcc ? "#22c55e" : "#f0b90b"}
                        strokeWidth={1.4} strokeOpacity={0.45}
                      >
                        <animate attributeName="r" values="36;44;36" dur="1.4s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" values="0.45;0.1;0.45" dur="1.4s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {/* Node border */}
                    <circle cx={pos.x} cy={pos.y} r={35}
                      fill="#0c0c0f" stroke={ring}
                      strokeWidth={(isHov || isSel) ? 3 : 2}
                      filter={(isHov || isSel) ? "url(#sgStrongGlow)" : undefined}
                    />
                    {/* Node interior */}
                    <circle cx={pos.x} cy={pos.y} r={31}
                      fill={isAcc ? "#14532d" : (isHov || isSel) ? "#3d1f10" : "#2d1a47"}
                      fillOpacity={0.55}
                    />
                    {/* Skill icon */}
                    <text x={pos.x} y={pos.y - 9} textAnchor="middle" fontSize={18} dominantBaseline="middle">
                      {icon}
                    </text>
                    {/* Skill symbol */}
                    <text x={pos.x} y={pos.y + 7} textAnchor="middle" fontSize={9}
                      fill={txt} fontFamily="monospace" fontWeight="700">
                      ${skill.symbol.slice(0, 5)}
                    </text>
                    {/* Status badge */}
                    <rect x={pos.x - 20} y={pos.y + 13} width={40} height={13} rx={3.5}
                      fill={isAcc ? "rgba(34,197,94,0.18)" : "rgba(168,85,247,0.12)"} />
                    <text x={pos.x} y={pos.y + 22.5} textAnchor="middle" fontSize={7}
                      fill={isAcc ? "#4ade80" : "#c4b5fd"} fontFamily="monospace" fontWeight="700">
                      {isAcc ? "✓ ACTIVE" : "🔒 LOCKED"}
                    </text>
                  </g>
                );
              })}

              {/* Legend */}
              <text x={15} y={H - 8} fontSize={8} fill="#555555" fontFamily="monospace" fontWeight="600">
                Center: AI Agent Logic | Nodes: Skill Modules | Lines: Skill Connections
              </text>
            </svg>
          </div>

          {/* Selected skill detail panel */}
          {selectedSkill ? (
            <div className="mx-4 mt-3 mb-4 p-4" style={{ border: "1px solid #333333", borderLeft: "4px solid #F5C220", background: "#111111" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center text-2xl rounded" style={{ background: "#222222", border: "1px solid #333333" }}>
                    {getSkillIcon(selectedSkill.symbol)}
                  </div>
                  <div className="flex-1">
                    <p className="font-black uppercase tracking-wider text-sm" style={{ color: "#F5F5F5" }}>{selectedSkill.name}</p>
                    <p className="text-[10px] font-mono mt-1" style={{ color: "#888888" }}>${selectedSkill.symbol}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  {!userAddress ? (
                    <span className="text-[10px] font-bold px-3 py-1 rounded" style={{ color: "#888888", background: "#222222" }}>
                      Connect wallet
                    </span>
                  ) : selectedSkill.hasAccess ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded" style={{ border: "1px solid rgba(74,222,128,0.5)", color: "#4ade80", background: "rgba(74,222,128,0.1)" }}>
                      <Unlock size={10} /> Unlocked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded" style={{ border: "1px solid rgba(214,40,40,0.5)", color: "#ef4444", background: "rgba(214,40,40,0.1)" }}>
                      <Lock size={10} /> Locked
                    </span>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5" style={{ background: "#222222", border: "1px solid #333333", borderRadius: "3px" }}>
                  <p className="font-bold uppercase tracking-wider text-[10px]" style={{ color: "#888888" }}>Cost</p>
                  <p className="mt-1 font-mono font-bold text-sm" style={{ color: "#F5F5F5" }}>
                    {selectedSkill.costPerUse === 0n ? "Free" : `${parseFloat(formatEther(selectedSkill.costPerUse)).toFixed(3)}`}
                  </p>
                </div>
                <div className="p-2.5" style={{ background: "#222222", border: "1px solid #333333", borderRadius: "3px" }}>
                  <p className="font-bold uppercase tracking-wider text-[10px]" style={{ color: "#888888" }}>Address</p>
                  <p className="mt-1 font-mono text-[8px]" style={{ color: "#666666" }}>
                    {selectedSkill.address.slice(0, 10)}…
                  </p>
                </div>
                <div className="p-2.5" style={{ background: "#222222", border: "1px solid #333333", borderRadius: "3px" }}>
                  <p className="font-bold uppercase tracking-wider text-[10px]" style={{ color: "#888888" }}>Status</p>
                  <p className="mt-1 font-bold text-sm" style={{ color: selectedSkill.hasAccess ? "#4ade80" : "#a78bfa" }}>
                    {selectedSkill.hasAccess ? "✓ Active" : "🔒 Locked"}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/token/${selectedSkill.address}`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded hover:opacity-80"
                  style={{ border: "1px solid #F5C220", color: "#F5C220", background: "rgba(245,194,32,0.08)" }}
                >
                  View Skill Token <ExternalLink size={10} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-6 px-5 py-3 text-[10px] font-bold uppercase tracking-wider overflow-x-auto" style={{ color: "#666666", borderTop: "1px solid #222222" }}>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="inline-block h-1 w-6 rounded" style={{ background: "#4ade80" }} /> Active
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="inline-block h-1 w-6 border-t-2 border-dashed" style={{ borderColor: "#a78bfa" }} /> Locked
              </span>
              <span className="ml-auto italic whitespace-nowrap" style={{ color: "#555555" }}>
                Click a node to view details
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
