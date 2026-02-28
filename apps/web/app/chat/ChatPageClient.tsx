"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatEther } from "viem";
import { MessageSquare, Send, Cpu, Zap, ChevronRight, CheckSquare, Square, Bot, User, Loader2, AlertCircle, CheckCircle, Radio } from "lucide-react";
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

// ── Skill toggle checkbox ────────────────────────────────────────────────────

function SkillToggle({
  skill,
  selected,
  onToggle,
}: {
  skill:    SkillInfo;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-start gap-2 w-full text-left p-2 rounded-lg transition-colors hover:bg-[#2a2a35] group"
    >
      <span className="mt-0.5 text-[#F3BA2F] flex-shrink-0">
        {selected ? <CheckSquare size={15} /> : <Square size={15} className="opacity-40 group-hover:opacity-70" />}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-white truncate">{skill.name}</p>
        <p className="text-[10px] text-[#6b7280] truncate">${skill.symbol}</p>
      </div>
    </button>
  );
}

// ── Agent sidebar card ───────────────────────────────────────────────────────

function AgentCard({
  token,
  balance,
  selected,
  onSelect,
}: {
  token:    Token;
  balance:  bigint;
  selected: boolean;
  onSelect: () => void;
}) {
  const credits   = Math.floor(Number(formatEther(balance)) * CREDITS_PER_TOKEN);
  const hasTokens = balance > 0n;

  return (
    <button
      onClick={onSelect}
      disabled={!hasTokens}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        selected
          ? "border-[#F3BA2F] bg-[#F3BA2F]/10"
          : hasTokens
          ? "border-[#2a2a35] bg-[#16161a] hover:border-[#F3BA2F]/40"
          : "border-[#2a2a35] bg-[#16161a]/50 opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F3BA2F]/30 to-purple-600/30 flex items-center justify-center text-sm">
          🤖
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{token.name}</p>
          <p className="text-[11px] text-[#6b7280]">${token.symbol}</p>
        </div>
        {selected && <ChevronRight size={14} className="text-[#F3BA2F] flex-shrink-0" />}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <span className={`font-medium ${hasTokens ? "text-[#F3BA2F]" : "text-[#6b7280]"}`}>
          {Number(formatEther(balance)).toFixed(4)} tokens
        </span>
        {hasTokens && (
          <span className="text-[#6b7280]">
            <Zap size={9} className="inline mr-0.5" />
            {credits} credits
          </span>
        )}
        {!hasTokens && (
          <span className="text-red-400">No tokens — buy first</span>
        )}
      </div>
    </button>
  );
}

// ── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-[#F3BA2F]/20 text-[#F3BA2F]" : "bg-purple-600/20 text-purple-400"
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-[#F3BA2F] text-black rounded-tr-sm"
            : "bg-[#1e1e26] border border-[#2a2a35] text-[#e0e0e0] rounded-tl-sm"
        }`}
      >
        {/* Render simple markdown-lite: **bold** and _italic_ */}
        {msg.content.split("\n").map((line, i) => {
          const rendered = line
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/_(.+?)_/g, "<em>$1</em>")
            .replace(/`(.+?)`/g, "<code class='bg-black/30 px-1 rounded text-xs'>$1</code>");
          return (
            <p
              key={i}
              className={i > 0 ? "mt-1" : ""}
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          );
        })}
        <p className={`text-[10px] mt-2 ${isUser ? "text-black/50" : "text-[#4b5563]"}`}>
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
  // We use publicClient.readContract directly (not useReadContracts) so that
  // the wallet address is always the live value and there's no wagmi cache drift.
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

  const [skillBalances,      setSkillBalances]      = useState<Map<string, bigint>>(new Map());
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

      let res: Response;

      if (isLive && walletClient && agentDb) {
        // Sign the canonical access-message for the token-gate middleware.
        const timestampSeconds = Math.floor(Date.now() / 1000);
        const message = buildAccessMessage(agentDb.id, timestampSeconds);
        const signature = await walletClient.signMessage({ message });

        res = await fetch(`${API_URL}${agentDb.chatUrl}`, {
          method:  "POST",
          headers: {
            "Content-Type":    "application/json",
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
      } else {
        // Fallback: standard /api/chat endpoint (no live container yet)
        res = await fetch(`${API_URL}/api/chat`, {
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
    <div className="flex h-[calc(100vh-64px)] bg-[#0e0e11] overflow-hidden">
      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-80 flex-shrink-0 border-r border-[#2a2a35] flex flex-col bg-[#0e0e11]">
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a35]">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Cpu size={14} className="text-[#F3BA2F]" />
            Your Agents
          </h2>
          <p className="text-[11px] text-[#6b7280] mt-0.5">Select an agent to chat</p>
        </div>

        {/* Connection gate */}
        {!isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <MessageSquare size={32} className="text-[#2a2a35]" />
            <p className="text-sm text-[#6b7280]">Connect your wallet using the button in the top-right navbar.</p>
          </div>
        ) : (tokensLoading || (agentTokens.length > 0 && balancesLoading)) ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-[#F3BA2F]" />
          </div>
        ) : ownedAgentTokens.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Bot size={32} className="text-[#2a2a35]" />
            <p className="text-sm text-[#6b7280]">
              {agentTokens.length === 0
                ? "No agent tokens found on BSC Testnet"
                : "You don't hold any agent tokens yet"}
            </p>
            <a href="/explore" className="text-xs text-[#F3BA2F] underline underline-offset-2">
              Browse agents to buy →
            </a>
          </div>
        ) : (
          /* Agent list — only agents the user holds */
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {ownedAgentTokens.map((t) => (
              <AgentCard
                key={t.address}
                token={t}
                balance={agentBalances.get(t.address.toLowerCase()) ?? 0n}
                selected={selectedAgent?.address === t.address}
                onSelect={() => setSelectedAgent((prev) => (prev?.address === t.address ? null : t))}
              />
            ))}
          </div>
        )}

        {/* ── Skill tree (shown when agent is selected) ──────────────────── */}
        {selectedAgent && (
          <div className="border-t border-[#2a2a35]">
            <div className="p-3 pb-1">
              <h3 className="text-xs font-semibold text-[#F3BA2F] flex items-center gap-1.5">
                <Zap size={11} />
                Skill Modules
              </h3>
              <p className="text-[10px] text-[#6b7280] mt-0.5">Toggle skills to include as context</p>
            </div>
            <div className="max-h-48 overflow-y-auto px-2 pb-2">
              {skillBalancesLoading ? (
                <div className="flex items-center gap-2 px-2 py-3">
                  <Loader2 size={12} className="animate-spin text-[#F3BA2F]" />
                  <span className="text-[11px] text-[#6b7280]">Loading skills…</span>
                </div>
              ) : allSkills.length === 0 ? (
                <p className="text-[11px] text-[#6b7280] italic px-2 py-3">
                  No skill tokens launched for this agent yet.
                </p>
              ) : skills.length === 0 ? (
                <p className="text-[11px] text-[#6b7280] italic px-2 py-3">
                  You don't hold any skill tokens for this agent.
                </p>
              ) : (
                skills.map((s) => (
                  <SkillToggle
                    key={s.address}
                    skill={s}
                    selected={selectedSkillAddrs.has(s.address.toLowerCase())}
                    onToggle={() => toggleSkill(s.address.toLowerCase())}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main chat area ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-14 border-b border-[#2a2a35] flex items-center justify-between px-5 flex-shrink-0">
          {selectedAgent ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F3BA2F]/30 to-purple-600/30 flex items-center justify-center">
                🤖
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{selectedAgent.name}</p>
                <p className="text-[11px] text-[#6b7280]">${selectedAgent.symbol}</p>
              </div>
              {/* Live-endpoint badge */}
              {agentDbLoading ? (
                <Loader2 size={11} className="animate-spin text-[#6b7280]" />
              ) : agentDb?.status === "deployed" && agentDb.chatUrl ? (
                <span className="flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                  <Radio size={8} className="animate-pulse" />
                  Live endpoint
                </span>
              ) : agentDb?.status === "deploying" ? (
                <span className="flex items-center gap-1 rounded-full border border-bnb-yellow/30 bg-bnb-yellow/10 px-2 py-0.5 text-[10px] font-medium text-bnb-yellow">
                  <Loader2 size={8} className="animate-spin" />
                  Deploying…
                </span>
              ) : agentDb ? (
                <span className="flex items-center gap-1 rounded-full border border-[#2a2a35] bg-[#1e1e26] px-2 py-0.5 text-[10px] text-[#6b7280]">
                  Fallback mode
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[#6b7280]">No agent selected</p>
          )}

          {/* Credit counter */}
          {selectedAgent && agentBalance > 0n && (
            <div className="flex items-center gap-2 text-xs bg-[#1e1e26] border border-[#2a2a35] rounded-full px-3 py-1.5">
              <Zap size={11} className="text-[#F3BA2F]" />
              <span className={creditsRemaining <= 5 ? "text-red-400" : "text-white"}>
                {creditsRemaining}
              </span>
              <span className="text-[#6b7280]">credits</span>
            </div>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!isConnected ? (
            /* Not connected */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <MessageSquare size={48} className="text-[#2a2a35]" />
              <h3 className="text-lg font-semibold text-white">Connect to chat</h3>
              <p className="text-sm text-[#6b7280] max-w-xs">
                Connect your wallet to access token-gated AI chat with your on-chain agents.
              </p>
              <p className="text-xs text-[#6b7280]">Use the wallet button in the top navigation bar to connect.</p>
            </div>
          ) : !selectedAgent ? (
            /* No agent selected */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <Bot size={48} className="text-[#2a2a35]" />
              <h3 className="text-lg font-semibold text-white">Select an agent</h3>
              <p className="text-sm text-[#6b7280] max-w-xs">
                Choose an agent from the left panel. You need to hold the agent's token to unlock AI credits.
                <br /><br />
                <strong className="text-[#F3BA2F]">1 token = {CREDITS_PER_TOKEN} AI credits</strong>
                <br />
                Each message costs {CREDIT_COST} credit.
              </p>
            </div>
          ) : agentBalance === 0n ? (
            /* No tokens */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <AlertCircle size={48} className="text-red-500/50" />
              <h3 className="text-lg font-semibold text-white">No tokens held</h3>
              <p className="text-sm text-[#6b7280] max-w-xs">
                You don't hold any <strong className="text-white">{selectedAgent.symbol}</strong> tokens.
                Buy tokens on the bonding curve to earn AI credits.
              </p>
              <a
                href={`/token/${selectedAgent.address}`}
                className="px-4 py-2 bg-[#F3BA2F] text-black text-sm font-semibold rounded-lg hover:bg-[#F3BA2F]/90 transition-colors"
              >
                Buy {selectedAgent.symbol} tokens
              </a>
            </div>
          ) : messages.length === 0 ? (
            /* Welcome state — agent selected + has tokens */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F3BA2F]/20 to-purple-600/20 flex items-center justify-center text-3xl">
                🤖
              </div>
              <h3 className="text-lg font-semibold text-white">Chat with {selectedAgent.name}</h3>
              <p className="text-sm text-[#6b7280] max-w-sm">
                You have <span className="text-[#F3BA2F] font-semibold">{totalCredits} AI credits</span> from{" "}
                {Number(formatEther(agentBalance)).toFixed(4)} tokens.
                {activeSkills.length > 0 && (
                  <> Active skills: {activeSkills.map((s) => s.name).join(", ")}.</>
                )}
              </p>
              {activeSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {activeSkills.map((s) => (
                    <span key={s.address} className="text-[11px] bg-purple-600/20 text-purple-300 border border-purple-600/30 rounded-full px-2 py-0.5">
                      ⚡ {s.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-[#4b5563]">Type a message below to start</p>
            </div>
          ) : (
            /* Messages */
            <>
              {messages.map((m) => <ChatBubble key={m.id} msg={m} />)}
              {sending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="bg-[#1e1e26] border border-[#2a2a35] rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F3BA2F]/60 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F3BA2F]/60 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F3BA2F]/60 animate-bounce [animation-delay:300ms]" />
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
          <div className="px-6 pb-2 flex flex-wrap gap-1.5">
            {activeSkills.map((s) => (
              <span key={s.address} className="text-[11px] bg-purple-600/20 text-purple-300 border border-purple-600/30 rounded-full px-2 py-0.5">
                ⚡ {s.name}
              </span>
            ))}
          </div>
        )}

        {/* Credit error */}
        {creditError && (
          <div className="mx-6 mb-2 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={12} />
            {creditError}
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-[#2a2a35] p-4">
          <div
            className={`flex gap-3 items-end bg-[#16161a] border rounded-xl px-4 py-3 transition-colors ${
              selectedAgent && agentBalance > 0n
                ? "border-[#2a2a35] focus-within:border-[#F3BA2F]/50"
                : "border-[#2a2a35] opacity-50"
            }`}
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
              className="flex-1 bg-transparent text-sm text-white placeholder-[#4b5563] resize-none outline-none min-h-[24px] max-h-[120px]"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !selectedAgent || agentBalance === 0n || creditsRemaining < CREDIT_COST || sending}
              className="w-8 h-8 rounded-lg bg-[#F3BA2F] text-black flex items-center justify-center transition-all hover:bg-[#F3BA2F]/90 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-[#4b5563] mt-1.5 text-right">
            1 token = {CREDITS_PER_TOKEN} credits · {CREDIT_COST} credit/message
          </p>
        </div>
      </main>
    </div>
  );
}
