/**
 * Deployment orchestrator.
 *
 * Called after an agent is saved to DB with status="pending".
 * Runs the full CreateOS flow and updates the DB row on success/failure.
 *
 * Intentionally fire-and-forget from the route handler so the HTTP response
 * returns immediately with the agent ID and "deploying" status.
 */

import { v4 as uuidv4 } from "uuid";
import { db } from "../db/client";
import { createos } from "./createos";
import { config } from "../config";
import { logger } from "../lib/logger";

export interface DeployAgentInput {
  agentId:       string;   // DB row id (UUID)
  agentName:     string;
  dockerImage:   string;   // pre-built Docker Hub image, e.g. "username/myagent:latest"
  containerPort: number;
  runEnvs?:      Record<string, string>;
}

export async function deployAgent(input: DeployAgentInput): Promise<void> {
  const { agentId, agentName, dockerImage, containerPort, runEnvs } = input;

  logger.info("Starting deployment", { agentId, agentName });

  // Sanitise project unique name (3-32 chars, alphanumeric + hyphens)
  const slug = agentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const uniqueName = `agent-${slug}-${uuidv4().slice(0, 6)}`;

  let projectId:    string | null = null;
  let envId:        string | null = null;
  let deploymentId: string | null = null;

  try {
    // ── 1. Mark deploying ─────────────────────────────────────────────────
    await db.query(
      "UPDATE agents SET status = 'deploying' WHERE id = $1",
      [agentId]
    );

    // ── 2. Create project ──────────────────────────────────────────────────
    logger.info("Creating CreateOS project", { uniqueName });
    const project = await createos.createProject({
      uniqueName,
      displayName: agentName,
      port:        containerPort,
      runEnvs,
    });
    projectId = project.id;

    await db.query(
      "UPDATE agents SET createos_project_id = $1 WHERE id = $2",
      [projectId, agentId]
    );

    // ── 3. Create environment with resource limits ─────────────────────────
    logger.info("Creating environment", { projectId });
    const env = await createos.createEnvironment(projectId, {
      displayName: "Production",
      uniqueName:  "production",
      cpu:         config.createos.cpu,
      memory:      config.createos.memory,
      replicas:    config.createos.replicas,
      runEnvs,
    });
    envId = env.id;

    await db.query(
      "UPDATE agents SET createos_env_id = $1 WHERE id = $2",
      [envId, agentId]
    );

    // ── 4. Deploy pre-built Docker Hub image ──────────────────────────────
    logger.info("Creating image deployment", { projectId, dockerImage });
    const deployment = await createos.createImageDeployment(projectId, dockerImage);
    deploymentId = deployment.id;

    await db.query(
      "UPDATE agents SET createos_deployment_id = $1 WHERE id = $2",
      [deploymentId, agentId]
    );

    // ── 5. Assign deployment to environment ────────────────────────────────
    logger.info("Assigning deployment to environment", { deploymentId, envId });
    await createos.assignDeployment(projectId, envId, deploymentId);

    // ── 6. Wait for container to be live ──────────────────────────────────
    logger.info("Waiting for deployment to go live…", { deploymentId });
    const live = await createos.waitForDeployment(projectId, deploymentId);

    // The public URL may be on the deployment object, on the environment,
    // or follow the standard CreateOS subdomain convention.
    const internalUrl =
      live.url ??
      `https://${uniqueName}.createos.app`;

    // ── 7. Save URL and mark deployed ──────────────────────────────────────
    await db.query(
      `UPDATE agents
       SET status       = 'deployed',
           internal_url = $1,
           error_message = NULL
       WHERE id = $2`,
      [internalUrl, agentId]
    );

    logger.info("Agent deployed successfully", { agentId, internalUrl });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Deployment failed", { agentId, error: message });

    // Mark failed + store reason
    await db.query(
      `UPDATE agents SET status = 'failed', error_message = $1 WHERE id = $2`,
      [message, agentId]
    ).catch(() => {}); // best-effort

    // Rollback: clean up the CreateOS project if it was created
    if (projectId) {
      try {
        await createos.deleteProject(projectId);
        logger.info("Rolled back CreateOS project", { projectId });
      } catch (rollbackErr) {
        logger.warn("Rollback failed", { projectId, err: rollbackErr });
      }
    }
  }
}
