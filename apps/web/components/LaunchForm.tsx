"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAccount, useConnect, useChainId, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { bscTestnet } from "wagmi/chains";
import { parseEther } from "viem";
import { useTokenDeploy } from "../hooks/useTokenDeploy";
import {
  Bot,
  Coins,
  Puzzle,
  ChevronRight,
  ChevronDown,
  Info,
  Rocket,
  CheckCircle2,
  Check,
  AlertCircle,
  TrendingUp,
  Zap,
  Users,
  Lock,
  ExternalLink,
  Copy,
  ArrowUpRight,
  Container,
  KeyRound,
  Loader2,
  Terminal,
  RefreshCw,
  Search,
  X,
  FileText,
  Upload,
  FileCheck,
  Sparkles,
  Shield,
  Radio,
} from "lucide-react";
import { useTokens, type Token } from "../hooks/useTokens";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TokenType = "normal" | "agent" | "skill";

interface FormState {
  name: string;
  symbol: string;
  supply: string;
  description: string;
  avatar: string;
  // Normal
  maxSupply: string;
  // Agent / curve
  virtualBNB: string;
  graduationTarget: string;
  feeBps: string;
  // Agent identity
  logicAddress: string;
  learningEnabled: boolean;
  // Skill
  agentId: string;
  agentTokenAddress: string;
  skillId: string;
  costPerUse: string;
  skillPrompt: string;
  // ── Docker runtime (agent only) ──
  dockerImage: string;
  containerPort: string;
  runEnvsJson: string;
  tokenAddress: string; // ERC-20 for token gating (optional at list time)
}

type Errors = Partial<Record<keyof FormState, string>>;

const DEFAULT_FORM: FormState = {
  name: "",
  symbol: "",
  supply: "1000000000",
  description: "",
  avatar: "🤖",
  maxSupply: "0",
  virtualBNB: "10",
  graduationTarget: "69",
  feeBps: "100",
  logicAddress: "",
  learningEnabled: true,
  agentId: "",
  agentTokenAddress: "",
  skillId: "",
  costPerUse: "1",
  skillPrompt: "",
  dockerImage: "",
  containerPort: "3000",
  runEnvsJson: "{}",
  tokenAddress: "",
};

const AVATARS: Record<TokenType, string[]> = {
  agent:  ["🤖", "🧠", "⚡", "🔮", "🎯", "🚀", "🦾", "🌐", "🧬", "🛸", "🦑", "🔴"],
  normal: ["🟡", "💎", "🔥", "🌕", "⭐", "🦁", "🐉", "🌊", "💰", "🏆", "🌀", "🍀"],
  skill:  ["🔧", "⚙️", "🔬", "📡", "🧩", "💡", "🎛️", "🔭", "🛠️", "🔑", "🧲", "🖥️"],
};

const TYPE_CONFIG = {
  normal: {
    label: "Normal Token",
    icon: Coins,
    color: "text-blue-400",
    border: "border-blue-400/40",
    activeBg: "bg-blue-400/10",
    badge: "bg-blue-400/10 text-blue-400 border-blue-400/20",
    glow: "",
    gradient: "from-blue-500/70",
    iconBg: "bg-blue-400/15 border-blue-400/25",
    features: ["ERC-20 standard", "Optional max supply", "Instant trading", "Growth tools"],
    description: "A simple fungible token. Fair-launch, no AI required.",
    activeLeftBorder: "#1B4EF8",
    activeColor: "#1B4EF8",
  },
  agent: {
    label: "AI Agent",
    icon: Bot,
    color: "text-purple-400",
    border: "border-purple-400/40",
    activeBg: "bg-purple-400/10",
    badge: "bg-purple-400/10 text-purple-400 border-purple-400/20",
    glow: "",
    gradient: "from-purple-500/70",
    iconBg: "bg-purple-400/15 border-purple-400/25",
    features: ["Docker container deployed", "Bonding curve launch", "Token-gated API", "Auto-graduation to DEX"],
    description: "Deploy your AI agent as a Dockerfile. Holders of your token get API access.",
    activeLeftBorder: "#1B4EF8",
    activeColor: "#1B4EF8",
  },
  skill: {
    label: "Skill Token",
    icon: Puzzle,
    color: "text-green-400",
    border: "border-green-400/40",
    activeBg: "bg-green-400/10",
    badge: "bg-green-400/10 text-green-400 border-green-400/20",
    glow: "",
    gradient: "from-green-500/70",
    iconBg: "bg-green-400/15 border-green-400/25",
    features: ["Linked to parent agent", "Pay-per-use burns", "Composable modules", "Developer monetisation"],
    description: "A monetisable skill module for an existing AI agent.",
    activeLeftBorder: "#D62828",
    activeColor: "#D62828",
  },
};

// ── Agent emoji helper ────────────────────────────────────────────────────────

const AGENT_EMOJIS = ["🤖", "🧠", "⚡", "🔮", "🎯", "🚀", "🦾", "🌐", "🧬", "🛸"];
function agentEmoji(name: string) {
  return AGENT_EMOJIS[(name.charCodeAt(0) || 0) % AGENT_EMOJIS.length];
}

// ── AgentDropdown ─────────────────────────────────────────────────────────────

function AgentDropdown({
  agents,
  value,
  onChange,
  isLoading,
  fetchError,
  fieldError,
}: {
  agents: Token[];
  value: string;
  onChange: (agentId: string, address: string, name: string) => void;
  isLoading: boolean;
  fetchError: string | null;
  fieldError?: string;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const panelRef            = useRef<HTMLDivElement>(null);

  const selected = agents.find((a) => a.agentId?.toString() === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.symbol.toLowerCase().includes(q) ||
      a.address.toLowerCase().includes(q) ||
      (a.agentId?.toString() ?? "").includes(q)
  );

  return (
    <div ref={panelRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors"
        style={{
          background: "#222222",
          border: fieldError ? "1px solid #D62828" : open ? "1px solid #F5C220" : "1px solid #333333",
          color: "#F5F5F5",
        }}
      >
        {selected ? (
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{agentEmoji(selected.name)}</span>
            <div className="flex flex-col items-start leading-tight">
              <span className="font-medium" style={{ color: "#F5F5F5" }}>{selected.name}</span>
              <span className="text-[11px]" style={{ color: "#555555" }}>
                ${selected.symbol} · Agent #{selected.agentId?.toString()}
              </span>
            </div>
          </div>
        ) : (
          <span style={{ color: "#555555" }}>
            {isLoading ? "Loading agents…" : "Select a parent agent…"}
          </span>
        )}
        <ChevronDown
          size={15}
          className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "#888888" }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden shadow-2xl shadow-black/70" style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
          {/* Search bar */}
          <div className="p-2" style={{ borderBottom: "1px solid #333333" }}>
            <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "#222222", border: "1px solid #333333" }}>
              <Search size={12} className="flex-shrink-0" style={{ color: "#555555" }} />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#F5F5F5" }}
                placeholder="Search by name, symbol, or address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ color: "#888888" }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto p-1.5">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs" style={{ color: "#888888" }}>
                <Loader2 size={13} className="animate-spin" /> Fetching agents from chain…
              </div>
            ) : fetchError ? (
              <div className="py-5 text-center text-xs" style={{ color: "#D62828" }}>
                Failed to load agents — {fetchError}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs" style={{ color: "#555555" }}>
                {agents.length === 0
                  ? "No AI agents have been deployed yet."
                  : "No agents match your search."}
              </div>
            ) : (
              filtered.map((agent) => {
                const isSel  = agent.agentId?.toString() === value;
                const emoji  = agentEmoji(agent.name);
                return (
                  <button
                    key={agent.address}
                    type="button"
                    onClick={() => {
                      onChange(
                        agent.agentId?.toString() ?? "",
                        agent.address,
                        agent.name
                      );
                      setOpen(false);
                      setSearch("");
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                    style={{ background: isSel ? "rgba(245,194,32,0.1)" : "transparent" }}
                  >
                    {/* Avatar */}
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-xl" style={{ background: "rgba(27,78,248,0.1)", border: "1px solid rgba(27,78,248,0.2)" }}>
                      {emoji}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium leading-tight" style={{ color: isSel ? "#F5C220" : "#F5F5F5" }}>
                          {agent.name}
                        </span>
                        {agent.isGraduated && (
                          <span className="px-1 py-0.5 text-[9px] font-black uppercase" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
                            GRAD
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: "#888888" }}>${agent.symbol}</span>
                        {agent.agentId != null && (
                          <span className="font-mono text-[10px]" style={{ color: "#1B4EF8" }}>
                            Agent #{agent.agentId.toString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Address + checkmark */}
                    <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                      <span className="font-mono text-[10px]" style={{ color: "#555555" }}>
                        {agent.address.slice(0, 6)}…{agent.address.slice(-4)}
                      </span>
                      {isSel && <Check size={11} style={{ color: "#F5C220" }} />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {!isLoading && agents.length > 0 && (
            <div className="px-3 py-1.5 text-[10px]" style={{ borderTop: "1px solid #333333", color: "#555555" }}>
              {filtered.length} of {agents.length} agent
              {agents.length !== 1 ? "s" : ""} on BNB Testnet
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(form: FormState, type: TokenType): Errors {
  const e: Errors = {};
  if (!form.name.trim() || form.name.trim().length < 2)
    e.name = "Name must be at least 2 characters.";
  if (!form.symbol.trim() || form.symbol.trim().length < 2)
    e.symbol = "Symbol must be 2–10 characters.";
  if (!form.description.trim() || form.description.trim().length < 20)
    e.description = "Description must be at least 20 characters.";
  if (!form.supply || Number(form.supply) <= 0)
    e.supply = "Supply must be greater than 0.";

  if (type === "normal") {
    const cap = Number(form.maxSupply ?? 0);
    const sup = Number(form.supply ?? 0);
    if (cap < 0)
      e.maxSupply = "Max supply cannot be negative.";
    else if (cap > 0 && sup > 0 && cap < sup)
      e.maxSupply = `Cap (${cap.toLocaleString()}) must be ≥ Total Supply (${sup.toLocaleString()}), or set to 0 for uncapped.`;

    if (!form.virtualBNB || Number(form.virtualBNB) <= 0)
      e.virtualBNB = "Virtual BNB must be greater than 0.";
    if (!form.graduationTarget || Number(form.graduationTarget) <= 0)
      e.graduationTarget = "Graduation target must be greater than 0.";
    const fee = Number(form.feeBps);
    if (isNaN(fee) || fee < 0 || fee > 500)
      e.feeBps = "Fee must be 0–500 bps (max 5%).";
  }

  if (type === "agent") {
    if (!form.virtualBNB || Number(form.virtualBNB) <= 0)
      e.virtualBNB = "Virtual BNB must be greater than 0.";
    if (!form.graduationTarget || Number(form.graduationTarget) <= 0)
      e.graduationTarget = "Graduation target must be greater than 0.";
    const fee = Number(form.feeBps);
    if (isNaN(fee) || fee < 0 || fee > 500)
      e.feeBps = "Fee must be 0–500 bps (max 5%).";

    // Docker fields
    if (!form.dockerImage.trim())
      e.dockerImage = "Docker Hub image is required (e.g. username/myagent:latest).";
    else if (!form.dockerImage.trim().includes("/"))
      e.dockerImage = "Must be a Docker Hub reference, e.g. username/myagent:latest.";
    const port = parseInt(form.containerPort, 10);
    if (isNaN(port) || port < 1 || port > 65535)
      e.containerPort = "Port must be 1–65535.";
    if (form.runEnvsJson.trim() && form.runEnvsJson.trim() !== "{}") {
      try { JSON.parse(form.runEnvsJson); }
      catch { e.runEnvsJson = "Must be valid JSON, e.g. {\"KEY\": \"value\"}"; }
    }
    if (form.tokenAddress && !/^0x[0-9a-fA-F]{40}$/.test(form.tokenAddress))
      e.tokenAddress = "Must be a valid 0x EVM address.";
  }

  if (type === "skill") {
    if (!form.agentId.trim()) e.agentId = "Agent ID is required.";
    if (!form.skillId.trim()) e.skillId = "Skill ID is required.";
  }
  return e;
}

// ── Bonding curve maths ───────────────────────────────────────────────────────

function useCurveStats(form: FormState) {
  return useMemo(() => {
    const v = Number(form.virtualBNB);
    const g = Number(form.graduationTarget);
    const s = Number(form.supply);
    if (!v || !g || !s) return null;
    return {
      initialPrice: v / s,
      priceAtGrad:  (v + g) / s,
      multiple:     ((v + g) / v).toFixed(1),
      gradMcapBNB:  (v + g).toFixed(1),
    };
  }, [form.virtualBNB, form.graduationTarget, form.supply]);
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

const glassInputStyle = {
  background: "#222222",
  border: "1px solid #333333",
} as React.CSSProperties;

const inputCls =
  "w-full bg-bh-card border border-bh-border px-4 py-2.5 text-sm text-bh-white placeholder-bh-strong outline-none transition-colors focus:border-bh-yellow";
const errorInputCls =
  "w-full bg-bh-card border border-bh-red px-4 py-2.5 text-sm text-bh-white placeholder-bh-strong outline-none transition-colors focus:border-bh-red";

function Field({
  label, hint, error, children,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>{label}</label>
        {hint && (
          <span title={hint}>
            <Info size={12} className="cursor-help" style={{ color: "#555555" }} />
          </span>
        )}
      </div>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs" style={{ color: "#D62828" }}>
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: () => void; label: string; sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-start gap-3 p-3 text-left transition-colors"
      style={{ background: "#1A1A1A", border: "1px solid #333333" }}
    >
      <div
        className="relative mt-0.5 h-5 w-9 flex-shrink-0 transition-colors"
        style={{ background: checked ? "#F5C220" : "#333333" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(1rem)" : "translateX(0.125rem)" }}
        />
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: "#F5F5F5" }}>{label}</p>
        {sub && <p className="text-xs" style={{ color: "#888888" }}>{sub}</p>}
      </div>
    </button>
  );
}

function SectionHeading({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3 pt-5" style={{ borderTop: "1px solid #333333" }}>
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[11px] font-black"
        style={{ background: "#F5C220", color: "#0F0F0F" }}
      >{n}</span>
      <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>{label}</p>
      <div className="flex-1 h-px" style={{ background: "#333333" }} />
    </div>
  );
}

// ── Preview Panel ─────────────────────────────────────────────────────────────

function PreviewPanel({ form, type, curveStats, onAvatarChange }: {
  form: FormState; type: TokenType;
  curveStats: ReturnType<typeof useCurveStats>;
  onAvatarChange: (emoji: string) => void;
}) {
  const cfg = TYPE_CONFIG[type];
  const TypeIcon = cfg.icon;

  return (
    <div className="flex flex-col gap-4">
      {/* Avatar picker */}
      <div className="overflow-hidden" style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #333333" }}>
          <Sparkles size={12} style={{ color: "#F5C220" }} />
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#888888" }}>Choose Avatar</p>
        </div>
        <div className="grid grid-cols-6 gap-1.5 p-4">
          {AVATARS[type].map((emoji) => (
            <button key={emoji} type="button" onClick={() => onAvatarChange(emoji)}
              className="flex h-10 w-full items-center justify-center text-xl transition-all"
              style={form.avatar === emoji
                ? { background: "rgba(245,194,32,0.2)", border: "2px solid #F5C220" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid #333333" }
              }>
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Token preview card */}
      <div className="overflow-hidden" style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #333333" }}>
          <div className="flex h-4 w-4 items-center justify-center" style={{ background: "rgba(245,194,32,0.1)", border: "1px solid rgba(245,194,32,0.2)" }}>
            <TypeIcon size={9} style={{ color: "#F5C220" }} />
          </div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#888888" }}>Preview</p>
        </div>
        <div className="p-4">
          {/* Token card mock */}
          <div className="overflow-hidden" style={{ background: "#222222", border: "1px solid #333333" }}>
            {/* mini accent bar */}
            <div className="h-0.5 w-full" style={{ background: "#F5C220" }} />
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center text-xl" style={{ background: "#333333", border: "1px solid #555555" }}>{form.avatar}</div>
                  <div>
                    <p className="font-bold text-sm leading-tight" style={{ color: form.name ? "#F5C220" : "#555555" }}>{form.name || "Token Name"}</p>
                    <p className="text-xs" style={{ color: "#888888" }}>${form.symbol || "SYM"}</p>
                  </div>
                </div>
                <span className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-black uppercase" style={{ background: "#222222", border: "1px solid #555555", color: "#888888" }}>
                  <TypeIcon size={9} className="mr-0.5" />{cfg.label}
                </span>
              </div>
              <p className="text-xs line-clamp-2 mb-3" style={{ color: "#888888" }}>
                {form.description || "Your token description will appear here."}
              </p>
              <div>
                <div className="flex justify-between text-[10px] mb-1" style={{ color: "#555555" }}>
                  <span>Bonding curve</span><span>0%</span>
                </div>
                <div className="h-1 w-full" style={{ background: "#333333" }}>
                  <div className="h-full w-0" style={{ background: "#F5C220" }} />
                </div>
              </div>
              {type === "agent" && form.dockerImage && (
                <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 text-[10px]" style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}>
                  <Radio size={9} className="animate-pulse" /> Live container configured
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {type === "agent" && curveStats && (
        <div className="p-4" style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
          <p className="mb-3 text-xs font-black uppercase tracking-wider" style={{ color: "#888888" }}>Curve Stats</p>
          <div className="flex flex-col gap-2">
            {[
              { label: "Start price",    value: `${curveStats.initialPrice.toExponential(2)} BNB`, icon: Coins },
              { label: "Grad. market cap", value: `${curveStats.gradMcapBNB} BNB`,               icon: TrendingUp },
              { label: "Price multiple", value: `${curveStats.multiple}×`,                        icon: Zap },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between px-3 py-2 text-xs" style={{ background: "#222222" }}>
                <div className="flex items-center gap-1.5" style={{ color: "#888888" }}>
                  <Icon size={12} style={{ color: "#F5C220" }} />{label}
                </div>
                <span className="font-mono font-semibold" style={{ color: "#F5F5F5" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What happens next */}
      <div className="overflow-hidden" style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #333333" }}>
          <Shield size={12} style={{ color: "#F5C220" }} />
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#888888" }}>What Happens Next</p>
        </div>
        <ol className="flex flex-col gap-0 p-2">
          {(type === "agent" ? [
            { icon: Container,  text: "Docker image pulled from Docker Hub" },
            { icon: Zap,        text: "NFA identity minted on-chain" },
            { icon: Coins,      text: "Token deployed + bonding curve opened" },
            { icon: Lock,       text: "Token holders get API access" },
            { icon: TrendingUp, text: "Auto-graduates to PancakeSwap at 69 BNB" },
          ] : type === "skill" ? [
            { icon: Puzzle,     text: "Skill token deployed + linked to agent" },
            { icon: Users,      text: "Developers buy skill tokens" },
            { icon: Zap,        text: "Users burn tokens to invoke skill" },
          ] : [
            { icon: Coins,      text: "ERC-20 token deployed to BNB Chain" },
            { icon: Users,      text: "Token visible in the trending feed" },
            { icon: TrendingUp, text: "Growth tools activated" },
          ]).map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2.5 transition-colors group">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center" style={{ background: "#222222", border: "1px solid #555555", color: "#F5C220" }}>
                <Icon size={11} />
              </div>
              <span className="text-xs" style={{ color: "#888888" }}>{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ── Deploying Screen (polls API until live) ────────────────────────────────────

const DEPLOY_STEPS = [
  { label: "Uploading Dockerfile to CreateOS" },
  { label: "Building Docker image"            },
  { label: "Starting container"               },
  { label: "Agent is live!"                   },
];

function statusToStep(status: string): number {
  if (status === "pending")   return 0;
  if (status === "deploying") return 1;
  if (status === "deployed")  return 3;
  return 2;
}

function DeployingScreen({
  agentId,
  agentName,
  status,
  buildLogs,
  error,
  onRetry,
}: {
  agentId:   string;
  agentName: string;
  status:    string;
  buildLogs: string[];
  error:     string | null;
  onRetry:   () => void;
}) {
  const step    = statusToStep(status);
  const failed  = status === "failed";
  const logsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll build log to bottom
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [buildLogs]);

  return (
    <div className="mx-auto max-w-lg px-4 py-14 text-center">
      {/* Spinner / error icon */}
      <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
        <div
          className="relative flex h-16 w-16 items-center justify-center"
          style={failed
            ? { background: "rgba(214,40,40,0.1)", border: "2px solid #D62828" }
            : { background: "rgba(245,194,32,0.1)", border: "2px solid #F5C220" }
          }
        >
          {failed
            ? <AlertCircle size={32} style={{ color: "#D62828" }} />
            : <Loader2 size={32} className="animate-spin" style={{ color: "#F5C220" }} />
          }
        </div>
      </div>

      <h2 className="text-2xl font-black uppercase tracking-wider mb-1" style={{ color: "#F5F5F5" }}>
        {failed ? "Deployment Failed" : `Deploying ${agentName}…`}
      </h2>
      <p className="text-sm mb-8" style={{ color: "#888888" }}>
        {failed
          ? "Your container could not be started. See error below."
          : "Your Dockerfile is building on CreateOS. This usually takes 2–4 minutes."}
      </p>

      {/* Step list */}
      <div className="mb-6 flex flex-col gap-3 text-left">
        {DEPLOY_STEPS.map((s, i) => {
          const done    = !failed && i < step;
          const active  = !failed && i === step && status !== "deployed";
          const current = !failed && i === step && status === "deployed";
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 text-sm transition-all"
              style={current || done
                ? { background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }
                : active
                ? { background: "rgba(245,194,32,0.05)", border: "1px solid rgba(245,194,32,0.3)", color: "#F5C220" }
                : { background: "#1A1A1A", border: "1px solid #333333", color: "#555555" }
              }
            >
              {done || current
                ? <CheckCircle2 size={15} />
                : active
                ? <Loader2 size={15} className="animate-spin" />
                : <span className="flex h-4 w-4 items-center justify-center border border-current text-[10px]">{i + 1}</span>
              }
              {s.label}
            </div>
          );
        })}
      </div>

      {/* Build log */}
      {buildLogs.length > 0 && (
        <div className="p-3 text-left" style={{ background: "#000000", border: "1px solid #333333" }}>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: "#555555" }}>
            <Terminal size={11} /> Build Log
          </div>
          <div ref={logsRef} className="max-h-36 overflow-y-auto font-mono text-[11px] leading-relaxed" style={{ color: "#888888" }}>
            {buildLogs.slice(-20).map((line, i) => (
              <div key={i} className="py-px">{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Error detail */}
      {failed && error && (
        <div className="mt-4 px-4 py-3 text-left text-sm" style={{ background: "rgba(214,40,40,0.05)", border: "1px solid rgba(214,40,40,0.3)", color: "#D62828" }}>
          {error}
        </div>
      )}

      {failed && (
        <button
          onClick={onRetry}
          className="mt-6 flex items-center gap-2 mx-auto px-6 py-2.5 text-sm font-black uppercase tracking-wider transition-colors"
          style={{ background: "transparent", border: "2px solid #F5C220", color: "#F5C220" }}
        >
          <RefreshCw size={14} /> Try Again
        </button>
      )}

      {!failed && (
        <p className="mt-6 text-[11px]" style={{ color: "#555555" }}>
          Agent ID: <span className="font-mono" style={{ color: "#888888" }}>{agentId}</span>
        </p>
      )}
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────

function SuccessScreen({
  type, name, symbol, avatar, agentId, tokenAddress, curveAddress, txHash, onReset,
}: {
  type: TokenType; name: string; symbol: string; avatar: string;
  agentId: string | null; tokenAddress: string | null;
  curveAddress: string | null; txHash: string | null;
  onReset: () => void;
}) {
  const displayAddr = agentId ?? tokenAddress ?? null;
  const agentEndpoint = agentId ? `/agent/${agentId}/chat` : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-14 text-center">
      {/* Success icon */}
      <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
        <div className="relative flex h-16 w-16 items-center justify-center" style={{ background: "rgba(74,222,128,0.1)", border: "2px solid #4ade80" }}>
          <CheckCircle2 size={32} style={{ color: "#4ade80" }} />
        </div>
      </div>

      <div className="mb-1 text-3xl">{avatar}</div>
      <h2 className="text-3xl font-black uppercase tracking-wider mb-2" style={{ color: "#F5C220" }}>{name} is Live!</h2>
      <p className="mb-8" style={{ color: "#888888" }}>
        Your {TYPE_CONFIG[type].label.toLowerCase()}{" "}
        <span className="font-black" style={{ color: "#F5F5F5" }}>${symbol}</span> has been deployed to BNB Chain.
      </p>

      {/* Details card */}
      <div className="overflow-hidden mb-6 text-left" style={{ background: "#1A1A1A", border: "1px solid #4ade80" }}>
        <div className="h-0.5 w-full" style={{ background: "#4ade80" }} />
        <div className="flex flex-col gap-0" style={{ borderColor: "#333333" }}>
          {agentEndpoint && (
            <div className="flex items-start justify-between gap-3 px-5 py-3" style={{ borderBottom: "1px solid #333333" }}>
              <span className="text-xs mt-0.5 flex-shrink-0" style={{ color: "#888888" }}>Agent Endpoint</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs break-all" style={{ color: "#4ade80" }}>{agentEndpoint}</span>
                <button onClick={() => navigator.clipboard.writeText(agentEndpoint).catch(() => {})}>
                  <Copy size={12} className="flex-shrink-0" style={{ color: "#555555" }} />
                </button>
              </div>
            </div>
          )}
          {displayAddr && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #333333" }}>
              <span className="text-xs" style={{ color: "#888888" }}>{agentId ? "Agent ID" : "Token Contract"}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs" style={{ color: "#F5F5F5" }}>
                  {displayAddr.slice(0, 10)}…{displayAddr.slice(-8)}
                </span>
                <button onClick={() => navigator.clipboard.writeText(displayAddr).catch(() => {})}>
                  <Copy size={12} className="cursor-pointer" style={{ color: "#555555" }} />
                </button>
              </div>
            </div>
          )}
          {curveAddress && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #333333" }}>
              <span className="text-xs" style={{ color: "#888888" }}>Bonding Curve</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs" style={{ color: "#4ade80" }}>
                  {curveAddress.slice(0, 10)}…{curveAddress.slice(-8)}
                </span>
                <a href={`https://testnet.bscscan.com/address/${curveAddress}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={12} style={{ color: "#555555" }} />
                </a>
              </div>
            </div>
          )}
          {txHash && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #333333" }}>
              <span className="text-xs" style={{ color: "#888888" }}>Transaction</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs" style={{ color: "#F5F5F5" }}>
                  {txHash.slice(0, 10)}…{txHash.slice(-8)}
                </span>
                <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={12} style={{ color: "#555555" }} />
                </a>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs" style={{ color: "#888888" }}>Network</span>
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider" style={{ color: "#F5C220" }}>
              <span className="h-1.5 w-1.5 animate-pulse" style={{ background: "#F5C220" }} />
              BNB Chain Testnet
            </span>
          </div>
        </div>
        {agentEndpoint && (
          <div className="px-5 py-3" style={{ borderTop: "1px solid #333333", background: "rgba(27,78,248,0.05)" }}>
            <p className="text-[11px] flex items-start gap-1.5" style={{ color: "#1B4EF8" }}>
              <KeyRound size={11} className="mt-0.5 flex-shrink-0" />
              Token-gated: only wallets holding <strong style={{ color: "#1B4EF8" }}>{symbol}</strong> tokens can call this endpoint.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={
            agentId
              ? `/agent/${agentId}`
              : tokenAddress
              ? `/token/${tokenAddress}`
              : "#"
          }
          className="flex items-center justify-center gap-2 py-3.5 text-sm font-black uppercase tracking-wider transition-opacity hover:opacity-90"
          style={{ background: "#F5C220", color: "#0F0F0F" }}
        >
          <ArrowUpRight size={16} />
          {agentId ? "View Agent Page" : "View Token Page"}
        </a>
        <button
          onClick={onReset}
          className="py-3 text-sm font-black uppercase tracking-wider transition-colors"
          style={{ background: "transparent", border: "2px solid #333333", color: "#888888" }}
        >
          Launch Another
        </button>
      </div>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────

export function LaunchForm() {
  const [type, setType]         = useState<TokenType>("agent");
  const [form, setForm]         = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors]     = useState<Errors>({});
  const [touched, setTouched]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState("");

  // Fetch live agents for the skill-parent dropdown
  const { tokens: allTokens, isLoading: agentsLoading, error: agentsError } = useTokens();
  const agentTokens = allTokens.filter((t) => t.type === "agent");

  // Track the full selected-agent object for a preview card
  const [selectedAgent, setSelectedAgent] = useState<Token | null>(null);

  // Skill spec file state
  const [skillSpecFile, setSkillSpecFile] = useState<{ name: string; raw: string } | null>(null);
  const [skillSpecError, setSkillSpecError] = useState("");
  const skillFileRef = useRef<HTMLInputElement>(null);

  const handleSkillSpecFile = (file: File) => {
    setSkillSpecError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = (ev.target?.result as string) ?? "";
      setSkillSpecFile({ name: file.name, raw });

      // Try to parse as JSON and auto-fill fields
      try {
        const parsed = JSON.parse(raw);
        if (parsed.skillId)     set("skillId",     String(parsed.skillId).toUpperCase().replace(/\s+/g, "_"));
        if (parsed.name)        set("name",        String(parsed.name));
        if (parsed.symbol)      set("symbol",      String(parsed.symbol).toUpperCase());
        if (parsed.description) set("description", String(parsed.description));
        if (parsed.costPerUse)  set("costPerUse",  String(parsed.costPerUse));
      } catch {
        // Plain-text: use as description if description is empty
        if (!form.description.trim()) set("description", raw.slice(0, 280));
      }
    };
    reader.onerror = () => setSkillSpecError("Failed to read file.");
    reader.readAsText(file);
  };

  // Deployment polling state (agent type — Docker build on CreateOS)
  const [deployingAgentId,   setDeployingAgentId]   = useState<string | null>(null);
  const [deploymentStatus,   setDeploymentStatus]   = useState<string>("pending");
  const [deploymentError,    setDeploymentError]    = useState<string | null>(null);
  const [buildLogs,          setBuildLogs]          = useState<string[]>([]);

  const { isConnected, address } = useAccount();
  const { connect }              = useConnect();
  const chainId                  = useChainId();
  const { switchChain }          = useSwitchChain();
  const curveStats               = useCurveStats(form);
  const deployHook               = useTokenDeploy();

  const isWrongChain = isConnected && chainId !== bscTestnet.id;

  // ── React to on-chain deploy hook state ────────────────────────────────────
  useEffect(() => {
    if (deployHook.step === "done") {
      if (type === "agent" && deployHook.agentDbId) {
        // Hand off to Docker deployment polling screen
        setDeployingAgentId(deployHook.agentDbId);
        setDeploymentStatus("pending");
      } else if (type !== "agent") {
        // Normal / Skill: on-chain tx done → show success
        setSubmitted(true);
      }
      setLoading(false);
    } else if (deployHook.step === "error" && deployHook.error) {
      setApiError(deployHook.error);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployHook.step, deployHook.agentDbId, deployHook.error]);

  // ── Poll deployment status ─────────────────────────────────────────────────
  useEffect(() => {
    if (!deployingAgentId) return;
    if (deploymentStatus === "deployed" || deploymentStatus === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${API_URL}/api/agents/${deployingAgentId}/status`);
        const data = await res.json() as {
          status: string; error: string | null; buildLogs: string[];
        };
        setDeploymentStatus(data.status);
        setBuildLogs(data.buildLogs ?? []);
        if (data.status === "deployed") {
          setSubmitted(true);
        } else if (data.status === "failed") {
          setDeploymentError(data.error ?? "Deployment failed");
        }
      } catch {
        // Network error — keep polling silently
      }
    }, 5_000);

    return () => clearInterval(interval);
  }, [deployingAgentId, deploymentStatus]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set = (key: keyof FormState, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (touched) {
      setErrors(validate({ ...form, [key]: value }, type));
    }
  };

  const handleTypeChange = (t: TokenType) => {
    setType(t);
    setErrors({});
    setTouched(false);
    setApiError("");
    setForm((f) => ({ ...f, avatar: AVATARS[t][0] ?? f.avatar }));
  };


  const resetAll = () => {
    deployHook.reset();
    setSubmitted(false);
    setDeployingAgentId(null);
    setDeploymentStatus("pending");
    setDeploymentError(null);
    setBuildLogs([]);
    setApiError("");
    setLoading(false);
    setForm({ ...DEFAULT_FORM, avatar: AVATARS[type][0] ?? DEFAULT_FORM.avatar });
    setErrors({});
    setTouched(false);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleDeploy = async () => {
    if (!isConnected) {
      connect({ connector: injected() });
      return;
    }
    if (isWrongChain) {
      switchChain({ chainId: bscTestnet.id });
      return;
    }
    setTouched(true);
    setApiError("");
    const errs = validate(form, type);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    deployHook.reset();

    const safeAddr = (s: string): `0x${string}` =>
      /^0x[0-9a-fA-F]{40}$/.test(s.trim())
        ? (s.trim() as `0x${string}`)
        : "0x0000000000000000000000000000000000000000";

    if (type === "agent") {
      await deployHook.deploy({
        type:              "agent",
        name:              form.name.trim(),
        symbol:            form.symbol.trim(),
        supply:            parseEther(form.supply || "1000000000"),
        logicAddress:      safeAddr(form.logicAddress),
        metadataURI:       form.description.trim(),
        learningEnabled:   form.learningEnabled,
        treasury:          address!,
        developerWallet:   address!,
        dockerImage:       form.dockerImage.trim(),
        containerPort:     parseInt(form.containerPort, 10) || 3000,
        runEnvsJson:       form.runEnvsJson.trim(),
      });
    } else if (type === "normal") {
      await deployHook.deploy({
        type:             "normal",
        name:             form.name.trim(),
        symbol:           form.symbol.trim(),
        supply:           parseEther(form.supply || "1000000000"),
        maxSupply:        parseEther(form.maxSupply || "0"),
        virtualBNB:       parseEther(form.virtualBNB || "10"),
        graduationTarget: parseEther(form.graduationTarget || "69"),
        feeBps:           BigInt(Math.round(Number(form.feeBps) || 100)),
        creator:          address!,
      });
    } else if (type === "skill") {
      await deployHook.deploy({
        type:              "skill",
        name:              form.name.trim(),
        symbol:            form.symbol.trim(),
        supply:            parseEther(form.supply || "1000000000"),
        agentId:           BigInt(form.agentId || "0"),
        agentTokenAddress: form.agentTokenAddress.trim() as `0x${string}`,
        skillId:           form.skillId.trim(),
        costPerUse:        parseEther(form.costPerUse || "1"),
        skillPrompt:       form.skillPrompt.trim(),
      });
    }
    // Loading state cleared in the useEffect watching deployHook.step
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Deploying (agent Docker flow — waiting for CreateOS)
  if (deployingAgentId && !submitted && type === "agent") {
    return (
      <DeployingScreen
        agentId={deployingAgentId}
        agentName={form.name}
        status={deploymentStatus}
        buildLogs={buildLogs}
        error={deploymentError}
        onRetry={resetAll}
      />
    );
  }

  // Success
  if (submitted) {
    return (
      <SuccessScreen
        type={type}
        name={form.name}
        symbol={form.symbol}
        avatar={form.avatar}
        agentId={type === "agent" ? deployingAgentId : null}
        tokenAddress={deployHook.tokenAddress}
        curveAddress={deployHook.curveAddress}
        txHash={deployHook.txHash}
        onReset={resetAll}
      />
    );
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black uppercase tracking-wider" style={{ background: "rgba(245,194,32,0.1)", border: "1px solid rgba(245,194,32,0.3)", color: "#F5C220" }}>
          <Sparkles size={10} /> BNB Chain Testnet
        </div>
        <h1 className="text-3xl font-black uppercase tracking-wider md:text-5xl" style={{ color: "#F5F5F5" }}>
          Launch on{" "}
          <span style={{ color: "#F5C220" }}>AgentLaunch</span>
        </h1>
        <p className="mt-3" style={{ color: "#888888" }}>Deploy AI agents, tokens, and skill modules in seconds.</p>
      </div>

      {/* Type selector */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(Object.entries(TYPE_CONFIG) as [TokenType, (typeof TYPE_CONFIG)[TokenType]][]).map(
          ([key, cfg]) => {
            const Icon   = cfg.icon;
            const active = type === key;
            return (
              <button
                key={key} type="button" onClick={() => handleTypeChange(key)}
                className="group relative flex flex-col gap-3 p-5 text-left transition-all duration-200"
                style={active
                  ? { background: "#1A1A1A", borderTop: "1px solid #333333", borderRight: "1px solid #333333", borderBottom: "1px solid #333333", borderLeft: `3px solid ${cfg.activeLeftBorder}` }
                  : { background: "#1A1A1A", border: "1px solid #333333" }
                }
              >
                {/* Icon + badge row */}
                <div className="flex items-center justify-between">
                  <div
                    className="flex h-9 w-9 items-center justify-center transition-all"
                    style={active
                      ? { background: "#222222", border: `1px solid ${cfg.activeLeftBorder}` }
                      : { background: "#222222", border: "1px solid #555555" }
                    }
                  >
                    <Icon size={18} style={{ color: active ? cfg.activeLeftBorder : "#888888" }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {key === "agent" && (
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ background: "rgba(245,194,32,0.1)", border: "1px solid rgba(245,194,32,0.3)", color: "#F5C220" }}>
                        POPULAR
                      </span>
                    )}
                    {active && (
                      <span className="flex h-5 w-5 items-center justify-center" style={{ background: "#222222", border: `1px solid ${cfg.activeLeftBorder}`, color: cfg.activeLeftBorder }}>
                        <Check size={11} />
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="font-black uppercase tracking-wider text-sm transition-colors" style={{ color: active ? cfg.activeLeftBorder : "#888888" }}>{cfg.label}</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {cfg.features.slice(0, 3).map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs" style={{ color: "#555555" }}>
                        <span className="h-1.5 w-1.5 flex-shrink-0 transition-colors" style={{ background: active ? cfg.activeLeftBorder : "#555555" }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            );
          }
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* ── LEFT: Form ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 p-6" style={{ background: "#1A1A1A", border: "1px solid #333333" }}>

          {/* Section 1 — Basic Info */}
          <SectionHeading n={1} label="Basic Info" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Token Name" error={errors.name}>
              <input className={errors.name ? errorInputCls : inputCls}
                placeholder="e.g. ResearchAgent" value={form.name}
                onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Symbol" error={errors.symbol}>
              <input className={errors.symbol ? errorInputCls : inputCls}
                placeholder="e.g. RSCH" value={form.symbol} maxLength={10}
                onChange={(e) => set("symbol", e.target.value.toUpperCase())} />
            </Field>
          </div>
          <Field label="Total Supply" hint="Total tokens to mint." error={errors.supply}>
            <input className={errors.supply ? errorInputCls : inputCls}
              type="number" placeholder="1000000000" value={form.supply}
              onChange={(e) => set("supply", e.target.value)} />
          </Field>
          <Field label="Description" error={errors.description}>
            <div className="relative">
              <textarea
                className={`${errors.description ? errorInputCls : inputCls} min-h-[90px] resize-none pb-6`}
                placeholder="What does this token / agent do? (min. 20 characters)"
                value={form.description} maxLength={280}
                onChange={(e) => set("description", e.target.value)} />
              <span className="absolute bottom-2.5 right-3 text-[11px] font-mono" style={{ color: form.description.length > 240 ? "#F5C220" : "#555555" }}>
                {form.description.length}/280
              </span>
            </div>
          </Field>

          {/* ── Normal token ── */}
          {type === "normal" && (
            <>
              <SectionHeading n={2} label="Token Config" />
              <Field
                label="Max Supply Cap"
                hint={`0 = uncapped. If set, must be ≥ Total Supply (currently ${Number(form.supply || 0).toLocaleString()}).`}
                error={errors.maxSupply}
              >
                <input
                  className={errors.maxSupply ? errorInputCls : inputCls}
                  type="number" min="0" placeholder="0 = uncapped"
                  value={form.maxSupply}
                  onChange={(e) => set("maxSupply", e.target.value)}
                />
              </Field>

              <SectionHeading n={3} label="Bonding Curve Config" />
              <div className="grid grid-cols-3 gap-4">
                <Field label="Virtual BNB" hint="Initial virtual reserve (sets starting price)." error={errors.virtualBNB}>
                  <input className={errors.virtualBNB ? errorInputCls : inputCls}
                    type="number" value={form.virtualBNB}
                    onChange={(e) => set("virtualBNB", e.target.value)} />
                </Field>
                <Field label="Grad. Target (BNB)" hint="BNB to trigger PancakeSwap graduation." error={errors.graduationTarget}>
                  <input className={errors.graduationTarget ? errorInputCls : inputCls}
                    type="number" value={form.graduationTarget}
                    onChange={(e) => set("graduationTarget", e.target.value)} />
                </Field>
                <Field label="Fee (bps)" hint="100 bps = 1%. Max 500." error={errors.feeBps}>
                  <input className={errors.feeBps ? errorInputCls : inputCls}
                    type="number" max={500} value={form.feeBps}
                    onChange={(e) => set("feeBps", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {/* ── Agent ── */}
          {type === "agent" && (
            <>
              {/* Section 2 — Bonding Curve */}
              <SectionHeading n={2} label="Bonding Curve Config" />
              <div className="grid grid-cols-3 gap-4">
                <Field label="Virtual BNB" hint="Initial virtual reserve." error={errors.virtualBNB}>
                  <input className={errors.virtualBNB ? errorInputCls : inputCls}
                    type="number" value={form.virtualBNB}
                    onChange={(e) => set("virtualBNB", e.target.value)} />
                </Field>
                <Field label="Grad. Target (BNB)" hint="BNB to trigger PancakeSwap graduation." error={errors.graduationTarget}>
                  <input className={errors.graduationTarget ? errorInputCls : inputCls}
                    type="number" value={form.graduationTarget}
                    onChange={(e) => set("graduationTarget", e.target.value)} />
                </Field>
                <Field label="Fee (bps)" hint="100 bps = 1%. Max 500." error={errors.feeBps}>
                  <input className={errors.feeBps ? errorInputCls : inputCls}
                    type="number" max={500} value={form.feeBps}
                    onChange={(e) => set("feeBps", e.target.value)} />
                </Field>
              </div>

              {/* Section 3 — Agent Identity */}
              <SectionHeading n={3} label="Agent Identity" />
              <Field label="Logic Contract Address" hint="Optional — the on-chain logic contract.">
                <input className={inputCls} placeholder="0x... (optional, set later)"
                  value={form.logicAddress} onChange={(e) => set("logicAddress", e.target.value)} />
              </Field>
              <Toggle
                checked={form.learningEnabled}
                onChange={() => set("learningEnabled", !form.learningEnabled)}
                label="Enable Learning Module"
                sub="Allow this agent to receive on-chain learning updates after deployment."
              />

              {/* Section 4 — Docker Runtime */}
              <SectionHeading n={4} label="Agent Runtime (Docker)" />

              {/* Docker Hub image input */}
              <Field
                label="Docker Hub Image"
                hint="Build your image locally, push to Docker Hub, then paste the reference here."
                error={errors.dockerImage}
              >
                <input
                  className={errors.dockerImage ? errorInputCls : inputCls}
                  placeholder="username/myagent:latest"
                  value={form.dockerImage}
                  onChange={(e) => set("dockerImage", e.target.value)}
                />
              </Field>

              {/* Port + Token Address */}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Container Port"
                  hint="The port your app listens on inside the container (must match EXPOSE)."
                  error={errors.containerPort}
                >
                  <input
                    className={errors.containerPort ? errorInputCls : inputCls}
                    type="number" placeholder="3000" value={form.containerPort}
                    onChange={(e) => set("containerPort", e.target.value)}
                  />
                </Field>
                <Field
                  label="Token Address (optional)"
                  hint="ERC-20 token for API access gating. You can add this after token deployment."
                  error={errors.tokenAddress}
                >
                  <input
                    className={errors.tokenAddress ? errorInputCls : inputCls}
                    placeholder="0x... (link after deploy)"
                    value={form.tokenAddress}
                    onChange={(e) => set("tokenAddress", e.target.value)}
                  />
                </Field>
              </div>

              {/* Environment variables */}
              <Field
                label="Environment Variables (JSON)"
                hint='Injected into your container at runtime. e.g. {"OPENAI_API_KEY": "sk-..."}'
                error={errors.runEnvsJson}
              >
                <textarea
                  className="w-full px-4 py-3 font-mono text-xs outline-none transition-colors"
                  style={{
                    background: "#000000",
                    border: errors.runEnvsJson ? "1px solid #D62828" : "1px solid #333333",
                    color: "#F5F5F5",
                  }}
                  placeholder={'{\n  "OPENAI_API_KEY": "sk-...",\n  "MODEL": "gpt-4o"\n}'}
                  value={form.runEnvsJson}
                  rows={4}
                  spellCheck={false}
                  onChange={(e) => set("runEnvsJson", e.target.value)}
                />
              </Field>

              <div className="px-4 py-3 text-xs" style={{ background: "rgba(27,78,248,0.05)", border: "1px solid rgba(27,78,248,0.2)", color: "#1B4EF8" }}>
                <KeyRound size={11} className="inline mr-1.5" />
                After deployment, only wallets holding your{" "}
                <span className="font-mono">{form.symbol || "TOKEN"}</span> can call{" "}
                <span className="font-mono">/agent/&#123;id&#125;/chat</span>. Add your token address above to enable gating.
              </div>
            </>
          )}

          {/* ── Skill ── */}
          {type === "skill" && (
            <>
              <SectionHeading n={2} label="Skill Config" />

              {/* Parent agent dropdown */}
              <Field
                label="Parent Agent"
                hint="The AI agent this skill module will be attached to."
                error={errors.agentId}
              >
                <AgentDropdown
                  agents={agentTokens}
                  value={form.agentId}
                  onChange={(agentId, address, name) => {
                    set("agentId", agentId);
                    set("agentTokenAddress", address);
                    setSelectedAgent(
                      agentTokens.find((a) => a.address === address) ?? null
                    );
                  }}
                  isLoading={agentsLoading}
                  fetchError={agentsError}
                  fieldError={errors.agentId}
                />
              </Field>

              {/* Selected agent preview card */}
              {selectedAgent && (
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(27,78,248,0.05)", border: "1px solid rgba(27,78,248,0.2)" }}>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-2xl" style={{ background: "rgba(27,78,248,0.1)", border: "1px solid rgba(27,78,248,0.2)" }}>
                    {agentEmoji(selectedAgent.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black uppercase tracking-wider text-sm" style={{ color: "#F5F5F5" }}>{selectedAgent.name}</p>
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase" style={{ background: "rgba(27,78,248,0.1)", border: "1px solid rgba(27,78,248,0.2)", color: "#1B4EF8" }}>
                        <Bot size={9} className="mr-0.5 inline" />
                        Agent #{selectedAgent.agentId?.toString()}
                      </span>
                      {selectedAgent.isGraduated && (
                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
                          GRAD
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: "#888888" }}>
                      <span>${selectedAgent.symbol}</span>
                      <span style={{ color: "#333333" }}>·</span>
                      <span className="font-mono" style={{ color: "#555555" }}>
                        {selectedAgent.address.slice(0, 10)}…{selectedAgent.address.slice(-8)}
                      </span>
                      <a
                        href={`/agent/${selectedAgent.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5"
                        style={{ color: "#1B4EF8" }}
                      >
                        View <ExternalLink size={9} />
                      </a>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      set("agentId", "");
                      setSelectedAgent(null);
                    }}
                    className="flex-shrink-0 p-1.5 transition-colors"
                    style={{ border: "1px solid #333333", color: "#888888" }}
                    title="Clear selection"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* ── Skill Specification File Upload ── */}
              <div
                className="relative transition-colors"
                style={skillSpecFile
                  ? { background: "rgba(74,222,128,0.03)", border: "2px dashed rgba(74,222,128,0.4)" }
                  : { background: "#0F0F0F", border: "2px dashed #333333" }
                }
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleSkillSpecFile(file);
                }}
              >
                <input
                  ref={skillFileRef}
                  type="file"
                  accept=".txt,.json,.md,.yaml,.yml"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSkillSpecFile(file);
                    e.target.value = "";
                  }}
                />

                {skillSpecFile ? (
                  <div className="flex items-start gap-3 p-4">
                    <FileCheck size={20} className="mt-0.5 flex-shrink-0" style={{ color: "#4ade80" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black" style={{ color: "#F5F5F5" }}>{skillSpecFile.name}</p>
                      <p className="mt-0.5 line-clamp-2 font-mono text-[11px]" style={{ color: "#888888" }}>
                        {skillSpecFile.raw.slice(0, 120)}{skillSpecFile.raw.length > 120 ? "…" : ""}
                      </p>
                      <p className="mt-1 text-[10px]" style={{ color: "#4ade80" }}>Fields auto-filled from spec ↑</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSkillSpecFile(null); setSkillSpecError(""); }}
                      className="flex-shrink-0 p-1.5 transition-colors"
                      style={{ border: "1px solid #333333", color: "#888888" }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center" style={{ background: "#222222", border: "1px solid #333333" }}>
                      <Upload size={16} style={{ color: "#888888" }} />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>
                        Attach skill specification
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "#555555" }}>
                        Drop a <span style={{ color: "#888888" }}>.txt / .json / .md</span> file — fields will be auto-filled
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => skillFileRef.current?.click()}
                      className="mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors"
                      style={{ background: "transparent", border: "1px solid #333333", color: "#888888" }}
                    >
                      <FileText size={11} /> Browse files
                    </button>
                  </div>
                )}
              </div>
              {skillSpecError && (
                <p className="-mt-2 text-xs text-red-400">{skillSpecError}</p>
              )}

              {/* No agents yet CTA */}
              {!agentsLoading && agentTokens.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3 text-xs" style={{ background: "rgba(245,194,32,0.05)", border: "1px solid rgba(245,194,32,0.2)", color: "#F5C220" }}>
                  <AlertCircle size={12} className="flex-shrink-0" />
                  No agents deployed yet.{" "}
                  <button
                    type="button"
                    onClick={() => handleTypeChange("agent")}
                    className="underline"
                    style={{ color: "#F5C220" }}
                  >
                    Deploy an agent first
                  </button>
                  .
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Skill ID" hint="Unique on-chain identifier (bytes32)." error={errors.skillId}>
                  <input
                    className={errors.skillId ? errorInputCls : inputCls}
                    placeholder="e.g. RAG_RETRIEVAL"
                    value={form.skillId}
                    onChange={(e) =>
                      set("skillId", e.target.value.toUpperCase().replace(/\s+/g, "_"))
                    }
                  />
                </Field>
                <Field label="Cost Per Use" hint="Token amount burned per skill invocation.">
                  <input
                    className={inputCls}
                    type="number"
                    placeholder="1"
                    value={form.costPerUse}
                    onChange={(e) => set("costPerUse", e.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="Skill Prompt"
                hint="System-level instructions injected before the user's message when they hold this skill token. Leave empty for a display-only skill."
              >
                <textarea
                  className={inputCls + " min-h-[96px] resize-y"}
                  placeholder="e.g. You have access to live on-chain price data. Always include the current BNB price when answering financial questions."
                  value={form.skillPrompt}
                  onChange={(e) => set("skillPrompt", e.target.value)}
                />
              </Field>
            </>
          )}

          {/* Launch fee */}
          <div className="flex items-center justify-between px-4 py-3 text-sm" style={{ background: "rgba(245,194,32,0.04)", border: "1px solid rgba(245,194,32,0.15)" }}>
            <div className="flex items-center gap-2" style={{ color: "#888888" }}>
              <Coins size={14} style={{ color: "#F5C220" }} /> Launch fee
            </div>
            <span className="font-mono font-black" style={{ color: "#F5C220" }}>
              0 BNB <span className="text-xs font-normal" style={{ color: "#555555" }}>(testnet free)</span>
            </span>
          </div>

          {/* API error */}
          {apiError && (
            <div className="flex items-start gap-2 px-4 py-3 text-sm" style={{ background: "rgba(214,40,40,0.05)", border: "1px solid rgba(214,40,40,0.3)", color: "#D62828" }}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Validation summary */}
          {touched && hasErrors && (
            <div className="flex items-start gap-2 px-4 py-3 text-sm" style={{ background: "rgba(214,40,40,0.05)", border: "1px solid rgba(214,40,40,0.3)", color: "#D62828" }}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>Please fix the errors above before deploying.</span>
            </div>
          )}

          {/* Deploy button */}
          <button
            type="button" onClick={handleDeploy} disabled={loading}
            className="flex w-full items-center justify-center gap-2 py-4 text-sm font-black uppercase tracking-wider transition-all disabled:opacity-60"
            style={{ background: "#F5C220", color: "#0F0F0F", boxShadow: "none" }}
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> {deployHook.stepLabel || "Submitting…"}</>
            ) : !isConnected ? (
              <>Connect Wallet to Launch <ChevronRight size={16} /></>
            ) : isWrongChain ? (
              <><AlertCircle size={16} /> Switch to BSC Testnet</>
            ) : (
              <><Rocket size={16} /> Deploy {TYPE_CONFIG[type].label}</>
            )}
          </button>
        </div>

        {/* ── RIGHT: Preview ─────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <PreviewPanel
            form={form} type={type} curveStats={curveStats}
            onAvatarChange={(emoji) => set("avatar", emoji)}
          />
        </div>
      </div>
    </div>
  );
}
