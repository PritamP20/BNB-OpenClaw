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
  if (!apiKey) return ""; // signal: use fallback

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

  if (!res.ok) return "";
  const data = await res.json() as any;
  return (data.choices?.[0]?.message?.content as string) ?? "";
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

  // ── Build messages for OpenAI ──────────────────────────────────────────────
  const skillContext = selectedSkills.length > 0
    ? `\nActive skill modules: ${selectedSkills.map((s) => `${s.name} ($${s.symbol})`).join(", ")}.\nUse these skills as context when answering.`
    : "";

  const systemPrompt = [
    `You are ${agentName}, an AI agent deployed on BNB Chain.`,
    agentDescription ? `Your purpose: ${agentDescription}` : "",
    skillContext,
    "Keep responses concise and helpful. Mention your on-chain nature when relevant.",
    "You are accessed via token-gating — the user holds your token and has paid AI credits.",
  ].filter(Boolean).join("\n");

  const openAiMessages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10),            // last 10 turns for context
    { role: "user", content: message.trim() },
  ];

  // ── Generate reply ─────────────────────────────────────────────────────────
  let reply: string;

  const aiReply = await callOpenAI(openAiMessages);
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
    creditCost:  CREDIT_COST,
    tokensHeld:  tokensHeldEther,
    creditsRate: CREDITS_PER_TOKEN,
  });
});
