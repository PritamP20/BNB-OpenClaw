"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import {
  Code2, Copy, Check, Terminal, Zap, Globe, Key, BookOpen,
  ChevronDown, ChevronRight, Bot,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="flex items-center gap-1.5 text-[11px] text-[#6b7280] hover:text-white transition-colors"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="relative rounded-xl border border-[#2a2a35] bg-[#0a0a0f] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a35] bg-[#111118]">
        <span className="text-[10px] font-mono text-[#6b7280] uppercase tracking-wider">{lang}</span>
        <CopyBtn text={code} />
      </div>
      <pre className="px-4 py-4 text-sm font-mono text-[#e2e8f0] overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

// ── Collapsible section ────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#2a2a35] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-[#111118] hover:bg-[#16161e] transition-colors"
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold text-white">
          <Icon size={15} className="text-[#F3BA2F]" />
          {title}
        </span>
        {open ? <ChevronDown size={15} className="text-[#6b7280]" /> : <ChevronRight size={15} className="text-[#6b7280]" />}
      </button>
      {open && <div className="px-5 py-5 space-y-5 bg-[#0e0e13]">{children}</div>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────

function Method({ m }: { m: "POST" | "GET" }) {
  return (
    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
      m === "POST" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                   : "bg-green-500/20 text-green-300 border border-green-500/30"
    }`}>
      {m}
    </span>
  );
}

function Param({ name, type, req, desc }: { name: string; type: string; req?: boolean; desc: string }) {
  return (
    <div className="flex gap-4 py-2.5 border-b border-[#1e1e28] last:border-0">
      <div className="w-48 flex-shrink-0">
        <code className="text-xs text-[#F3BA2F] font-mono">{name}</code>
        {req && <span className="ml-1.5 text-[9px] text-red-400 font-semibold">required</span>}
      </div>
      <code className="text-[10px] text-[#6b7280] font-mono w-20 flex-shrink-0 pt-0.5">{type}</code>
      <p className="text-xs text-[#9a9aaa]">{desc}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SDKPage() {
  const { address } = useAccount();
  const walletAddr  = address ?? "0xYOUR_WALLET_ADDRESS";
  const agentAddr   = "0xAGENT_TOKEN_ADDRESS";

  const curlChat = `curl -X POST ${API_URL}/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentTokenAddress": "${agentAddr}",
    "userAddress":       "${walletAddr}",
    "agentName":         "MyAgent",
    "agentDescription":  "A Web3-native AI agent",
    "message":           "What is BNB Chain?",
    "history":           []
  }'`;

  const jsChat = `const response = await fetch("${API_URL}/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agentTokenAddress: "${agentAddr}",
    userAddress:       "${walletAddr}",
    agentName:         "MyAgent",
    agentDescription:  "A Web3-native AI agent",
    message:           "What is BNB Chain?",
    history:           [],
  }),
});

const { reply, creditCost, tokensHeld, activeSkills } = await response.json();
console.log(reply);`;

  const pythonChat = `import requests

resp = requests.post("${API_URL}/api/chat", json={
    "agentTokenAddress": "${agentAddr}",
    "userAddress":       "${walletAddr}",
    "agentName":         "MyAgent",
    "agentDescription":  "A Web3-native AI agent",
    "message":           "What is BNB Chain?",
    "history":           [],
})

data = resp.json()
print(data["reply"])
print("Active skills:", data["activeSkills"])`;

  const mcpConfig = `{
  "mcpServers": {
    "openclaw-agent": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"],
      "env": {
        "FETCH_BASE_URL": "${API_URL}"
      }
    }
  }
}`;

  const mcpFetch = `# Ask your agent directly from Claude Code:
# 1. Add the MCP config above to ~/.claude/claude_desktop_config.json
# 2. Restart Claude Desktop / Claude Code
# 3. Use the fetch tool to call the agent:

POST ${API_URL}/api/chat
{
  "agentTokenAddress": "${agentAddr}",
  "userAddress":       "${walletAddr}",
  "message":           "Explain impermanent loss"
}`;

  const curlTokens = `# Get all agent tokens
curl ${API_URL}/api/tokens

# Get skills linked to an agent token
curl ${API_URL}/api/skills/by-agent/${agentAddr}`;

  const jsStream = `// Conversational loop with history
const history = [];

async function chat(message) {
  const res = await fetch("${API_URL}/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentTokenAddress: "${agentAddr}",
      userAddress:       "${walletAddr}",
      message,
      history,           // pass previous turns for context
    }),
  });
  const data = await res.json();
  history.push({ role: "user",      content: message       });
  history.push({ role: "assistant", content: data.reply    });
  return data.reply;
}

console.log(await chat("Hi, what can you do?"));
console.log(await chat("Tell me about DeFi yields"));`;

  return (
    <div className="min-h-screen bg-[#08080c] text-white">
      {/* Header */}
      <div className="border-b border-[#2a2a35] bg-[#0e0e13]">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#F3BA2F]/10 border border-[#F3BA2F]/20 flex items-center justify-center">
              <Code2 size={18} className="text-[#F3BA2F]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Developer SDK</h1>
              <p className="text-sm text-[#6b7280]">Integrate AI agents into any app or tool</p>
            </div>
          </div>
          <p className="text-sm text-[#9a9aaa] max-w-2xl mt-4">
            Every agent on OpenClaw exposes a simple REST endpoint. No SDK required — use{" "}
            <code className="text-[#F3BA2F] bg-[#F3BA2F]/10 px-1.5 py-0.5 rounded text-xs">fetch</code>,{" "}
            <code className="text-[#F3BA2F] bg-[#F3BA2F]/10 px-1.5 py-0.5 rounded text-xs">curl</code>, Python, or any HTTP client.
            Token-gating is verified on‑chain — holding the agent token is your API key.
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mt-6">
            {[
              { icon: Key,      label: "Auth",     value: "Wallet address + token balance" },
              { icon: Zap,      label: "AI",       value: "Groq Llama 3.3 70B (free tier)" },
              { icon: Globe,    label: "Base URL",  value: API_URL },
              { icon: Bot,      label: "Skills",   value: "Injected automatically" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 bg-[#111118] border border-[#2a2a35] rounded-xl px-4 py-2.5">
                <Icon size={13} className="text-[#F3BA2F]" />
                <span className="text-[11px] text-[#6b7280]">{label}:</span>
                <span className="text-[11px] text-white font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-5">

        {/* Authentication */}
        <Section title="Authentication" icon={Key}>
          <p className="text-sm text-[#9a9aaa]">
            There are no API keys. Access is token-gated on‑chain. Pass your wallet address
            as <code className="text-[#F3BA2F] text-xs">userAddress</code> — the server checks
            your on‑chain balance of the agent token in real time. Hold ≥ 1 wei to get access.
          </p>
          <div className="bg-[#111118] border border-[#F3BA2F]/20 rounded-xl p-4 text-sm">
            <p className="text-[#F3BA2F] font-semibold text-xs mb-1">Your wallet address (auto-filled when connected)</p>
            <code className="text-white font-mono text-xs break-all">{walletAddr}</code>
          </div>
          <p className="text-xs text-[#6b7280]">
            Each message costs <strong className="text-white">1 credit</strong>. Credits are calculated from your token
            balance: <strong className="text-white">1 whole token = 200 credits</strong>.
          </p>
        </Section>

        {/* Chat endpoint */}
        <Section title="POST /api/chat — Send a message" icon={Terminal}>
          <div className="flex items-center gap-3 mb-1">
            <Method m="POST" />
            <code className="text-sm font-mono text-white">/api/chat</code>
          </div>
          <p className="text-sm text-[#9a9aaa]">
            Send a message and receive an AI reply. Skills held by the user are automatically
            injected as system context.
          </p>

          <div>
            <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-2">Request body</p>
            <div className="rounded-xl border border-[#2a2a35] overflow-hidden">
              <Param name="agentTokenAddress" type="string" req desc="ERC-20 address of the agent token (0x…)" />
              <Param name="userAddress"       type="string" req desc="Caller's wallet address — used for token-gate check" />
              <Param name="message"           type="string" req desc="The user's message" />
              <Param name="agentName"         type="string"     desc="Agent display name (used in system prompt)" />
              <Param name="agentDescription"  type="string"     desc="Agent purpose — adds context to the AI" />
              <Param name="history"           type="array"      desc='Array of { role: "user"|"assistant", content: string } — previous turns for context (last 10 used)' />
              <Param name="selectedSkills"    type="array"      desc='Legacy: [{ name, symbol }] — prefer on-chain skill tokens instead' />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-2">Response</p>
            <div className="rounded-xl border border-[#2a2a35] overflow-hidden">
              <Param name="reply"        type="string" desc="AI-generated response text" />
              <Param name="creditCost"   type="number" desc="Credits deducted for this message (always 1)" />
              <Param name="tokensHeld"   type="string" desc="Caller's token balance in ether units" />
              <Param name="activeSkills" type="array"  desc="Skills whose prompts were injected: [{ name, symbol }]" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Examples</p>
            <CodeBlock lang="bash" code={curlChat} />
            <CodeBlock lang="javascript" code={jsChat} />
            <CodeBlock lang="python" code={pythonChat} />
          </div>
        </Section>

        {/* Conversational history */}
        <Section title="Multi-turn conversations" icon={BookOpen} defaultOpen={false}>
          <p className="text-sm text-[#9a9aaa]">
            Pass previous messages in the <code className="text-[#F3BA2F] text-xs">history</code> array
            to maintain context across turns. The server uses the last 10 messages.
          </p>
          <CodeBlock lang="javascript" code={jsStream} />
        </Section>

        {/* Skills */}
        <Section title="Skill tokens — automatic prompt injection" icon={Zap} defaultOpen={false}>
          <p className="text-sm text-[#9a9aaa]">
            Skill tokens extend agent behaviour. When a user holds a skill token linked to an agent,
            the skill's system prompt is automatically injected before every message — no extra API work needed.
          </p>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              { step: "1", title: "Launch skill token",   desc: "Deploy via /launch → Skill, attach a prompt" },
              { step: "2", title: "User buys skill",      desc: "Holds ≥ 1 wei on BSC Testnet" },
              { step: "3", title: "Prompt auto-injected", desc: "Server checks balance + injects on every /api/chat call" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-[#111118] border border-[#2a2a35] rounded-xl p-4">
                <div className="w-6 h-6 rounded-full bg-[#F3BA2F]/20 text-[#F3BA2F] text-[10px] font-bold flex items-center justify-center mb-2">{step}</div>
                <p className="font-semibold text-white mb-1">{title}</p>
                <p className="text-[#6b7280]">{desc}</p>
              </div>
            ))}
          </div>
          <CodeBlock lang="bash" code={curlTokens} />
        </Section>

        {/* Claude Code / MCP */}
        <Section title="Claude Code & MCP integration" icon={Code2} defaultOpen={false}>
          <p className="text-sm text-[#9a9aaa]">
            Connect any OpenClaw agent to <strong className="text-white">Claude Code</strong> or{" "}
            <strong className="text-white">Claude Desktop</strong> via the Model Context Protocol (MCP).
            This lets you query your on-chain AI agents directly from within your IDE.
          </p>

          <div>
            <p className="text-xs font-semibold text-white mb-1">
              Step 1 — Add to <code className="text-[#F3BA2F]">~/.claude/claude_desktop_config.json</code>
            </p>
            <CodeBlock lang="json" code={mcpConfig} />
          </div>

          <div>
            <p className="text-xs font-semibold text-white mb-1">
              Step 2 — Query your agent from Claude Code
            </p>
            <CodeBlock lang="bash" code={mcpFetch} />
          </div>

          <div className="bg-[#111118] border border-[#2a2a35] rounded-xl p-4 text-sm space-y-2">
            <p className="text-[#F3BA2F] font-semibold text-xs">Other AI tool integrations</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#9a9aaa]">
              <div>✓ <strong className="text-white">Cursor</strong> — use via HTTP request in agent mode</div>
              <div>✓ <strong className="text-white">LangChain</strong> — wrap as a Tool using requests</div>
              <div>✓ <strong className="text-white">n8n / Zapier</strong> — HTTP node → POST /api/chat</div>
              <div>✓ <strong className="text-white">OpenAI Assistants</strong> — use as a function call target</div>
            </div>
          </div>
        </Section>

        {/* Error codes */}
        <Section title="Error codes" icon={Terminal} defaultOpen={false}>
          <div className="rounded-xl border border-[#2a2a35] overflow-hidden text-xs font-mono">
            {[
              { code: "400", text: "Bad request — missing or invalid fields" },
              { code: "403", text: "Token gate failed — userAddress holds 0 tokens" },
              { code: "429", text: "Rate limited by upstream AI provider" },
              { code: "500", text: "Internal server error — check API logs" },
            ].map(({ code, text }) => (
              <div key={code} className="flex gap-4 px-4 py-3 border-b border-[#1e1e28] last:border-0">
                <span className={`w-10 font-bold flex-shrink-0 ${
                  code === "403" ? "text-red-400" :
                  code === "400" ? "text-orange-400" :
                  code === "429" ? "text-yellow-400" : "text-[#6b7280]"
                }`}>{code}</span>
                <span className="text-[#9a9aaa]">{text}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
