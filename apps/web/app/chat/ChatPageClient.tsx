"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatEther } from "viem";
import { MessageSquare, Send, Cpu, Zap, ChevronRight, CheckSquare, Bot, User, Loader2, AlertCircle, Radio } from "lucide-react";
import { useTokens, type Token } from "../../hooks/useTokens";
import { ERC20_ABI } from "../../lib/contracts";

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  timestamp: number;
}

interface SkillInfo {
  name:        string;
  symbol:      string;
  description: string;
  address:     `0x${string}`;
}

interface AgentDbRecord {
  id:      string;
  status:  string;
  chatUrl: string | null;   // e.g. /api/agent/{id}/chat  (null = not deployed yet)
}

// Canonical access-message the user must sign to use the proxy endpoint.
// Must match buildAccessMessage in apps/api/src/lib/web3.ts.
function buildAccessMessage(agentId: string, timestampSeconds: number): string {
  return `AgentLaunch access\nagentId: ${agentId}\ntimestamp: ${timestampSeconds}`;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CREDITS_PER_TOKEN = 200;
const CREDIT_COST       = 1;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Agent tree node (agent + inline skill branches) ─────────────────────────

function AgentTreeNode({
  token,
  balance,
  selected,
  onSelect,
  skills,
  allSkills,
  skillsLoading,
  selectedSkillAddrs,
  onToggleSkill,
}: {
  token:              Token;
  balance:            bigint;
  selected:           boolean;
  onSelect:           () => void;
  skills:             SkillInfo[];
  allSkills:          SkillInfo[];
  skillsLoading:      boolean;
  selectedSkillAddrs: Set<string>;
  onToggleSkill:      (addr: string) => void;
}) {
  const credits   = Math.floor(Number(formatEther(balance)) * CREDITS_PER_TOKEN);
  const hasTokens = balance > 0n;

  return (
    <div className="select-none">
      {/* ── Agent row ── */}
      <button
        onClick={onSelect}
        disabled={!hasTokens}
        className="w-full text-left px-3 py-2.5 transition-all disabled:cursor-not-allowed"
        style={{
          border:     selected ? "1px solid #F5C220" : "1px solid #333333",
          background: selected ? "rgba(245,194,32,0.06)" : "#111111",
          opacity:    hasTokens ? 1 : 0.4,
        }}
        onMouseEnter={e => { if (!selected && hasTokens) (e.currentTarget as HTMLButtonElement).style.borderColor = "#555555"; }}
        onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = "#333333"; }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center text-sm flex-shrink-0" style={{ background: "#222222" }}>
            🤖
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wider truncate" style={{ color: "#F5F5F5" }}>{token.name}</p>
            <p className="text-[10px] font-mono" style={{ color: "#555555" }}>${token.symbol}</p>
          </div>
          <ChevronRight
            size={13}
            className="flex-shrink-0 transition-transform"
            style={{
              transform: selected ? "rotate(90deg)" : "none",
              color:     selected ? "#F5C220" : "#444444",
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[10px]">
          <span className="font-mono font-bold" style={{ color: hasTokens ? "#F5C220" : "#555555" }}>
            {Number(formatEther(balance)).toFixed(2)} tokens
          </span>
          {hasTokens && (
            <span style={{ color: "#555555" }}>
              <Zap size={8} className="inline mr-0.5" />{credits} credits
            </span>
          )}
          {!hasTokens && <span style={{ color: "#D62828" }}>No tokens</span>}
        </div>
      </button>

      {/* ── Skill branches (only when this agent is selected) ── */}
      {selected && (
        <div className="ml-3 mt-1 mb-1">
          {skillsLoading ? (
            <div className="flex items-center gap-2 pl-5 py-2">
              <Loader2 size={11} className="animate-spin" style={{ color: "#F5C220" }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#555555" }}>Loading skills…</span>
            </div>
          ) : allSkills.length === 0 ? (
            <div className="pl-5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#444444" }}>No skill tokens yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {allSkills.map((s, i) => {
                const owned    = skills.some((owned) => owned.address === s.address);
                const isActive = selectedSkillAddrs.has(s.address.toLowerCase());
                const isLast   = i === allSkills.length - 1;
                return (
                  <div key={s.address} className="flex items-stretch">
                    {/* Tree connector */}
                    <div className="flex flex-col items-center w-5 flex-shrink-0">
                      <div className="w-px flex-1" style={{ background: "#333333" }} />
                      <div className="w-3 border-b mt-0" style={{ borderColor: "#333333", ...(isLast ? { marginBottom: "auto" } : {}) }} />
                      {!isLast && <div className="w-px flex-1" style={{ background: "#333333" }} />}
                    </div>
                    {/* Skill row */}
                    <button
                      onClick={() => owned && onToggleSkill(s.address.toLowerCase())}
                      disabled={!owned}
                      title={owned ? (isActive ? "Deactivate skill" : "Activate skill") : "You don't hold this skill token"}
                      className="flex-1 flex items-center gap-2 text-left px-2 py-1.5 text-[11px] transition-colors disabled:cursor-not-allowed"
                      style={{
                        opacity:    owned ? 1 : 0.35,
                        background: isActive ? "rgba(245,194,32,0.06)" : "transparent",
                        borderLeft: isActive ? "2px solid #F5C220" : "2px solid transparent",
                      }}
                    >
                      <Zap
                        size={10}
                        className="flex-shrink-0"
                        style={{ color: isActive ? "#F5C220" : owned ? "#444444" : "#333333" }}
                      />
                      <span
                        className="truncate font-bold uppercase tracking-wider"
                        style={{ color: isActive ? "#F5F5F5" : owned ? "#888888" : "#555555" }}
                      >
                        {s.name}
                      </span>
                      <span className="text-[9px] font-mono ml-auto flex-shrink-0" style={{ color: "#555555" }}>${s.symbol}</span>
                      {isActive && (
                        <CheckSquare size={10} style={{ color: "#F5C220" }} className="flex-shrink-0" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className="w-8 h-8 flex items-center justify-center flex-shrink-0"
        style={{
          background: isUser ? "#F5C220" : "#222222",
          color:      isUser ? "#0F0F0F" : "#888888",
        }}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div
        className="max-w-[70%] px-4 py-3 text-sm leading-relaxed"
        style={isUser ? {
          background: "#F5C220",
          color:      "#0F0F0F",
        } : {
          background: "#1A1A1A",
          border:     "1px solid #333333",
          color:      "#E0E0E0",
        }}
      >
        {/* Render simple markdown-lite: **bold** and _italic_ */}
        {msg.content.split("\n").map((line, i) => {
          const rendered = line
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/_(.+?)_/g, "<em>$1</em>")
            .replace(/`(.+?)`/g, "<code style='background:rgba(0,0,0,0.3);padding:0 4px;font-size:11px'>$1</code>");
          return (
            <p
              key={i}
              className={i > 0 ? "mt-1" : ""}
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          );
        })}
        <p className="text-[10px] mt-2" style={{ color: isUser ? "rgba(0,0,0,0.4)" : "#555555" }}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ChatPageClient() {
  const { address, isConnected } = useAccount();
  const publicClient  = usePublicClient({ chainId: bscTestnet.id });
  const { data: walletClient } = useWalletClient({ chainId: bscTestnet.id });
  const { tokens, isLoading: tokensLoading } = useTokens();

  // ── All agent tokens from events ──────────────────────────────────────────
  const agentTokens = useMemo(() => tokens.filter((t) => t.type === "agent"), [tokens]);

  // ── Direct on-chain balance fetch ─────────────────────────────────────────
  const [agentBalances, setAgentBalances] = useState<Map<string, bigint>>(new Map());
  const [balancesLoading, setBalancesLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !address || !publicClient || agentTokens.length === 0) {
      setAgentBalances(new Map());
      return;
    }

    let cancelled = false;
    setBalancesLoading(true);

    Promise.all(
      agentTokens.map(async (t) => {
        try {
          const bal = await publicClient.readContract({
            address:      t.address,
            abi:          ERC20_ABI,
            functionName: "balanceOf",
            args:         [address],
          });
          return [t.address.toLowerCase(), bal as bigint] as const;
        } catch {
          return [t.address.toLowerCase(), 0n] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setAgentBalances(new Map(entries));
      setBalancesLoading(false);
    });

    return () => { cancelled = true; };
  // Re-fetch whenever address or token list changes
  }, [address, isConnected, publicClient, agentTokens.map((t) => t.address).join(",")]);

  // Only show agents where the user actually holds tokens
  const ownedAgentTokens = useMemo(
    () =>
      !balancesLoading && agentBalances.size > 0
        ? agentTokens.filter((t) => (agentBalances.get(t.address.toLowerCase()) ?? 0n) > 0n)
        : [],
    [agentTokens, agentBalances, balancesLoading]
  );

  // ── Selected agent ────────────────────────────────────────────────────────
  const [selectedAgent, setSelectedAgent] = useState<Token | null>(null);
  const agentBalance = selectedAgent
    ? (agentBalances.get(selectedAgent.address.toLowerCase()) ?? 0n)
    : 0n;
  const totalCredits = Math.floor(Number(formatEther(agentBalance)) * CREDITS_PER_TOKEN);

  // ── Fetch agent DB record (id + chatUrl) when agent is selected ───────────
  const [agentDb,        setAgentDb]        = useState<AgentDbRecord | null>(null);
  const [agentDbLoading, setAgentDbLoading] = useState(false);

  useEffect(() => {
    setAgentDb(null);
    if (!selectedAgent) return;

    let cancelled = false;
    setAgentDbLoading(true);

    fetch(`${API_URL}/api/agents/by-token/${selectedAgent.address}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setAgentDb({ id: data.id, status: data.status, chatUrl: data.chatUrl ?? null });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAgentDbLoading(false); });

    return () => { cancelled = true; };
  }, [selectedAgent?.address]);

  // ── Skills for selected agent (from events, filtered to user-held) ────────
  const agentSkillTokens = useMemo(() => {
    if (!selectedAgent?.agentId) return [];
    return tokens.filter(
      (t) => t.type === "skill" && String(t.agentId) === String(selectedAgent.agentId)
    );
  }, [tokens, selectedAgent?.agentId]);

  const [skillBalances,        setSkillBalances]        = useState<Map<string, bigint>>(new Map());
  const [skillBalancesLoading, setSkillBalancesLoading] = useState(false);

  useEffect(() => {
    setSkillBalances(new Map());
    if (!isConnected || !address || !publicClient || agentSkillTokens.length === 0) return;

    let cancelled = false;
    setSkillBalancesLoading(true);

    Promise.all(
      agentSkillTokens.map(async (t) => {
        try {
          const bal = await publicClient.readContract({
            address:      t.address,
            abi:          ERC20_ABI,
            functionName: "balanceOf",
            args:         [address],
          });
          return [t.address.toLowerCase(), bal as bigint] as const;
        } catch {
          return [t.address.toLowerCase(), 0n] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setSkillBalances(new Map(entries));
      setSkillBalancesLoading(false);
    });

    return () => { cancelled = true; };
  }, [address, isConnected, publicClient, agentSkillTokens.map((t) => t.address).join(",")]);

  // All skills for this agent
  const allSkills: SkillInfo[] = useMemo(
    () =>
      agentSkillTokens.map((t) => ({
        address:     t.address,
        name:        t.name,
        symbol:      t.symbol,
        description: t.description ?? "",
      })),
    [agentSkillTokens]
  );

  // Only skills the user actually holds
  const skills = useMemo(
    () =>
      skillBalancesLoading || skillBalances.size === 0
        ? []
        : allSkills.filter((s) => (skillBalances.get(s.address.toLowerCase()) ?? 0n) > 0n),
    [allSkills, skillBalances, skillBalancesLoading]
  );

  // ── Selected skills ───────────────────────────────────────────────────────
  const [selectedSkillAddrs, setSelectedSkillAddrs] = useState<Set<string>>(new Set());

  const toggleSkill = (addr: string) => {
    setSelectedSkillAddrs((prev) => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr);
      else next.add(addr);
      return next;
    });
  };

  // Reset skills when agent changes
  useEffect(() => { setSelectedSkillAddrs(new Set()); }, [selectedAgent?.address]);

  const activeSkills = skills.filter((s) => selectedSkillAddrs.has(s.address.toLowerCase()));

  // ── Chat state ────────────────────────────────────────────────────────────
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState("");
  const [sending,      setSending]      = useState(false);
  const [creditError,  setCreditError]  = useState<string | null>(null);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset chat when switching agents
  useEffect(() => {
    setMessages([]);
    setCreditsSpent(0);
    setCreditError(null);
  }, [selectedAgent?.address]);

  const creditsRemaining = totalCredits - creditsSpent;

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !selectedAgent || !address || sending) return;

    if (creditsRemaining < CREDIT_COST) {
      setCreditError("Not enough AI credits. Buy more tokens to continue.");
      return;
    }
    setCreditError(null);

    const userMsg: Message = {
      id:        crypto.randomUUID(),
      role:      "user",
      content:   input.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      // ── Route through the live proxy if agent is deployed ──────────────
      const isLive = !!agentDb?.chatUrl && agentDb.status === "deployed";

      // Helper: always-available fallback via /api/chat (uses Groq on the server)
      const callBuiltinChat = () =>
        fetch(`${API_URL}/api/chat`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            agentTokenAddress: selectedAgent.address,
            agentName:         selectedAgent.name,
            agentDescription:  selectedAgent.description,
            userAddress:       address,
            message:           userMsg.content,
            selectedSkills:    activeSkills.map((s) => ({ name: s.name, symbol: s.symbol })),
            history:           messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          }),
        });

      let res: Response;

      if (isLive && walletClient && agentDb) {
        // Try the live container first
        try {
          const timestampSeconds = Math.floor(Date.now() / 1000);
          const message = buildAccessMessage(agentDb.id, timestampSeconds);
          const signature = await walletClient.signMessage({ message });

          const liveRes = await fetch(`${API_URL}${agentDb.chatUrl}`, {
            method:  "POST",
            headers: {
              "Content-Type":     "application/json",
              "x-wallet-address": address,
              "x-signature":      signature,
              "x-timestamp":      String(timestampSeconds),
            },
            body: JSON.stringify({
              message:        userMsg.content,
              selectedSkills: activeSkills.map((s) => ({ name: s.name, symbol: s.symbol })),
              history:        messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
            }),
          });

          if (!liveRes.ok) throw new Error(`Agent endpoint ${liveRes.status}`);
          res = liveRes;
        } catch {
          // Live container unreachable or errored — silently fall back to Groq
          res = await callBuiltinChat();
        }
      } else {
        // No live container yet — go straight to /api/chat (Groq)
        res = await callBuiltinChat();
      }

      if (res.status === 403) {
        const err = await res.json();
        setCreditError(err.error ?? "Insufficient tokens to chat.");
        setSending(false);
        return;
      }

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json() as { reply: string; creditCost: number };

      const assistantMsg: Message = {
        id:        crypto.randomUUID(),
        role:      "assistant",
        content:   data.reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setCreditsSpent((prev) => prev + (data.creditCost ?? CREDIT_COST));
    } catch (e) {
      const errMsg: Message = {
        id:        crypto.randomUUID(),
        role:      "assistant",
        content:   "⚠️ Failed to reach the chat API. Make sure the API server is running.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [input, selectedAgent, address, sending, creditsRemaining, activeSkills, messages, agentDb, walletClient]);

  // Enter to send (shift+enter = newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - 64px)", background: "#0F0F0F" }}>
      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-80 flex-shrink-0 flex flex-col" style={{ background: "#111111", borderRight: "1px solid #333333" }}>
        {/* Header */}
        <div className="p-4" style={{ borderBottom: "1px solid #333333" }}>
          <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: "#F5F5F5" }}>
            <Cpu size={14} style={{ color: "#F5C220" }} />
            Your Agents
          </h2>
          <p className="text-[11px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "#555555" }}>Select an agent to chat</p>
        </div>

        {/* Connection gate */}
        {!isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <MessageSquare size={32} style={{ color: "#333333" }} />
            <p className="text-sm font-bold" style={{ color: "#555555" }}>Connect your wallet using the button in the top-right navbar.</p>
          </div>
        ) : (tokensLoading || (agentTokens.length > 0 && balancesLoading)) ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: "#F5C220" }} />
          </div>
        ) : ownedAgentTokens.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Bot size={32} style={{ color: "#333333" }} />
            <p className="text-sm font-bold" style={{ color: "#555555" }}>
              {agentTokens.length === 0
                ? "No agent tokens found on BSC Testnet"
                : "You don't hold any agent tokens yet"}
            </p>
            <a href="/explore" className="text-xs font-black uppercase tracking-wider" style={{ color: "#F5C220" }}>
              Browse agents to buy →
            </a>
          </div>
        ) : (
          /* Agent tree — agents the user holds, with skill branches */
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {ownedAgentTokens.map((t) => (
              <AgentTreeNode
                key={t.address}
                token={t}
                balance={agentBalances.get(t.address.toLowerCase()) ?? 0n}
                selected={selectedAgent?.address === t.address}
                onSelect={() => setSelectedAgent((prev) => (prev?.address === t.address ? null : t))}
                skills={skills}
                allSkills={selectedAgent?.address === t.address ? allSkills : []}
                skillsLoading={selectedAgent?.address === t.address ? skillBalancesLoading : false}
                selectedSkillAddrs={selectedSkillAddrs}
                onToggleSkill={toggleSkill}
              />
            ))}
          </div>
        )}
      </aside>

      {/* ── Main chat area ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-14 flex items-center justify-between px-5 flex-shrink-0" style={{ borderBottom: "1px solid #333333", background: "#111111" }}>
          {selectedAgent ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center" style={{ background: "#222222" }}>
                🤖
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>{selectedAgent.name}</p>
                <p className="text-[11px] font-mono" style={{ color: "#555555" }}>${selectedAgent.symbol}</p>
              </div>
              {/* Live-endpoint badge */}
              {agentDbLoading ? (
                <Loader2 size={11} className="animate-spin" style={{ color: "#555555" }} />
              ) : agentDb?.status === "deployed" && agentDb.chatUrl ? (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ border: "1px solid #4ade80", color: "#4ade80", background: "rgba(74,222,128,0.06)" }}>
                  <Radio size={8} className="animate-pulse" />
                  Live
                </span>
              ) : agentDb?.status === "deploying" ? (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ border: "1px solid #F5C220", color: "#F5C220", background: "rgba(245,194,32,0.06)" }}>
                  <Loader2 size={8} className="animate-spin" />
                  Deploying…
                </span>
              ) : agentDb ? (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ border: "1px solid #333333", color: "#555555" }}>
                  Fallback
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm font-bold uppercase tracking-wider" style={{ color: "#444444" }}>No agent selected</p>
          )}

          {/* Credit counter */}
          {selectedAgent && agentBalance > 0n && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs" style={{ background: "#222222", border: "1px solid #333333" }}>
              <Zap size={11} style={{ color: "#F5C220" }} />
              <span className="font-mono font-bold" style={{ color: creditsRemaining <= 5 ? "#D62828" : "#F5F5F5" }}>
                {creditsRemaining}
              </span>
              <span className="font-bold uppercase tracking-wider" style={{ color: "#555555" }}>credits</span>
            </div>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" style={{ background: "#0F0F0F" }}>
          {!isConnected ? (
            /* Not connected */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <MessageSquare size={48} style={{ color: "#333333" }} />
              <h3 className="text-lg font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>Connect to chat</h3>
              <p className="text-sm font-bold max-w-xs" style={{ color: "#555555" }}>
                Connect your wallet to access token-gated AI chat with your on-chain agents.
              </p>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#444444" }}>Use the wallet button in the top navigation bar to connect.</p>
            </div>
          ) : !selectedAgent ? (
            /* No agent selected */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <Bot size={48} style={{ color: "#333333" }} />
              <h3 className="text-lg font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>Select an agent</h3>
              <p className="text-sm font-bold max-w-xs" style={{ color: "#555555" }}>
                Choose an agent from the left panel. You need to hold the agent&apos;s token to unlock AI credits.
                <br /><br />
                <strong style={{ color: "#F5C220" }}>1 token = {CREDITS_PER_TOKEN} AI credits</strong>
                <br />
                Each message costs {CREDIT_COST} credit.
              </p>
            </div>
          ) : agentBalance === 0n ? (
            /* No tokens */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <AlertCircle size={48} style={{ color: "#D62828", opacity: 0.5 }} />
              <h3 className="text-lg font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>No tokens held</h3>
              <p className="text-sm font-bold max-w-xs" style={{ color: "#555555" }}>
                You don&apos;t hold any <strong style={{ color: "#F5F5F5" }}>{selectedAgent.symbol}</strong> tokens.
                Buy tokens on the bonding curve to earn AI credits.
              </p>
              <a
                href={`/token/${selectedAgent.address}`}
                className="px-5 py-2.5 text-sm font-black uppercase tracking-wider transition-colors"
                style={{ background: "#F5C220", color: "#0F0F0F" }}
              >
                Buy {selectedAgent.symbol} tokens
              </a>
            </div>
          ) : messages.length === 0 ? (
            /* Welcome state — agent selected + has tokens */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 flex items-center justify-center text-3xl" style={{ background: "#222222", border: "1px solid #333333" }}>
                🤖
              </div>
              <h3 className="text-lg font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>Chat with {selectedAgent.name}</h3>
              <p className="text-sm font-bold max-w-sm" style={{ color: "#555555" }}>
                You have <span className="font-black" style={{ color: "#F5C220" }}>{totalCredits} AI credits</span> from{" "}
                {Number(formatEther(agentBalance)).toFixed(4)} tokens.
                {activeSkills.length > 0 && (
                  <> Active skills: {activeSkills.map((s) => s.name).join(", ")}.</>
                )}
              </p>
              {activeSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {activeSkills.map((s) => (
                    <span key={s.address} className="text-[11px] px-2 py-0.5 font-black uppercase tracking-wider" style={{ background: "rgba(245,194,32,0.1)", border: "1px solid rgba(245,194,32,0.3)", color: "#F5C220" }}>
                      ⚡ {s.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#444444" }}>Type a message below to start</p>
            </div>
          ) : (
            /* Messages */
            <>
              {messages.map((m) => <ChatBubble key={m.id} msg={m} />)}
              {sending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: "#222222", color: "#888888" }}>
                    <Bot size={14} />
                  </div>
                  <div className="px-4 py-3" style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 animate-bounce [animation-delay:0ms]" style={{ background: "rgba(245,194,32,0.6)" }} />
                      <span className="w-1.5 h-1.5 animate-bounce [animation-delay:150ms]" style={{ background: "rgba(245,194,32,0.6)" }} />
                      <span className="w-1.5 h-1.5 animate-bounce [animation-delay:300ms]" style={{ background: "rgba(245,194,32,0.6)" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Active skill chips */}
        {activeSkills.length > 0 && selectedAgent && agentBalance > 0n && (
          <div className="px-6 pb-2 flex flex-wrap gap-1.5" style={{ background: "#0F0F0F" }}>
            {activeSkills.map((s) => (
              <span key={s.address} className="text-[11px] px-2 py-0.5 font-black uppercase tracking-wider" style={{ background: "rgba(245,194,32,0.1)", border: "1px solid rgba(245,194,32,0.3)", color: "#F5C220" }}>
                ⚡ {s.name}
              </span>
            ))}
          </div>
        )}

        {/* Credit error */}
        {creditError && (
          <div className="mx-6 mb-2 flex items-center gap-2 text-xs font-bold px-3 py-2" style={{ color: "#D62828", border: "1px solid rgba(214,40,40,0.4)", background: "rgba(214,40,40,0.06)" }}>
            <AlertCircle size={12} />
            {creditError}
          </div>
        )}

        {/* Input area */}
        <div className="p-4" style={{ borderTop: "1px solid #333333", background: "#111111" }}>
          <div
            className="flex gap-3 items-end px-4 py-3 transition-colors"
            style={{
              background: "#1A1A1A",
              border:     `2px solid ${selectedAgent && agentBalance > 0n ? "#333333" : "#222222"}`,
              opacity:    selectedAgent && agentBalance > 0n ? 1 : 0.5,
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !isConnected
                  ? "Connect wallet to chat…"
                  : !selectedAgent
                  ? "Select an agent first…"
                  : agentBalance === 0n
                  ? "Buy tokens to unlock AI credits…"
                  : creditsRemaining <= 0
                  ? "No credits remaining…"
                  : `Message ${selectedAgent.name}… (Enter to send)`
              }
              disabled={!isConnected || !selectedAgent || agentBalance === 0n || creditsRemaining <= 0 || sending}
              rows={1}
              className="flex-1 bg-transparent text-sm outline-none resize-none min-h-[24px] max-h-[120px]"
              style={{ color: "#F5F5F5", lineHeight: "1.5" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !selectedAgent || agentBalance === 0n || creditsRemaining < CREDIT_COST || sending}
              className="w-8 h-8 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              style={{ background: "#F5C220", color: "#0F0F0F" }}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1.5 text-right" style={{ color: "#444444" }}>
            1 token = {CREDITS_PER_TOKEN} credits · {CREDIT_COST} credit/message
          </p>
        </div>
      </main>
    </div>
  );
}
