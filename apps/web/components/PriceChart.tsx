"use client";

import { useState, useMemo } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { MockToken } from "../lib/mock-data";
import {
  generatePriceHistory,
  compute24hStats,
  fmtUSD,
  fmtAxisTime,
  BNB_USD,
  type TimeRange,
} from "../lib/chart-data";
import { useChartData, buildChartPoints } from "../hooks/useChartData";

const RANGES: TimeRange[] = ["1H", "6H", "24H", "7D", "ALL"];

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function PriceTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { time: number; priceUSD: number; price: number; high: number; low: number; buyVol: number; sellVol: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-xl border border-bnb-border bg-[#16161a]/95 p-3 text-xs shadow-2xl backdrop-blur">
      <p className="mb-1.5 text-gray-500">
        {new Date(d.time).toLocaleString([], {
          month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        })}
      </p>
      <p className="font-mono text-base font-bold text-white">{fmtUSD(d.priceUSD)}</p>
      <p className="text-gray-500">{d.price.toFixed(12)} BNB</p>
      <div className="mt-2 flex gap-3 border-t border-white/5 pt-2">
        <div>
          <p className="text-gray-600">High</p>
          <p className="font-mono text-green-400">{fmtUSD(d.high)}</p>
        </div>
        <div>
          <p className="text-gray-600">Low</p>
          <p className="font-mono text-red-400">{fmtUSD(d.low)}</p>
        </div>
      </div>
    </div>
  );
}

function VolumeTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { time: number; buyVol: number; sellVol: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const total = d.buyVol + d.sellVol;
  return (
    <div className="rounded-xl border border-bnb-border bg-[#16161a]/95 p-3 text-xs shadow-2xl backdrop-blur">
      <p className="font-mono font-bold text-white">
        {fmtUSD(total, true)} vol
      </p>
      <div className="mt-1 flex gap-3">
        <span className="text-green-400">Buy {fmtUSD(d.buyVol, true)}</span>
        <span className="text-red-400">Sell {fmtUSD(d.sellVol, true)}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PriceChart({ token }: { token: MockToken }) {
  const [range, setRange] = useState<TimeRange>("24H");

  // useChartData discovers the curve from CurveInitialized logs, then fetches trades
  const tokenAddress = (token as any).address as `0x${string}` | undefined;
  const { events, loading, fetched, curveFound } = useChartData(tokenAddress);

  // Real data when we've fetched (regardless of whether a curve was found);
  // mock fallback only when there's no on-chain token address at all.
  const data = useMemo(() => {
    if (fetched && curveFound) return buildChartPoints(events, range);
    if (fetched && !curveFound && tokenAddress) return [];   // real token, no curve yet
    if (!tokenAddress)                          return generatePriceHistory(token, range);
    return [];
  }, [fetched, curveFound, events, range, token, tokenAddress]);

  const stats = useMemo(() => compute24hStats(data), [data]);

  const currentPrice = data[data.length - 1]?.priceUSD ?? 0;
  const isUp = stats.priceChange >= 0;

  // Y-axis domain with padding
  const prices = data.map((d) => d.priceUSD).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) * 0.97 : 0;
  const maxPrice = prices.length ? Math.max(...prices) * 1.03 : 1;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (tokenAddress && loading && !fetched) {
    return (
      <div className="flex h-80 items-center justify-center gap-3 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin text-bnb-yellow" />
        <span className="text-sm">Loading price data…</span>
      </div>
    );
  }

  // ── Empty state (token on-chain, curve found, but no trades yet) ───────────
  if (tokenAddress && fetched && curveFound && data.length === 0) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-bnb-border text-center">
        <TrendingUp className="h-8 w-8 text-bnb-yellow/50" />
        <p className="text-sm font-medium text-gray-400">No trades yet</p>
        <p className="max-w-xs text-xs text-gray-600">
          Be the first to buy — price history will appear here once trading starts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Current price + stats row */}
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-white">
            {fmtUSD(currentPrice)}
          </p>
          <p className="mt-0.5 font-mono text-xs text-gray-500">
            {token.price.toFixed(12)} BNB
          </p>
        </div>
        <div className="flex flex-wrap gap-4 pb-0.5 text-sm">
          <span className={`font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
            {isUp ? "▲" : "▼"} {Math.abs(stats.priceChange).toFixed(2)}%
          </span>
          <span className="text-gray-500">
            H <span className="text-white">{fmtUSD(stats.high)}</span>
          </span>
          <span className="text-gray-500">
            L <span className="text-white">{fmtUSD(stats.low)}</span>
          </span>
          <span className="text-gray-500">
            Vol <span className="text-white">{fmtUSD(stats.volumeUSD, true)}</span>
          </span>
        </div>
        {/* Range tabs */}
        <div className="ml-auto flex gap-0.5 rounded-lg border border-bnb-border bg-black/40 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                range === r
                  ? "bg-bnb-yellow text-black"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Price chart */}
      <div className="h-48 w-full select-none md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} syncId="tokenChart" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isUp ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isUp ? "#22c55e" : "#ef4444"} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#2a2a35"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tickFormatter={(v) => fmtAxisTime(v, range)}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={{ stroke: "#2a2a35" }}
              tickLine={false}
              minTickGap={60}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tickFormatter={(v) => fmtUSD(v)}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={72}
              orientation="right"
            />
            <Tooltip content={<PriceTooltip />} />
            <ReferenceLine
              y={currentPrice}
              stroke={isUp ? "#22c55e" : "#ef4444"}
              strokeDasharray="4 4"
              strokeOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="priceUSD"
              stroke={isUp ? "#22c55e" : "#ef4444"}
              strokeWidth={2}
              fill="url(#priceGrad)"
              dot={false}
              activeDot={{ r: 4, fill: isUp ? "#22c55e" : "#ef4444", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Volume chart */}
      <div className="mt-1 h-16 w-full select-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId="tokenChart" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Tooltip content={<VolumeTooltip />} />
            <Bar dataKey="buyVol"  stackId="vol" fill="#22c55e" fillOpacity={0.6} radius={[0,0,0,0]} maxBarSize={8} />
            <Bar dataKey="sellVol" stackId="vol" fill="#ef4444" fillOpacity={0.6} radius={[0,0,0,0]} maxBarSize={8} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Volume label */}
      <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-green-500/60" /> Buy vol
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-500/60" /> Sell vol
        </span>
      </div>
    </div>
  );
}
