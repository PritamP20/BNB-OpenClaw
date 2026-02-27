import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "./config";
import { migrate } from "./db/client";
import { agentsRouter } from "./routes/agents";
import { proxyRouter }  from "./routes/proxy";
import { chatRouter }   from "./routes/chat";
import { logger } from "./lib/logger";

const app = express();

// ── Global middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// Agent management API
app.use("/api/agents", agentsRouter);

// AI Chat (token-gated)
app.use("/api/chat", chatRouter);

// Token-gated proxy  →  /agent/:agentId/<any path>
app.use("/agent", proxyRouter);

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error("Unhandled error", { error: message });
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  await migrate();
  app.listen(config.port, () => {
    logger.info(`API server running on port ${config.port}`, {
      env: config.nodeEnv,
    });
  });
}

start().catch((err) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});
