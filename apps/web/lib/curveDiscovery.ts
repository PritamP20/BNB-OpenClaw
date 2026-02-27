/**
 * Discovers the BondingCurve contract address for a given ERC-20 token.
 *
 * Strategy (no address-less getLogs needed):
 *  1. Fetch ERC-20 Transfer events ON the token contract (address is known → RPC allows it).
 *  2. Collect unique `to` addresses — the bonding curve received the initial supply via
 *     `safeTransferFrom(deployer, curve, amount)` in BondingCurve.initialize().
 *  3. For each candidate, call `initialized()` and `token()` on it.
 *     The first one that returns `initialized=true` and `token=tokenAddress` is the curve.
 *
 * This avoids publishing `eth_getLogs` without an address, which PublicNode rejects.
 */

import type { PublicClient } from "viem";
import { fetchAllLogs } from "./fetchLogs";
import { ADDRESSES } from "./contracts";

const ERC20_TRANSFER_EVENT = {
  name:   "Transfer",
  type:   "event",
  inputs: [
    { name: "from",  type: "address", indexed: true  },
    { name: "to",    type: "address", indexed: true  },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

const CURVE_CHECK_ABI = [
  {
    name: "initialized",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "token",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const ZERO = "0x0000000000000000000000000000000000000000";

export async function discoverBondingCurve(
  client:       PublicClient,
  tokenAddress: `0x${string}`,
): Promise<`0x${string}` | null> {
  // 1. Fetch Transfer events on the token contract itself (address is known)
  let transferLogs: any[] = [];
  try {
    transferLogs = await fetchAllLogs({
      client,
      address:   tokenAddress,
      event:     ERC20_TRANSFER_EVENT as any,
      fromBlock: ADDRESSES.startBlock,
    });
  } catch (e) {
    console.warn("curveDiscovery: failed to fetch Transfer logs", e);
    return null;
  }

  // 2. Collect unique recipients (skip zero address / burn address)
  const seen  = new Set<string>();
  const recipients: `0x${string}`[] = [];
  for (const log of transferLogs) {
    const to = (log as any).args?.to as string | undefined;
    if (!to || to.toLowerCase() === ZERO) continue;
    if (seen.has(to.toLowerCase())) continue;
    seen.add(to.toLowerCase());
    recipients.push(to as `0x${string}`);
  }

  // 3. Find the one that is a live, initialized BondingCurve for this token
  for (const candidate of recipients) {
    try {
      const [isInit, curveToken] = await Promise.all([
        client.readContract({
          address:      candidate,
          abi:          CURVE_CHECK_ABI,
          functionName: "initialized",
        }),
        client.readContract({
          address:      candidate,
          abi:          CURVE_CHECK_ABI,
          functionName: "token",
        }),
      ]);

      if (
        isInit === true &&
        (curveToken as string).toLowerCase() === tokenAddress.toLowerCase()
      ) {
        return candidate;
      }
    } catch {
      // Not a BondingCurve (no initialized() / token() function), skip
    }
  }

  return null;
}
