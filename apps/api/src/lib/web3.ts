import { ethers } from "ethers";
import { config } from "../config";

// Lazy singleton RPC provider
let _provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) _provider = new ethers.JsonRpcProvider(config.bnbRpcUrl);
  return _provider;
}

// Minimal ERC-20 ABI — only what we need
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

// ── Signature verification ──────────────────────────────────────────────────

/**
 * Verify that `signature` was produced by signing `message` with the private
 * key that corresponds to `expectedAddress`.
 *
 * Returns true if valid, false otherwise (never throws).
 */
export function verifySignature(
  message:         string,
  signature:       string,
  expectedAddress: string
): boolean {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Build the canonical message a user must sign to prove wallet ownership.
 * Format: "AgentLaunch access\nagentId: {id}\ntimestamp: {ts}"
 *
 * We include a timestamp so the signature can only be replayed for
 * `config.signatureTtlSeconds` seconds.
 */
export function buildAccessMessage(agentId: string, timestampSeconds: number): string {
  return `AgentLaunch access\nagentId: ${agentId}\ntimestamp: ${timestampSeconds}`;
}

// ── ERC-20 balance check ────────────────────────────────────────────────────

/**
 * Returns the raw ERC-20 balance (in wei) for `walletAddress` on the token at
 * `tokenAddress` using the configured BNB RPC.
 */
export async function getTokenBalance(
  tokenAddress:  string,
  walletAddress: string
): Promise<bigint> {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, getProvider());
  const balance: bigint = await contract.balanceOf(walletAddress);
  return balance;
}

/**
 * Quick check: does `walletAddress` hold at least `threshold` (wei) of
 * `tokenAddress`?
 */
export async function hasEnoughTokens(
  tokenAddress:  string,
  walletAddress: string,
  threshold:     bigint = config.tokenGateThreshold
): Promise<{ ok: boolean; balance: bigint }> {
  const balance = await getTokenBalance(tokenAddress, walletAddress);
  return { ok: balance >= threshold, balance };
}
