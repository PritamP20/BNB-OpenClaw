"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatEther } from "viem";
import { BONDING_CURVE_ABI, ADDRESSES } from "../lib/contracts";
import { fetchAllLogs } from "../lib/fetchLogs";

export interface Trade {
  type: "buy" | "sell";
  wallet: string;
  walletFull: string;
  tokenAmount: number;
  bnbAmount: string;
  blockNumber: bigint;
  estimatedTs: number;
  txHash: string;
}

// BSC produces ~3 s/block; good enough for age display
const BSC_MS_PER_BLOCK = 3_000;

const CURVE_INIT_EVENT = BONDING_CURVE_ABI.find((x) => x.name === "CurveInitialized" && x.type === "event")!;
const BUY_EVENT        = BONDING_CURVE_ABI.find((x) => x.name === "Buy"              && x.type === "event")!;
const SELL_EVENT       = BONDING_CURVE_ABI.find((x) => x.name === "Sell"             && x.type === "event")!;

/**
 * Fetch real on-chain Buy/Sell events for a token.
 * Accepts the ERC-20 token address; internally discovers the bonding curve
 * by scanning CurveInitialized(token indexed) events across all contracts.
 */
export function useTrades(tokenAddress: `0x${string}` | undefined) {
  const publicClient = usePublicClient({ chainId: bscTestnet.id });
  const [trades, setTrades]     = useState<Trade[]>([]);
  const [loading, setLoading]   = useState(false);
  const [fetched, setFetched]   = useState(false);
  const [curveFound, setCurveFound] = useState<`0x${string}` | null>(null);

  useEffect(() => {
    if (!publicClient || !tokenAddress) {
      setFetched(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setTrades([]);
    setCurveFound(null);
    setFetched(false);

    (async () => {
      try {
        // ── Step 1: discover the bonding curve ───────────────────────────────
        const initLogs = await fetchAllLogs({
          client: publicClient,
          event: CURVE_INIT_EVENT as never,
          args: { token: tokenAddress } as any,
          fromBlock: ADDRESSES.startBlock,
        });

        if (cancelled) return;

        if (initLogs.length === 0) {
          // No bonding curve for this token
          setFetched(true);
          setLoading(false);
          return;
        }

        const curveAddress = (initLogs[0] as any).address as `0x${string}`;
        setCurveFound(curveAddress);

        // ── Step 2: fetch all Buy + Sell events from that curve ───────────────
        const [latestBlock, buyLogs, sellLogs] = await Promise.all([
          publicClient.getBlockNumber(),
          fetchAllLogs({
            client: publicClient,
            address: curveAddress,
            event: BUY_EVENT as never,
            fromBlock: ADDRESSES.startBlock,
          }),
          fetchAllLogs({
            client: publicClient,
            address: curveAddress,
            event: SELL_EVENT as never,
            fromBlock: ADDRESSES.startBlock,
          }),
        ]);

        if (cancelled) return;

        const now = Date.now();

        const mapped: Trade[] = [
          ...buyLogs.map((l: any) => ({
            type:        "buy"  as const,
            walletFull:  l.args.buyer  as string,
            wallet:      (l.args.buyer  as string).slice(0, 6) + "…" + (l.args.buyer  as string).slice(-4),
            tokenAmount: Number(formatEther(l.args.tokensOut as bigint)),
            bnbAmount:   parseFloat(formatEther(l.args.bnbPaid as bigint)).toFixed(4),
            blockNumber: l.blockNumber as bigint,
            estimatedTs: now - Number(latestBlock - (l.blockNumber as bigint)) * BSC_MS_PER_BLOCK,
            txHash:      l.transactionHash as string,
          })),
          ...sellLogs.map((l: any) => ({
            type:        "sell" as const,
            walletFull:  l.args.seller as string,
            wallet:      (l.args.seller as string).slice(0, 6) + "…" + (l.args.seller as string).slice(-4),
            tokenAmount: Number(formatEther(l.args.tokensIn as bigint)),
            bnbAmount:   parseFloat(formatEther(l.args.bnbNet as bigint)).toFixed(4),
            blockNumber: l.blockNumber as bigint,
            estimatedTs: now - Number(latestBlock - (l.blockNumber as bigint)) * BSC_MS_PER_BLOCK,
            txHash:      l.transactionHash as string,
          })),
        ];

        // Sort newest first
        mapped.sort((a, b) => Number(b.blockNumber - a.blockNumber));
        setTrades(mapped);
      } catch (e) {
        console.error("useTrades: failed to fetch trade logs", e);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setFetched(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [tokenAddress, publicClient]);

  return { trades, loading, fetched, curveFound };
}
