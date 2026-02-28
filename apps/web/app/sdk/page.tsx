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
      className="flex items-center gap-1.5 text-[11px] transition-colors font-bold uppercase tracking-wider"
      style={{ color: copied ? "#4ade80" : "#555555" }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="relative overflow-hidden" style={{ border: "1px solid #333333" }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: "#222222", borderBottom: "1px solid #333333" }}>
        <span className="text-[10px] font-black font-mono uppercase tracking-widest" style={{ color: "#555555" }}>{lang}</span>
        <CopyBtn text={code} />
      </div>
      <pre className="px-4 py-4 text-sm font-mono overflow-x-auto leading-relaxed whitespace-pre" style={{ background: "#111111", color: "#e2e8f0" }}>{code}</pre>
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
    <div style={{ border: "1px solid #333333", overflow: "hidden" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors"
        style={{ background: "#1A1A1A" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#222222"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1A1A1A"; }}
      >
        <span className="flex items-center gap-2.5 text-sm font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>
          <Icon size={14} style={{ color: "#F5C220" }} />
          {title}
        </span>
        {open ? <ChevronDown size={14} style={{ color: "#555555" }} /> : <ChevronRight size={14} style={{ color: "#555555" }} />}
      </button>
      {open && <div className="px-5 py-5 space-y-5" style={{ background: "#111111" }}>{children}</div>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────

function Method({ m }: { m: "POST" | "GET" }) {
  return (
    <span
      className="text-[10px] font-black font-mono px-2 py-0.5 uppercase tracking-wider"
      style={{
        background: m === "POST" ? "#1B4EF8" : "#4ade80",
        color: m === "POST" ? "#FFFFFF" : "#0F0F0F",
      }}
    >
      {m}
    </span>
  );
}

function Param({ name, type, req, desc }: { name: string; type: string; req?: boolean; desc: string }) {
  return (
    <div className="flex gap-4 py-2.5" style={{ borderBottom: "1px solid #222222" }}>
      <div className="w-48 flex-shrink-0">
        <code className="text-xs font-mono font-bold" style={{ color: "#F5C220" }}>{name}</code>
        {req && <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider" style={{ color: "#D62828" }}>required</span>}
      </div>
      <code className="text-[10px] font-mono w-20 flex-shrink-0 pt-0.5" style={{ color: "#555555" }}>{type}</code>
      <p className="text-xs" style={{ color: "#888888" }}>{desc}</p>
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
    <div className="min-h-screen" style={{ background: "#0F0F0F", color: "#F5F5F5" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #222222", background: "#111111" }}>
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: "#F5C220" }}>
              <Code2 size={18} style={{ color: "#0F0F0F" }} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight" style={{ color: "#F5F5F5" }}>Developer SDK</h1>
              <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: "#555555" }}>Integrate AI agents into any app or tool</p>
            </div>
          </div>
          <p className="text-sm max-w-2xl mt-4" style={{ color: "#888888" }}>
            Every agent on OpenClaw exposes a simple REST endpoint. No SDK required — use{" "}
            <code className="font-mono text-xs" style={{ color: "#F5C220", background: "rgba(245,194,32,0.1)", padding: "1px 5px" }}>fetch</code>,{" "}
            <code className="font-mono text-xs" style={{ color: "#F5C220", background: "rgba(245,194,32,0.1)", padding: "1px 5px" }}>curl</code>, Python, or any HTTP client.
            Token-gating is verified on‑chain — holding the agent token is your API key.
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mt-6">
            {[
              { icon: Key,   label: "Auth",    value: "Wallet address + token balance" },
              { icon: Zap,   label: "AI",      value: "Groq Llama 3.3 70B (free tier)" },
              { icon: Globe, label: "Base URL", value: API_URL },
              { icon: Bot,   label: "Skills",  value: "Injected automatically" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
                <Icon size={13} style={{ color: "#F5C220" }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#555555" }}>{label}:</span>
                <span className="text-[11px] font-mono" style={{ color: "#F5F5F5" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-5">

        {/* Authentication */}
        <Section title="Authentication" icon={Key}>
          <p className="text-sm" style={{ color: "#888888" }}>
            There are no API keys. Access is token-gated on‑chain. Pass your wallet address
            as <code className="text-xs" style={{ color: "#F5C220" }}>userAddress</code> — the server checks
            your on‑chain balance of the agent token in real time. Hold ≥ 1 wei to get access.
          </p>
          <div className="p-4 text-sm" style={{ background: "#1A1A1A", border: "1px solid #F5C220", borderLeft: "3px solid #F5C220" }}>
            <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: "#F5C220" }}>Your wallet address (auto-filled when connected)</p>
            <code className="font-mono text-xs break-all" style={{ color: "#F5F5F5" }}>{walletAddr}</code>
          </div>
          <p className="text-xs" style={{ color: "#888888" }}>
            Each message costs <strong style={{ color: "#F5F5F5" }}>1 credit</strong>. Credits are calculated from your token
            balance: <strong style={{ color: "#F5F5F5" }}>1 whole token = 200 credits</strong>.
          </p>
        </Section>

        {/* Chat endpoint */}
        <Section title="POST /api/chat — Send a message" icon={Terminal}>
          <div className="flex items-center gap-3 mb-1">
            <Method m="POST" />
            <code className="text-sm font-mono" style={{ color: "#F5F5F5" }}>/api/chat</code>
          </div>
          <p className="text-sm" style={{ color: "#888888" }}>
            Send a message and receive an AI reply. Skills held by the user are automatically
            injected as system context.
          </p>

          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: "#555555" }}>Request body</p>
            <div style={{ border: "1px solid #333333", overflow: "hidden" }}>
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
            <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: "#555555" }}>Response</p>
            <div style={{ border: "1px solid #333333", overflow: "hidden" }}>
              <Param name="reply"        type="string" desc="AI-generated response text" />
              <Param name="creditCost"   type="number" desc="Credits deducted for this message (always 1)" />
              <Param name="tokensHeld"   type="string" desc="Caller's token balance in ether units" />
              <Param name="activeSkills" type="array"  desc="Skills whose prompts were injected: [{ name, symbol }]" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#555555" }}>Examples</p>
            <CodeBlock lang="bash" code={curlChat} />
            <CodeBlock lang="javascript" code={jsChat} />
            <CodeBlock lang="python" code={pythonChat} />
          </div>
        </Section>

        {/* Conversational history */}
        <Section title="Multi-turn conversations" icon={BookOpen} defaultOpen={false}>
          <p className="text-sm" style={{ color: "#888888" }}>
            Pass previous messages in the <code className="text-xs" style={{ color: "#F5C220" }}>history</code> array
            to maintain context across turns. The server uses the last 10 messages.
          </p>
          <CodeBlock lang="javascript" code={jsStream} />
        </Section>

        {/* Skills */}
        <Section title="Skill tokens — automatic prompt injection" icon={Zap} defaultOpen={false}>
          <p className="text-sm" style={{ color: "#888888" }}>
            Skill tokens extend agent behaviour. When a user holds a skill token linked to an agent,
            the skill's system prompt is automatically injected before every message — no extra API work needed.
          </p>
          <div className="grid grid-cols-3 gap-0 text-xs" style={{ border: "1px solid #333333" }}>
            {[
              { step: "1", title: "Launch skill token",   desc: "Deploy via /launch → Skill, attach a prompt" },
              { step: "2", title: "User buys skill",      desc: "Holds ≥ 1 wei on BSC Testnet" },
              { step: "3", title: "Prompt auto-injected", desc: "Server checks balance + injects on every /api/chat call" },
            ].map(({ step, title, desc }, i) => (
              <div key={step} className="p-4" style={{ background: "#1A1A1A", borderRight: i < 2 ? "1px solid #333333" : "none" }}>
                <div className="w-6 h-6 flex items-center justify-center mb-2 text-[10px] font-black" style={{ background: "#F5C220", color: "#0F0F0F" }}>{step}</div>
                <p className="font-black uppercase tracking-wider mb-1" style={{ color: "#F5F5F5" }}>{title}</p>
                <p style={{ color: "#888888" }}>{desc}</p>
              </div>
            ))}
          </div>
          <CodeBlock lang="bash" code={curlTokens} />
        </Section>

        {/* Claude Code / MCP */}
        <Section title="Claude Code & MCP integration" icon={Code2} defaultOpen={false}>
          <p className="text-sm" style={{ color: "#888888" }}>
            Connect any OpenClaw agent to <strong style={{ color: "#F5F5F5" }}>Claude Code</strong> or{" "}
            <strong style={{ color: "#F5F5F5" }}>Claude Desktop</strong> via the Model Context Protocol (MCP).
            This lets you query your on-chain AI agents directly from within your IDE.
          </p>

          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: "#F5F5F5" }}>
              Step 1 — Add to <code style={{ color: "#F5C220" }}>~/.claude/claude_desktop_config.json</code>
            </p>
            <CodeBlock lang="json" code={mcpConfig} />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: "#F5F5F5" }}>
              Step 2 — Query your agent from Claude Code
            </p>
            <CodeBlock lang="bash" code={mcpFetch} />
          </div>

          <div className="p-4 text-sm space-y-2" style={{ background: "#1A1A1A", border: "1px solid #333333", borderLeft: "3px solid #F5C220" }}>
            <p className="font-black uppercase tracking-wider text-xs" style={{ color: "#F5C220" }}>Other AI tool integrations</p>
            <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "#888888" }}>
              <div>✓ <strong style={{ color: "#F5F5F5" }}>Cursor</strong> — use via HTTP request in agent mode</div>
              <div>✓ <strong style={{ color: "#F5F5F5" }}>LangChain</strong> — wrap as a Tool using requests</div>
              <div>✓ <strong style={{ color: "#F5F5F5" }}>n8n / Zapier</strong> — HTTP node → POST /api/chat</div>
              <div>✓ <strong style={{ color: "#F5F5F5" }}>OpenAI Assistants</strong> — use as a function call target</div>
            </div>
          </div>
        </Section>

        {/* Error codes */}
        <Section title="Error codes" icon={Terminal} defaultOpen={false}>
          <div style={{ border: "1px solid #333333", overflow: "hidden" }} className="text-xs font-mono">
            {[
              { code: "400", text: "Bad request — missing or invalid fields" },
              { code: "403", text: "Token gate failed — userAddress holds 0 tokens" },
              { code: "429", text: "Rate limited by upstream AI provider" },
              { code: "500", text: "Internal server error — check API logs" },
            ].map(({ code, text }) => (
              <div key={code} className="flex gap-4 px-4 py-3" style={{ borderBottom: "1px solid #222222" }}>
                <span className="w-10 font-black flex-shrink-0" style={{
                  color: code === "403" ? "#D62828" :
                         code === "400" ? "#D62828" :
                         code === "429" ? "#F5C220" : "#555555"
                }}>{code}</span>
                <span style={{ color: "#888888" }}>{text}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
