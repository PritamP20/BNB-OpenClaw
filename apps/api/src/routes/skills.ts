/**
 * Skill module routes.
 *
 *  POST /api/skills               — register a skill after on-chain deployment
 *  GET  /api/skills/by-agent/:agentTokenAddress — list skills for an agent
 *  GET  /api/skills/:skillTokenAddress          — get one skill record
 */

import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { logger } from "../lib/logger";

export const skillsRouter = Router();

// ── POST /api/skills ─────────────────────────────────────────────────────────
// Called from the frontend immediately after a skill token is deployed on-chain.
// Body fields (application/x-www-form-urlencoded or JSON):
//   skill_token_address  — deployed skill ERC-20 address
//   agent_token_address  — the agent token this skill augments
//   name                 — token name
//   symbol               — token symbol
//   prompt               — system-prompt text injected when the wallet holds this skill
//   developer_wallet     — wallet that deployed the skill

skillsRouter.post("/", async (req: Request, res: Response) => {
  const {
    skill_token_address: skillTokenAddress,
    agent_token_address: agentTokenAddress,
    name,
    symbol,
    prompt    = "",
    developer_wallet: developerWallet,
  } = req.body as Record<string, string>;

  const errors: string[] = [];
  if (!skillTokenAddress?.trim())  errors.push("skill_token_address is required");
  if (!agentTokenAddress?.trim())  errors.push("agent_token_address is required");
  if (!name?.trim())               errors.push("name is required");
  if (!symbol?.trim())             errors.push("symbol is required");
  if (!developerWallet?.trim())    errors.push("developer_wallet is required");

  if (skillTokenAddress && !/^0x[0-9a-fA-F]{40}$/.test(skillTokenAddress)) {
    errors.push("skill_token_address must be a valid 0x EVM address");
  }
  if (agentTokenAddress && !/^0x[0-9a-fA-F]{40}$/.test(agentTokenAddress)) {
    errors.push("agent_token_address must be a valid 0x EVM address");
  }
  if (developerWallet && !/^0x[0-9a-fA-F]{40}$/.test(developerWallet)) {
    errors.push("developer_wallet must be a valid 0x EVM address");
  }

  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }

  // Upsert — allow re-registration to update the prompt
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO skills
       (skill_token_address, agent_token_address, name, symbol, prompt, developer_wallet)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (skill_token_address)
       DO UPDATE SET
         agent_token_address = EXCLUDED.agent_token_address,
         name                = EXCLUDED.name,
         symbol              = EXCLUDED.symbol,
         prompt              = EXCLUDED.prompt,
         developer_wallet    = EXCLUDED.developer_wallet
     RETURNING id`,
    [
      skillTokenAddress.toLowerCase(),
      agentTokenAddress.toLowerCase(),
      name.trim(),
      symbol.trim().toUpperCase(),
      prompt.trim(),
      developerWallet.toLowerCase(),
    ]
  );

  logger.info("Skill registered", { id: rows[0]!.id, name });

  res.status(201).json({
    message: "Skill registered successfully",
    skillId: rows[0]!.id,
  });
});

// ── GET /api/skills/by-agent/:agentTokenAddress ───────────────────────────────

skillsRouter.get("/by-agent/:agentTokenAddress", async (req: Request, res: Response) => {
  const agentTokenAddress = String(req.params.agentTokenAddress).toLowerCase();

  const { rows } = await db.query(
    `SELECT id, skill_token_address, agent_token_address, name, symbol, prompt, created_at
     FROM skills
     WHERE agent_token_address = $1
     ORDER BY created_at ASC`,
    [agentTokenAddress]
  );

  res.json({ skills: rows });
});

// ── GET /api/skills/:skillTokenAddress ───────────────────────────────────────

skillsRouter.get("/:skillTokenAddress", async (req: Request, res: Response) => {
  const skillTokenAddress = String(req.params.skillTokenAddress).toLowerCase();

  const { rows } = await db.query(
    `SELECT id, skill_token_address, agent_token_address, name, symbol, prompt, created_at
     FROM skills
     WHERE skill_token_address = $1`,
    [skillTokenAddress]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }

  res.json({ skill: rows[0] });
});
