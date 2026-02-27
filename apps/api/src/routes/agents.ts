/**
 * Agent management routes.
 *
 *  POST /api/agents/list          — developer lists a new agent
 *  GET  /api/agents               — list all deployed agents (public)
 *  GET  /api/agents/:id           — get one agent (public, no internal_url)
 *  GET  /api/agents/:id/status    — deployment status + build logs
 *  DELETE /api/agents/:id         — developer deletes their agent
 */

import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { deployAgent } from "../services/deployment";
import { createos } from "../services/createos";
import { logger } from "../lib/logger";

export const agentsRouter = Router();

// ── POST /api/agents/list ────────────────────────────────────────────────────

agentsRouter.post(
  "/list",
  async (req: Request, res: Response) => {

    // ── Parse inputs ────────────────────────────────────────────────────────
    const {
      name,
      description,
      token_address:    tokenAddress,
      developer_wallet: developerWallet,
      container_port:   portStr,
      run_envs:         runEnvsStr,
      docker_image:     dockerImage,
    } = req.body as Record<string, string>;

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: string[] = [];

    if (!name?.trim())            errors.push("name is required");
    if (!tokenAddress?.trim())    errors.push("token_address is required");
    if (!developerWallet?.trim()) errors.push("developer_wallet is required");
    if (!dockerImage?.trim())     errors.push("docker_image is required (e.g. username/myagent:latest)");

    // Basic address format checks
    if (tokenAddress && !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
      errors.push("token_address must be a valid 0x EVM address");
    }
    if (developerWallet && !/^0x[0-9a-fA-F]{40}$/.test(developerWallet)) {
      errors.push("developer_wallet must be a valid 0x EVM address");
    }

    // Docker image sanity check (must contain a slash — user/image[:tag])
    if (dockerImage && !dockerImage.trim().includes("/")) {
      errors.push("docker_image must be a Docker Hub reference, e.g. username/myagent:latest");
    }

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const containerPort = portStr ? parseInt(portStr, 10) : 8080;
    if (isNaN(containerPort) || containerPort < 1 || containerPort > 65535) {
      res.status(400).json({ errors: ["container_port must be 1–65535"] });
      return;
    }

    let runEnvs: Record<string, string> = {};
    if (runEnvsStr) {
      try {
        runEnvs = JSON.parse(runEnvsStr);
      } catch {
        res.status(400).json({ errors: ["run_envs must be valid JSON"] });
        return;
      }
    }

    // ── Save to DB ─────────────────────────────────────────────────────────
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO agents
         (name, description, developer_wallet, token_address, container_port,
          cpu_millis, memory_mb, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id`,
      [
        name.trim(),
        description?.trim() ?? null,
        developerWallet.toLowerCase(),
        tokenAddress.toLowerCase(),
        containerPort,
        200,   // will be overridden by config inside deployAgent
        512,
      ]
    );

    const agentId = rows[0]!.id;

    logger.info("Agent registered, starting deployment", { agentId, name });

    // ── Fire-and-forget deployment ─────────────────────────────────────────
    // We return immediately so the developer doesn't wait 5+ minutes.
    // They poll GET /api/agents/:id/status to track progress.
    deployAgent({
      agentId,
      agentName:         name.trim(),
      dockerImage:       dockerImage.trim(),
      containerPort,
      runEnvs,
    }).catch((err) =>
      logger.error("Unhandled deployment error", { agentId, err })
    );

    res.status(202).json({
      message:   "Agent accepted for deployment",
      agentId,
      statusUrl: `/api/agents/${agentId}/status`,
    });
  }
);

// ── GET /api/agents ──────────────────────────────────────────────────────────

agentsRouter.get("/", async (_req: Request, res: Response) => {
  const { rows } = await db.query(
    `SELECT id, name, description, developer_wallet, token_address,
            container_port, cpu_millis, memory_mb, status, created_at
     FROM agents
     WHERE status != 'failed'
     ORDER BY created_at DESC
     LIMIT 100`
  );
  res.json({ agents: rows });
});

// ── GET /api/agents/:id ──────────────────────────────────────────────────────

agentsRouter.get("/:id", async (req: Request, res: Response) => {
  const { rows } = await db.query(
    `SELECT id, name, description, developer_wallet, token_address,
            container_port, cpu_millis, memory_mb, status,
            error_message, created_at, updated_at
     FROM agents WHERE id = $1`,
    [req.params.id]
  );

  if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  // Public endpoint — internal_url is intentionally excluded
  res.json({ agent: rows[0] });
});

// ── GET /api/agents/:id/status ───────────────────────────────────────────────

agentsRouter.get("/:id/status", async (req: Request, res: Response) => {
  const { rows } = await db.query(
    `SELECT id, name, status, error_message,
            createos_project_id, createos_deployment_id,
            created_at, updated_at
     FROM agents WHERE id = $1`,
    [req.params.id]
  );

  if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  const agent = rows[0];
  let buildLogs: string[] = [];

  // Attach recent build logs when the project exists
  if (agent.createos_project_id && agent.createos_deployment_id) {
    buildLogs = await createos
      .getBuildLogs(agent.createos_project_id, agent.createos_deployment_id)
      .catch(() => []);
  }

  res.json({
    id:          agent.id,
    name:        agent.name,
    status:      agent.status,
    error:       agent.error_message ?? null,
    // Only give the agent endpoint URL once deployed
    agentUrl:    agent.status === "deployed"
                   ? `/agent/${agent.id}`
                   : null,
    buildLogs,
    createdAt:   agent.created_at,
    updatedAt:   agent.updated_at,
  });
});

// ── DELETE /api/agents/:id ───────────────────────────────────────────────────

agentsRouter.delete("/:id", async (req: Request, res: Response) => {
  const developerWallet = (
    req.headers["x-developer-wallet"] as string | undefined
  )?.toLowerCase();

  if (!developerWallet) {
    res.status(401).json({ error: "x-developer-wallet header required" });
    return;
  }

  const { rows } = await db.query(
    "SELECT * FROM agents WHERE id = $1",
    [req.params.id]
  );

  if (rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  const agent = rows[0];

  if (agent.developer_wallet !== developerWallet) {
    res.status(403).json({ error: "Not your agent" });
    return;
  }

  // Delete from CreateOS if project was created
  if (agent.createos_project_id) {
    await createos.deleteProject(agent.createos_project_id).catch(() => {});
  }

  await db.query("UPDATE agents SET status = 'stopped' WHERE id = $1", [agent.id]);

  res.json({ message: "Agent stopped and removed" });
});
