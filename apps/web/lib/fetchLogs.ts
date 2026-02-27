import type { PublicClient, AbiEvent } from "viem";

/**
 * Fetches event logs across an arbitrary block range by splitting the query
 * into chunks of `chunkSize` blocks (default 49,000, safely under the 50,000
 * limit imposed by most BSC public RPC endpoints).
 */
export async function fetchAllLogs<TAbiEvent extends AbiEvent>({
  client,
  address,
  event,
  fromBlock,
  toBlock,
  chunkSize = 49_000n,
}: {
  client: PublicClient;
  address: `0x${string}`;
  event: TAbiEvent;
  fromBlock: bigint;
  toBlock?: bigint;
  chunkSize?: bigint;
}) {
  const latestBlock = toBlock ?? (await client.getBlockNumber());

  const allLogs: Awaited<ReturnType<typeof client.getLogs>>= [];

  for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
    const end = start + chunkSize - 1n < latestBlock ? start + chunkSize - 1n : latestBlock;
    const chunk = await client.getLogs({
      address,
      event,
      fromBlock: start,
      toBlock:   end,
    });
    allLogs.push(...(chunk as any));
  }

  return allLogs;
}
