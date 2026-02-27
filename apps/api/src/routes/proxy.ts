/**
 * Agent proxy router.
 *
 * Route: ALL /agent/:agentId/*
 *
 * After the token-gate middleware passes, this handler:
 *   1. Reads the hidden internal_url from res.locals.agent
 *   2. Forwards the request (method, headers, body) to the container
 *   3. Streams the response back to the caller
 *   4. Logs the access event to the audit table
 *
 * The CreateOS URL is NEVER sent to the caller — it stays server-side.
 */

import { Router, Request, Response } from "express";
import axios from "axios";
import { tokenGate } from "../middleware/tokenGate";
import { db } from "../db/client";
import { logger } from "../lib/logger";

export const proxyRouter = Router({ mergeParams: true });

// Apply token gate to ALL methods under /agent/:agentId/*
proxyRouter.use("/:agentId/*", tokenGate);

proxyRouter.all("/:agentId/*", async (req: Request, res: Response) => {
  const agent         = res.locals.agent;
  const walletAddress = res.locals.walletAddress as string;
  const tokenBalance  = res.locals.tokenBalance  as string;

  // The sub-path after /agent/:agentId — forwarded as-is to the container
  // e.g. /agent/abc123/chat  →  /chat on the container
  const subPath = "/" + (req.params[0] ?? "");

  const targetUrl = `${agent.internal_url}${subPath}`;
  const startMs   = Date.now();

  // Strip platform auth headers — don't leak them to the agent container
  const forwardHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (
      k === "x-wallet-address" ||
      k === "x-signature"      ||
      k === "x-timestamp"      ||
      k === "host"
    ) continue;
    if (typeof v === "string") forwardHeaders[k] = v;
  }

  // Optionally tell the agent container who the caller is (opt-in)
  forwardHeaders["x-agent-caller-wallet"] = walletAddress;

  try {
    const upstream = await axios({
      method:  req.method as "get" | "post" | "put" | "delete" | "patch",
      url:     targetUrl,
      headers: forwardHeaders,
      data:    req.body,
      params:  req.query,
      // Stream response so large payloads (audio, images) work correctly
      responseType: "stream",
      // Don't let axios throw on non-2xx — we forward the status as-is
      validateStatus: () => true,
      timeout: 60_000,
    });

    // Forward status + headers
    res.status(upstream.status);
    for (const [k, v] of Object.entries(upstream.headers)) {
      if (k === "transfer-encoding") continue; // avoid chunked encoding issues
      if (typeof v === "string") res.setHeader(k, v);
    }

    // Pipe body
    upstream.data.pipe(res);

    upstream.data.on("end", () => {
      logAccess({
        agentId:       agent.id,
        walletAddress,
        tokenBalance,
        path:          req.path,
        method:        req.method,
        statusCode:    upstream.status,
        durationMs:    Date.now() - startMs,
      });
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Proxy error", { agentId: agent.id, targetUrl, error: message });

    logAccess({
      agentId:    agent.id,
      walletAddress,
      tokenBalance,
      path:       req.path,
      method:     req.method,
      statusCode: 502,
      durationMs: Date.now() - startMs,
    });

    if (!res.headersSent) {
      res.status(502).json({ error: "Agent upstream unavailable" });
    }
  }
});

// ── Audit log helper ─────────────────────────────────────────────────────────

function logAccess(entry: {
  agentId:       string;
  walletAddress: string;
  tokenBalance:  string;
  path:          string;
  method:        string;
  statusCode:    number;
  durationMs:    number;
}): void {
  db.query(
    `INSERT INTO access_log
       (agent_id, wallet_address, token_balance, path, method, status_code, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.agentId, entry.walletAddress, entry.tokenBalance,
      entry.path, entry.method, entry.statusCode, entry.durationMs,
    ]
  ).catch((err) => logger.warn("Failed to write access log", { err }));
}
