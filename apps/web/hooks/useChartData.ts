"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { formatEther } from "viem";
import { BONDING_CURVE_ABI } from "../lib/contracts";
import { fetchAllLogs } from "../lib/fetchLogs";
import type { ChartPoint, TimeRange } from "../lib/chart-data";
import { BNB_USD } from "../lib/chart-data";

// ── BSC is ~3 s / block ────────────────────────────────────────────────────────
const BSC_MS_PER_BLOCK = 3_000;

const RANGE_MS: Record<TimeRange, number> = {
  "1H":  3_600_000,
  "6H":  21_600_000,
  "24H": 86_400_000,
  "7D":  604_800_000,
  "ALL": Infinity,
};

const BUY_EVENT  = BONDING_CURVE_ABI.find((x) => x.name === "Buy"  && x.type === "event")!;
const SELL_EVENT = BONDING_CURVE_ABI.find((x) => x.name === "Sell" && x.type === "event")!;

export interface RawChartEvent {
  ts:            number;          // estimated unix ms
  blockNumber:   bigint;
  priceAfterBNB: number;          // BNB per token  (formatEther of priceAfter)
  bnbAmount:     number;          // BNB paid/received
  type:          "buy" | "sell";
}

// ── Bucket events into OHLC candles ──────────────────────────────────────────

export function buildChartPoints(
  events: RawChartEvent[],
  range:  TimeRange,
  nBuckets = 120,
): ChartPoint[] {
  if (events.length === 0) return [];

  // Sort oldest → newest
  const sorted = [...events].sort((a, b) => a.ts - b.ts);

  const now    = Date.now();
  const oldest = sorted[0]!.ts;
  const windowMs = range === "ALL"
    ? Math.max(now - oldest, 60_000)
    : RANGE_MS[range];
  const startTime = now - windowMs;

  const inRange = sorted.filter((e) => e.ts >= startTime);

  // If no events within the range window, return a single flat point at last price
  if (inRange.length === 0) {
    const last = sorted[sorted.length - 1]!;
    const p = last.priceAfterBNB * BNB_USD;
    return [{ time: startTime, price: last.priceAfterBNB, priceUSD: p, buyVol: 0, sellVol: 0, open: p, close: p, high: p, low: p }];
  }

  const bucketMs = windowMs / nBuckets;
  const points: ChartPoint[] = [];
  let lastCloseBNB = inRange[0]!.priceAfterBNB;

  for (let i = 0; i < nBuckets; i++) {
    const bStart = startTime + i * bucketMs;
    const bEnd   = bStart + bucketMs;
    const bucket = inRange.filter((e) => e.ts >= bStart && e.ts < bEnd);

    if (bucket.length === 0) {
      // Forward-fill at last close price
      const p = lastCloseBNB * BNB_USD;
      points.push({ time: bStart, price: lastCloseBNB, priceUSD: p, buyVol: 0, sellVol: 0, open: p, close: p, high: p, low: p });
    } else {
      const prices  = bucket.map((e) => e.priceAfterBNB * BNB_USD);
      const open    = bucket[0]!.priceAfterBNB * BNB_USD;
      const close   = bucket[bucket.length - 1]!.priceAfterBNB * BNB_USD;
      const high    = Math.max(...prices);
      const low     = Math.min(...prices);
      lastCloseBNB  = bucket[bucket.length - 1]!.priceAfterBNB;

      const buyVol  = bucket
        .filter((e) => e.type === "buy")
        .reduce((s, e) => s + e.bnbAmount * BNB_USD, 0);
      const sellVol = bucket
        .filter((e) => e.type === "sell")
        .reduce((s, e) => s + e.bnbAmount * BNB_USD, 0);

      points.push({
        time:     bStart,
        price:    close / BNB_USD,
        priceUSD: close,
        buyVol,
        sellVol,
        open,
        close,
        high,
        low,
      });
    }
  }

  return points;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChartData(curveAddress: `0x${string}` | undefined) {
  const publicClient = usePublicClient({ chainId: bscTestnet.id });
  const [events,  setEvents]  = useState<RawChartEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!publicClient || !curveAddress) {
      setFetched(true);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [latestBlock, buyLogs, sellLogs] = await Promise.all([
          publicClient.getBlockNumber(),
          fetchAllLogs({ client: publicClient, address: curveAddress, event: BUY_EVENT  as never, fromBlock: 0n }),
          fetchAllLogs({ client: publicClient, address: curveAddress, event: SELL_EVENT as never, fromBlock: 0n }),
        ]);

        if (cancelled) return;

        const now = Date.now();
        const toTs = (blockNumber: bigint) =>
          now - Number(latestBlock - blockNumber) * BSC_MS_PER_BLOCK;

        const mapped: RawChartEvent[] = [
          ...(buyLogs as any[]).map((l) => ({
            type:          "buy"  as const,
            blockNumber:   l.blockNumber as bigint,
            ts:            toTs(l.blockNumber as bigint),
            priceAfterBNB: parseFloat(formatEther(l.args.priceAfter as bigint)),
            bnbAmount:     parseFloat(formatEther(l.args.bnbPaid   as bigint)),
          })),
          ...(sellLogs as any[]).map((l) => ({
            type:          "sell" as const,
            blockNumber:   l.blockNumber as bigint,
            ts:            toTs(l.blockNumber as bigint),
            priceAfterBNB: parseFloat(formatEther(l.args.priceAfter as bigint)),
            bnbAmount:     parseFloat(formatEther(l.args.bnbGross  as bigint)),
          })),
        ];

        // Sort oldest → newest
        mapped.sort((a, b) => Number(a.blockNumber - b.blockNumber));

        setEvents(mapped);
      } catch (e) {
        console.error("useChartData: failed to fetch chart events", e);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setFetched(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [curveAddress, publicClient]);

  return { events, loading, fetched };
}
