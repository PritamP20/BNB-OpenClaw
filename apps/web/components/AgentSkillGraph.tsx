"use client";

import { useReadContract, useReadContracts, useAccount } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatEther } from "viem";
import { ADDRESSES } from "../lib/contracts";
import { useState } from "react";
import { Lock, Unlock, ExternalLink } from "lucide-react";
import Link from "next/link";

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
  const [hovered, setHovered] = useState<number | null>(null);
  const registryAddr = ADDRESSES.agentRegistry;

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

  const W = 560, H = 300;
  const cx = W / 2, cy = H / 2;
  const radius = 130;
  const n = skills.length;

  const positions = skills.map((_, i) => {
    const angle = (2 * Math.PI * i / Math.max(n, 1)) - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  const hoveredSkill = hovered !== null ? skills[hovered] : null;

  return (
    <div className="rounded-2xl border border-bnb-border bg-bnb-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Skill Graph</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            {n > 0
              ? `${n} skill${n !== 1 ? "s" : ""} attached to this agent`
              : "No skills deployed yet"}
          </p>
        </div>
        {userAddress && n > 0 && (
          <span className="text-xs text-gray-600">
            <span className="text-green-400">{skills.filter((s) => s.hasAccess).length}</span>
            <span className="text-gray-600">/{n} accessible</span>
          </span>
        )}
      </div>

      {/* Empty state */}
      {n === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-purple-400/20 bg-purple-400/10 text-3xl">
            🤖
          </div>
          <p className="text-sm font-semibold text-gray-300">{agentName}</p>
          <p className="text-xs text-gray-600">No skill tokens have been deployed for this agent yet.</p>
          <Link href="/launch" className="mt-1 text-xs text-bnb-yellow hover:underline">
            Deploy a skill →
          </Link>
        </div>
      ) : (
        <>
          {/* Graph */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            style={{ maxHeight: 280 }}
          >
            <defs>
              <radialGradient id="sgAgentGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#f0b90b" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#f0b90b" stopOpacity="0"    />
              </radialGradient>
              <filter id="sgGlow">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connection lines */}
            {positions.map((pos, i) => {
              const skill = skills[i];
              if (!skill) return null;
              const isHov = hovered === i;
              return (
                <line
                  key={i}
                  x1={cx} y1={cy} x2={pos.x} y2={pos.y}
                  stroke={
                    skill.hasAccess ? "#22c55e"
                      : isHov       ? "#f0b90b"
                                    : "#2a2a2a"
                  }
                  strokeWidth={isHov ? 1.5 : 1}
                  strokeDasharray={skill.hasAccess ? undefined : "5 3"}
                  strokeOpacity={isHov ? 1 : skill.hasAccess ? 0.55 : 0.35}
                />
              );
            })}

            {/* Center glow */}
            <circle cx={cx} cy={cy} r={56} fill="url(#sgAgentGlow)" />

            {/* Agent center node */}
            <circle cx={cx} cy={cy} r={36} fill="#111" stroke="#f0b90b" strokeWidth={2} />
            <text x={cx} y={cy - 7}  textAnchor="middle" fontSize={20}>🤖</text>
            <text x={cx} y={cy + 13} textAnchor="middle" fontSize={8.5}
              fill="#f0b90b" fontFamily="monospace" fontWeight="bold">
              {agentSymbol.slice(0, 6)}
            </text>

            {/* Skill nodes */}
            {positions.map((pos, i) => {
              const skill = skills[i];
              if (!skill) return null;
              const isHov   = hovered === i;
              const ringCol = skill.hasAccess ? "#22c55e" : isHov ? "#f0b90b" : "#333";
              const textCol = skill.hasAccess ? "#4ade80" : "#9ca3af";
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  {isHov && (
                    <circle cx={pos.x} cy={pos.y} r={34}
                      fill={skill.hasAccess ? "#22c55e" : "#f0b90b"}
                      fillOpacity={0.08} />
                  )}
                  <circle
                    cx={pos.x} cy={pos.y} r={28}
                    fill="#0d0d0d"
                    stroke={ringCol}
                    strokeWidth={isHov ? 2 : 1.5}
                    filter={isHov ? "url(#sgGlow)" : undefined}
                  />
                  <text x={pos.x} y={pos.y - 7} textAnchor="middle" fontSize={13}>🧩</text>
                  <text x={pos.x} y={pos.y + 6} textAnchor="middle" fontSize={7}
                    fill={textCol} fontFamily="monospace" fontWeight="bold">
                    {skill.symbol.slice(0, 7)}
                  </text>
                  <text x={pos.x} y={pos.y + 15} textAnchor="middle" fontSize={6}
                    fill={skill.hasAccess ? "#4ade80" : "#6b7280"} fontFamily="sans-serif">
                    {skill.hasAccess ? "✓ access" : "🔒 locked"}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover tooltip */}
          {hoveredSkill && (
            <div className="mt-1 rounded-xl border border-bnb-border bg-bnb-dark p-3 text-xs">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-white">{hoveredSkill.name}</span>
                <span className="font-mono text-gray-500">${hoveredSkill.symbol}</span>
              </div>
              <div className="flex flex-col gap-1.5 text-gray-600">
                <div className="flex justify-between">
                  <span>Cost per use</span>
                  <span className="font-mono text-gray-300">
                    {hoveredSkill.costPerUse === 0n
                      ? "Free"
                      : `${formatEther(hoveredSkill.costPerUse)} ${hoveredSkill.symbol}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Access</span>
                  {!userAddress ? (
                    <span className="text-gray-600">Connect wallet to check</span>
                  ) : hoveredSkill.hasAccess ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Unlock size={10} /> You have access
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-400">
                      <Lock size={10} /> Need tokens to use
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/token/${hoveredSkill.address}`}
                className="mt-2.5 flex items-center gap-1 text-bnb-yellow hover:underline"
              >
                View skill token <ExternalLink size={9} />
              </Link>
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 flex items-center gap-5 text-[11px] text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="h-px w-4 bg-green-500 inline-block" /> Accessible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-px w-4 border-t border-dashed border-gray-600 inline-block" /> Locked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-px w-4 border-t border-dashed border-gray-800 inline-block" /> Not connected
            </span>
          </div>
        </>
      )}
    </div>
  );
}
