import "dotenv/config";

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export const config = {
  port:    parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",

  databaseUrl: required("DATABASE_URL"),

  bnbRpcUrl: process.env.BNB_RPC_URL ?? "https://bsc-testnet-dataseed.bnbchain.org",

  tokenGateThreshold: BigInt(
    process.env.TOKEN_GATE_THRESHOLD ?? "1000000000000000000"
  ),
  signatureTtlSeconds: parseInt(
    process.env.SIGNATURE_TTL_SECONDS ?? "300", 10
  ),

  createos: {
    apiUrl: process.env.CREATEOS_API_URL ?? "https://api-createos.nodeops.network/v1",
    apiKey: process.env.CREATEOS_API_KEY ?? "",
    cpu:      parseInt(process.env.CREATEOS_CPU      ?? "200", 10),
    memory:   parseInt(process.env.CREATEOS_MEMORY   ?? "512", 10),
    replicas: parseInt(process.env.CREATEOS_REPLICAS ?? "1",   10),
  },
} as const;
