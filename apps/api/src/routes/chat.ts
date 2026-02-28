/**
 * Built-in chat endpoint.
 *
 *  POST /api/chat
 *
 * Body:
 *   agentTokenAddress  — ERC-20 token address of the agent
 *   userAddress        — wallet address of the caller
 *   agentName          — human-readable agent name (from chain)
 *   agentDescription   — description / system context
 *   message            — user's current message
 *   selectedSkills     — array of { name, symbol, description } skill modules
 *   history            — array of { role: "user"|"assistant", content: string }
 *
 * Response:
 *   { reply: string; creditCost: number; tokensHeld: string }
 *
 * Token-gating:
 *   The caller must hold ≥ 1 wei of the agent token.
 *   AI credits are calculated client-side (1 token = 200 credits).
 *   This route just verifies the caller actually owns tokens.
 */

import { Router, Request, Response } from "express";
import { getTokenBalance } from "../lib/web3";
import { db } from "../db/client";
import { logger } from "../lib/logger";

export const chatRouter = Router();

// ── Rate conversion (informational — enforced client-side) ───────────────────
const CREDITS_PER_TOKEN = 200;   // 1 whole token = 200 AI credits
const CREDIT_COST       = 1;     // cost per message

// ── OpenAI (optional) ────────────────────────────────────────────────────────
// If OPENAI_API_KEY is set in env, use GPT-4o-mini; otherwise fall back to
// template responses that demonstrate the concept without an API key.

async function callOpenAI(
  messages: { role: string; content: string }[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       "gpt-4o-mini",
      messages,
      max_tokens:  512,
      temperature: 0.75,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text().catch(() => "unknown error")}`);
  const data = await res.json() as any;
  const reply = (data.choices?.[0]?.message?.content as string) ?? "";
  if (!reply) throw new Error("OpenAI returned an empty reply");
  return reply;
}

// ── Groq fallback (OpenAI-compatible) ───────────────────────────────────────
// Used when OpenAI fails or its key is absent. Groq uses the same request
// format as OpenAI — only the base URL and model name differ.
// Set GROQ_API_KEY in the API environment to enable.

async function callGroq(
  messages: { role: string; content: string }[]
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "";

  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens:  512,
      temperature: 0.75,
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text().catch(() => "unknown error")}`);
  const data = await res.json() as any;
  const reply = (data.choices?.[0]?.message?.content as string) ?? "";
  if (!reply) throw new Error("Groq returned an empty reply");
  return reply;
}

// ── Gemini fallback ───────────────────────────────────────────────────────────
// Used automatically when OpenAI and Groq both fail.
// Set GEMINI_API_KEY in the API environment to enable.

async function callGemini(
  messages: { role: string; content: string }[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  // Gemini separates system instructions from the conversation turns
  const systemMsg    = messages.find((m) => m.role === "system");
  const conversation = messages.filter((m) => m.role !== "system");

  // Gemini requires strictly alternating user/model turns; collapse consecutive
  // same-role messages and map "assistant" → "model"
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const m of conversation) {
    const role = m.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0]!.text += "\n" + m.content;
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }
  // Gemini requires the last turn to be from user
  if (!contents.length || contents[contents.length - 1]!.role !== "user") {
    contents.push({ role: "user", parts: [{ text: "Continue." }] });
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 512, temperature: 0.75 },
  };
  if (systemMsg) {
    body.system_instruction = { parts: [{ text: systemMsg.content }] };
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => "unknown error")}`);
  const data = await res.json() as any;
  const reply = (data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? "";
  if (!reply) throw new Error("Gemini returned an empty reply");
  return reply;
}

// ── Template fallback ────────────────────────────────────────────────────────

const AGENT_PERSONALITIES = [
  "I'm an on-chain AI agent running on BNB Chain. My capabilities are defined by my skill modules.",
  "As a decentralised AI, I operate transparently on BSC Testnet. Each interaction is token-gated.",
  "I'm a Web3-native AI agent — my outputs are governed by smart contracts, not a single company.",
];

function templateResponse(
  agentName: string,
  agentDescription: string,
  selectedSkills: { name: string; symbol: string }[],
  message: string,
  history: { role: string; content: string }[]
): string {
  const lcMsg        = message.toLowerCase();
  const skillsActive = selectedSkills.length > 0;
  const personality  = AGENT_PERSONALITIES[agentName.length % AGENT_PERSONALITIES.length]!;
  const skillList    = selectedSkills.map((s) => `${s.name} ($${s.symbol})`).join(", ");
  const turnCount    = history.filter((h) => h.role === "user").length;

  // Greeting
  if (lcMsg.match(/^(hi|hello|hey|yo|sup|gm)/)) {
    return `Hello! I'm **${agentName}**. ${personality}${
      skillsActive
        ? `\n\nYou've activated ${selectedSkills.length} skill module${selectedSkills.length !== 1 ? "s" : ""}: **${skillList}**. I can use these as context in our conversation.`
        : "\n\nNo skill modules are currently active. You can select them from the skill tree on the left."
    }`;
  }

  // Who are you
  if (lcMsg.match(/who are you|what are you|tell me about yourself/)) {
    return `I'm **${agentName}** — ${agentDescription || "an AI agent deployed on BNB Chain"}.\n\n${personality}${
      skillsActive
        ? `\n\nMy active skills: **${skillList}**.`
        : ""
    }`;
  }

  // What can you do / skills
  if (lcMsg.match(/skill|what can you do|capabilities|help/)) {
    if (!skillsActive) {
      return `I don't have any skill modules active right now. Select skills from the skill tree on the left to expand my capabilities. Each skill is an on-chain module with a cost-per-use paid in skill tokens.`;
    }
    return `With your selected skills (**${skillList}**), I can assist with:\n\n${selectedSkills
      .map((s, i) => `${i + 1}. **${s.name}** — ${s.symbol} token skill module`)
      .join("\n")}\n\nHow would you like to proceed?`;
  }

  // Token / price questions
  if (lcMsg.match(/token|price|buy|sell|market|credit/)) {
    return `As an on-chain agent, my capabilities are token-gated. Holding my token ($${agentName.slice(0, 6).toUpperCase()}) grants you AI credit allocations — **${CREDITS_PER_TOKEN} credits per token**. Each message costs ${CREDIT_COST} credit.\n\nYou can buy tokens on my bonding curve to earn more credits.`;
  }

  // Generic context-aware response
  const contextHint = skillsActive
    ? ` Using active skills: **${skillList}**.`
    : "";

  const turnHint = turnCount > 3 ? " (We've been chatting for a while — feel free to ask more complex questions!)" : "";

  return `Understood. You said: _"${message}"_\n\n${
    agentDescription
      ? `Based on my purpose — ${agentDescription.slice(0, 80)}… — `
      : "As an AI agent, "
  }here's my response:${contextHint}\n\nThis is a template response (no OpenAI key configured). Set \`OPENAI_API_KEY\` in the API's environment to enable full AI reasoning.${turnHint}`;
}

// ── Route handler ────────────────────────────────────────────────────────────

chatRouter.post("/", async (req: Request, res: Response) => {
  const {
    agentTokenAddress,
    userAddress,
    agentName        = "Agent",
    agentDescription = "",
    message,
    selectedSkills   = [],
    history          = [],
  } = req.body as {
    agentTokenAddress: string;
    userAddress:       string;
    agentName?:        string;
    agentDescription?: string;
    message:           string;
    selectedSkills?:   { name: string; symbol: string; description?: string }[];
    history?:          { role: string; content: string }[];
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!agentTokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(agentTokenAddress)) {
    res.status(400).json({ error: "agentTokenAddress must be a valid 0x address" });
    return;
  }
  if (!userAddress || !/^0x[0-9a-fA-F]{40}$/.test(userAddress)) {
    res.status(400).json({ error: "userAddress must be a valid 0x address" });
    return;
  }
  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  // ── Token gate ─────────────────────────────────────────────────────────────
  let tokensHeld: bigint;
  try {
    tokensHeld = await getTokenBalance(agentTokenAddress, userAddress);
  } catch (e) {
    logger.warn("Failed to check token balance for chat", { agentTokenAddress, userAddress, error: e });
    // On RPC error, allow through (testnet instability)
    tokensHeld = 1n;
  }

  if (tokensHeld === 0n) {
    res.status(403).json({
      error: "Insufficient tokens. You must hold at least 1 token of this agent to chat.",
      tokensHeld: "0",
    });
    return;
  }

  // ── Resolve on-chain skill prompts ─────────────────────────────────────────
  // Look up all registered skills for this agent, then check which ones the
  // caller actually holds. Only held skills have their prompts injected.
  let heldSkillPrompts: { name: string; symbol: string; prompt: string }[] = [];
  try {
    const { rows: skillRows } = await db.query<{
      skill_token_address: string;
      name:                string;
      symbol:              string;
      prompt:              string;
    }>(
      `SELECT skill_token_address, name, symbol, prompt
       FROM skills
       WHERE agent_token_address = $1 AND prompt != ''`,
      [agentTokenAddress.toLowerCase()]
    );

    if (skillRows.length > 0) {
      const balances = await Promise.all(
        skillRows.map(async (skill) => {
          try {
            const bal = await getTokenBalance(skill.skill_token_address, userAddress);
            return bal > 0n ? skill : null;
          } catch {
            return null;
          }
        })
      );
      heldSkillPrompts = balances.filter(
        (s): s is { skill_token_address: string; name: string; symbol: string; prompt: string } => s !== null
      );
    }
  } catch (e) {
    // Non-fatal: skill injection is best-effort
    logger.warn("Skill prompt resolution failed", { agentTokenAddress, error: e });
  }

  // ── Build messages for OpenAI ──────────────────────────────────────────────
  // Held skill prompts are injected as first-class system instructions so the
  // AI applies them before processing the user message.
  const skillSystemBlocks = heldSkillPrompts.map(
    (s) => `## Skill: ${s.name} ($${s.symbol})\n${s.prompt}`
  );

  const legacySkillContext = selectedSkills.length > 0
    ? `\nActive skill modules: ${selectedSkills.map((s) => `${s.name} ($${s.symbol})`).join(", ")}.\nUse these skills as context when answering.`
    : "";

  const systemPrompt = [
    `You are ${agentName}, an AI agent deployed on BNB Chain.`,
    agentDescription ? `Your purpose: ${agentDescription}` : "",
    ...(skillSystemBlocks.length > 0
      ? [
          "The user holds the following skill modules. Apply their instructions when formulating your response:",
          skillSystemBlocks.join("\n\n"),
        ]
      : [legacySkillContext]),
    "Keep responses concise and helpful. Mention your on-chain nature when relevant.",
    "You are accessed via token-gating — the user holds your token and has paid AI credits.",
  ].filter(Boolean).join("\n");

  const openAiMessages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10),            // last 10 turns for context
    { role: "user", content: message.trim() },
  ];

  // ── Generate reply ─────────────────────────────────────────────────────────
  // Cascade: OpenAI → Groq → Gemini → template fallback.
  // The same messages array (with skill prompts injected) is passed to
  // whichever provider responds, so skills behave identically across all.
  // Each provider returns "" if its key is missing; throws on API errors.
  // We iterate until one returns a non-empty reply.
  let reply: string;

  let aiReply = "";
  const providers: { name: string; fn: () => Promise<string> }[] = [
    { name: "OpenAI", fn: () => callOpenAI(openAiMessages) },
    { name: "Groq",   fn: () => callGroq(openAiMessages)   },
    { name: "Gemini", fn: () => callGemini(openAiMessages)  },
  ];

  for (const provider of providers) {
    try {
      aiReply = await provider.fn();
      if (aiReply) break; // got a reply — stop trying
    } catch (err) {
      logger.warn(`${provider.name} failed, trying next provider`, { error: (err as Error).message });
    }
  }

  if (aiReply) {
    reply = aiReply;
  } else {
    reply = templateResponse(
      agentName,
      agentDescription,
      selectedSkills,
      message.trim(),
      history,
    );
  }

  // Convert bigint to string for JSON serialisation
  const tokensHeldEther = (Number(tokensHeld) / 1e18).toFixed(4);

  logger.info("Chat response generated", { agentName, userAddress: userAddress.slice(0, 10) + "…" });

  res.json({
    reply,
    creditCost:   CREDIT_COST,
    tokensHeld:   tokensHeldEther,
    creditsRate:  CREDITS_PER_TOKEN,
    activeSkills: heldSkillPrompts.map((s) => ({ name: s.name, symbol: s.symbol })),
  });
});
