import winston from "winston";
import { config } from "../config";

export const logger = winston.createLogger({
  level: config.nodeEnv === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.nodeEnv === "production"
      ? winston.format.json()
      : winston.format.colorize({ all: true }),
    config.nodeEnv !== "production"
      ? winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}] ${message}${extra}`;
        })
      : winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});
