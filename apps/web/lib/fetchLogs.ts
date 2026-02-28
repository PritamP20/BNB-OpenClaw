import type { PublicClient, AbiEvent } from "viem";

/**
 * Fetches event logs across an arbitrary block range by splitting the query
 * into chunks of `chunkSize` blocks (default 5,000, safely under the 50,000
 * limit imposed by most BSC public RPC endpoints).
 *
 * `address` is optional — omit it to scan all contracts (useful for discovering
 * a bonding curve via its CurveInitialized event filtered by indexed token arg).
 * `args` can filter indexed event parameters in the same way viem's getLogs does.
 *
 * NOTE: Public BSC testnet RPCs (publicnode, etc.) prune history — querying
 * blocks too far back returns "History has been pruned". We clamp `fromBlock`
 * to `latestBlock - SAFE_BLOCK_RANGE` and wrap every chunk in try/catch so that
 * pruned chunks are silently skipped rather than crashing the whole fetch.
 * This means we degrade gracefully: we get whatever history the RPC serves.
 */
const SAFE_BLOCK_RANGE = 49_000n;

export async function fetchAllLogs<TAbiEvent extends AbiEvent>({
  client,
  address,
  event,
  args,
  fromBlock,
  toBlock,
  chunkSize = 5_000n,
}: {
  client: PublicClient;
  address?: `0x${string}`;
  event: TAbiEvent;
  args?: Record<string, unknown>;
  fromBlock: bigint;
  toBlock?: bigint;
  chunkSize?: bigint;
}) {
  const latestBlock = toBlock ?? (await client.getBlockNumber());

  // Clamp fromBlock so we never request blocks the RPC has pruned.
  const safeFrom =
    latestBlock > SAFE_BLOCK_RANGE
      ? latestBlock - SAFE_BLOCK_RANGE > fromBlock
        ? latestBlock - SAFE_BLOCK_RANGE
        : fromBlock
      : fromBlock;

  const allLogs: Awaited<ReturnType<typeof client.getLogs>> = [];

  for (let start = safeFrom; start <= latestBlock; start += chunkSize) {
    const end = start + chunkSize - 1n < latestBlock ? start + chunkSize - 1n : latestBlock;
    try {
      const chunk = await client.getLogs({
        ...(address ? { address } : {}),
        event,
        ...(args ? { args } : {}),
        fromBlock: start,
        toBlock:   end,
      } as any);
      allLogs.push(...(chunk as any));
    } catch (err: unknown) {
      // If the RPC has pruned this range, skip it — return whatever we have so far.
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("pruned") ||
        msg.includes("missing trie node") ||
        msg.includes("block not found") ||
        msg.includes("unknown block")
      ) {
        continue;
      }
      throw err;
    }
  }

  return allLogs;
}
