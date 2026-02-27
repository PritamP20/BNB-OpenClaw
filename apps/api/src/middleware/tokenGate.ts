/**
 * Token-gate middleware.
 *
 * Every request to /agent/:agentId/* must include:
 *
 *   x-wallet-address  : the caller's BNB wallet address (0x...)
 *   x-signature       : EIP-191 personal_sign of the canonical access message
 *   x-timestamp       : the unix timestamp (seconds) embedded in the message
 *
 * The canonical message the user must sign is:
 *   "AgentLaunch access\nagentId: <id>\ntimestamp: <ts>"
 *
 * The middleware:
 *   1. Checks the timestamp is within the TTL window (prevents replay)
 *   2. Verifies the signature proves ownership of x-wallet-address
 *   3. Fetches ERC-20 balance of the agent's token for that wallet
 *   4. Rejects if balance < threshold
 *   5. Attaches agent row to res.locals for the proxy to use
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db/client";
import { verifySignature, buildAccessMessage, hasEnoughTokens } from "../lib/web3";
import { config } from "../config";
import { logger } from "../lib/logger";

export async function tokenGate(
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> {
  const agentId       = String(req.params.agentId);
  const walletAddress = (req.headers["x-wallet-address"] as string | undefined)?.toLowerCase();
  const signature     = req.headers["x-signature"]       as string | undefined;
  const tsHeader      = req.headers["x-timestamp"]       as string | undefined;

  // ── 1. Presence check ───────────────────────────────────────────────────
  if (!walletAddress || !signature || !tsHeader) {
    res.status(401).json({
      error: "Missing auth headers: x-wallet-address, x-signature, x-timestamp",
    });
    return;
  }

  const timestampSeconds = parseInt(tsHeader, 10);
  if (isNaN(timestampSeconds)) {
    res.status(401).json({ error: "Invalid x-timestamp" });
    return;
  }

  // ── 2. Timestamp freshness (anti-replay) ───────────────────────────────
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSecs    = nowSeconds - timestampSeconds;

  if (ageSecs < 0 || ageSecs > config.signatureTtlSeconds) {
    res.status(401).json({
      error: `Signature expired. Timestamp must be within ${config.signatureTtlSeconds}s of now.`,
    });
    return;
  }

  // ── 3. Signature verification ──────────────────────────────────────────
  const message = buildAccessMessage(agentId, timestampSeconds);
  const sigValid = verifySignature(message, signature, walletAddress);

  if (!sigValid) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // ── 4. Load agent from DB ──────────────────────────────────────────────
  const { rows } = await db.query(
    "SELECT * FROM agents WHERE id = $1",
    [agentId]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const agent = rows[0];

  if (agent.status !== "deployed") {
    res.status(503).json({
      error: `Agent is not ready (status: ${agent.status})`,
    });
    return;
  }

  // ── 5. ERC-20 balance check ────────────────────────────────────────────
  let balanceCheck: { ok: boolean; balance: bigint };
  try {
    balanceCheck = await hasEnoughTokens(agent.token_address, walletAddress);
  } catch (err) {
    logger.error("Balance check failed", { agentId, walletAddress, err });
    res.status(503).json({ error: "Could not verify token balance. Try again." });
    return;
  }

  if (!balanceCheck.ok) {
    res.status(403).json({
      error:    "Insufficient token balance",
      required: config.tokenGateThreshold.toString(),
      held:     balanceCheck.balance.toString(),
      token:    agent.token_address,
    });
    return;
  }

  // ── 6. Attach to res.locals and proceed ───────────────────────────────
  res.locals.agent         = agent;
  res.locals.walletAddress = walletAddress;
  res.locals.tokenBalance  = balanceCheck.balance.toString();

  logger.debug("Token gate passed", {
    agentId,
    wallet:  walletAddress,
    balance: balanceCheck.balance.toString(),
  });

  next();
}
