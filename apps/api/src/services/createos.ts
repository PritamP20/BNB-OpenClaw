/**
 * CreateOS HTTP API client.
 *
 * Endpoint paths and request/response shapes are derived from the CreateOS
 * MCP tool definitions (mcp__createos-mcp__*) so they match the real REST API.
 *
 * Base URL: config.createos.apiUrl  (https://api.createos.xyz)
 * Auth:     Bearer <config.createos.apiKey>
 */

import axios, { AxiosInstance } from "axios";
import { config } from "../config";
import { logger } from "../lib/logger";

// ── Response types ────────────────────────────────────────────────────────────

export interface COProject {
  id:          string;
  uniqueName:  string;
  displayName: string;
  type:        "vcs" | "image" | "upload";
  status:      string;
}

export interface COEnvironment {
  id:          string;
  uniqueName:  string;
  displayName: string;
}

export interface CODeployment {
  id:     string;
  status: "pending" | "queue" | "queued" | "building" | "deployed" | "failed" | "sleeping" | "error";
  /** Public URL of the running container */
  url?:   string;
  extra?: { endpoint?: string };
}

// ── Client ────────────────────────────────────────────────────────────────────

class CreateOSClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.createos.apiUrl,
      headers: {
        "X-API-Key":    config.createos.apiKey,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });

    this.http.interceptors.request.use((req) => {
      logger.debug("CreateOS →", { method: req.method?.toUpperCase(), url: req.url });
      return req;
    });

    this.http.interceptors.response.use(
      (r) => r,
      (err) => {
        const status  = err.response?.status;
        const message = err.response?.data?.message ?? err.message;
        logger.error("CreateOS API error", { status, message });
        return Promise.reject(new Error(`CreateOS ${status ?? "network"}: ${message}`));
      }
    );
  }

  // ── Projects ─────────────────────────────────────────────────────────────

  /**
   * POST /projects
   * Create an image-type project (pre-built Docker Hub image — no build step).
   */
  async createProject(params: {
    uniqueName:  string;
    displayName: string;
    port:        number;
    runEnvs?:    Record<string, string>;
  }): Promise<COProject> {
    const { data } = await this.http.post("/projects", {
      uniqueName:  params.uniqueName,
      displayName: params.displayName,
      type:        "image",    // pull pre-built image → no build → no timeout
      source:      {},
      settings: {
        port:    params.port,
        runEnvs: params.runEnvs ?? {},
      },
    });
    return data.data ?? data;
  }

  /**
   * POST /projects/:projectId/deployments
   * Create a deployment for an image-type project using a pre-built registry image.
   * image must be a valid Docker reference e.g. "username/myagent:latest".
   */
  async createImageDeployment(
    projectId: string,
    image:     string
  ): Promise<CODeployment> {
    const { data } = await this.http.post(
      `/projects/${projectId}/deployments`,
      { image }
    );
    return data.data ?? data;
  }

  /** DELETE /projects/:id */
  async deleteProject(projectId: string): Promise<void> {
    await this.http.delete(`/projects/${projectId}`);
  }

  // ── Environments ──────────────────────────────────────────────────────────

  /**
   * POST /projects/:projectId/environments
   * Create a production environment with resource limits.
   *
   * NOTE: description is required by the API (min 4 chars).
   */
  async createEnvironment(
    projectId: string,
    params: {
      displayName: string;
      uniqueName:  string;
      cpu:         number;
      memory:      number;
      replicas:    number;
      runEnvs?:    Record<string, string>;
    }
  ): Promise<COEnvironment> {
    const { data } = await this.http.post(
      `/projects/${projectId}/environments`,
      {
        displayName:          params.displayName,
        uniqueName:           params.uniqueName,
        description:          "Production environment",   // required field
        isAutoPromoteEnabled: false,
        settings: { runEnvs: params.runEnvs ?? {} },
        resources: {
          cpu:      params.cpu,
          memory:   params.memory,
          replicas: params.replicas,
        },
      }
    );
    return data.data ?? data;
  }

  /** DELETE /projects/:projectId/environments/:envId */
  async deleteEnvironment(projectId: string, envId: string): Promise<void> {
    await this.http.delete(`/projects/${projectId}/environments/${envId}`);
  }

  // ── Deployments ───────────────────────────────────────────────────────────

  /**
   * POST /projects/:projectId/deployments/files
   * Upload plain-text files (Dockerfile etc.) → triggers a new build.
   * Returns the created deployment.
   */
  async uploadFiles(
    projectId: string,
    files: Array<{ path: string; content: string }>
  ): Promise<CODeployment> {
    const { data } = await this.http.put(
      `/projects/${projectId}/deployments/files`,
      { files }
    );
    return data.data ?? data;
  }

  /**
   * PUT /projects/:projectId/environments/:envId
   * Assign a deployment to an environment so the container actually starts.
   * The update endpoint requires displayName + description alongside deploymentId.
   */
  async assignDeployment(
    projectId:    string,
    envId:        string,
    deploymentId: string
  ): Promise<void> {
    await this.http.put(
      `/projects/${projectId}/environments/${envId}`,
      {
        displayName:          "Production",
        description:          "Production environment",
        isAutoPromoteEnabled: false,
        deploymentId,
      }
    );
  }

  /**
   * GET /projects/:projectId/deployments/:deploymentId
   * Poll until terminal state (deployed | failed) or timeout.
   */
  async waitForDeployment(
    projectId:    string,
    deploymentId: string,
    timeoutMs  = 10 * 60 * 1000   // 10 minutes
  ): Promise<CODeployment> {
    const deadline = Date.now() + timeoutMs;
    let delay = 5_000;

    while (Date.now() < deadline) {
      const { data } = await this.http.get(
        `/projects/${projectId}/deployments/${deploymentId}`
      );
      const dep: CODeployment = data.data ?? data;

      logger.debug("Deployment poll", { deploymentId, status: dep.status });

      if (dep.status === "deployed") {
        // URL lives in extra.endpoint (e.g. "https://d-xxx.createos.app")
        if (!dep.url && dep.extra?.endpoint) dep.url = dep.extra.endpoint;
        return dep;
      }
      if (dep.status === "failed" || dep.status === "error")
        throw new Error(`Deployment ${deploymentId} failed (status: ${dep.status})`);

      await sleep(delay);
      delay = Math.min(delay * 1.5, 30_000);
    }

    throw new Error(`Deployment timed out after ${timeoutMs / 1000}s`);
  }

  /**
   * GET /projects/:projectId/deployments/:deploymentId/build-logs?skip=0
   * Returns an array of log line strings.
   */
  async getBuildLogs(
    projectId:    string,
    deploymentId: string,
    skip        = 0
  ): Promise<string[]> {
    const { data } = await this.http.get(
      `/projects/${projectId}/deployments/${deploymentId}/build-logs`,
      { params: { skip } }
    );
    const raw = data.data ?? data;
    // Normalise: handle array-of-objects {log, lineNumber, ...} or array-of-strings
    const toStrings = (arr: unknown[]): string[] =>
      arr.map((entry) =>
        typeof entry === "string"
          ? entry
          : typeof (entry as Record<string, unknown>).log === "string"
          ? ((entry as Record<string, unknown>).log as string)
          : JSON.stringify(entry)
      );
    if (Array.isArray(raw))        return toStrings(raw);
    if (Array.isArray(raw.logs))   return toStrings(raw.logs);
    if (Array.isArray(raw.lines))  return toStrings(raw.lines);
    return [];
  }

  /**
   * GET /projects/:projectId/environments/:envId/logs?since-seconds=60
   * Returns runtime log lines for a running container.
   */
  async getRuntimeLogs(
    projectId: string,
    envId:     string,
    sinceSecs = 60
  ): Promise<string[]> {
    const { data } = await this.http.get(
      `/projects/${projectId}/environments/${envId}/logs`,
      { params: { "since-seconds": sinceSecs } }
    );
    const raw = data.data ?? data;
    if (Array.isArray(raw)) return raw as string[];
    if (Array.isArray(raw.logs))  return raw.logs  as string[];
    if (Array.isArray(raw.lines)) return raw.lines as string[];
    return [];
  }

  /**
   * GET /projects/:projectId/environments
   * List all environments (used to find the running environment URL).
   */
  async listEnvironments(projectId: string): Promise<COEnvironment[]> {
    const { data } = await this.http.get(`/projects/${projectId}/environments`);
    const raw = data.data ?? data;
    return Array.isArray(raw) ? raw : (raw.environments ?? []);
  }
}

export const createos = new CreateOSClient();

// ── helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
