"use client";

import { useState, useMemo } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import { variants } from "../lib/animations";

const RANGES: TimeRange[] = ["1H", "6H", "24H", "7D", "ALL"];

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function PriceTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { time: number; priceUSD: number; price: number; high: number; low: number; buyVol: number; sellVol: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="p-3 text-xs" style={{ background: "#222222", border: "1px solid #333333" }}>
      <p className="mb-1.5" style={{ color: "#555555" }}>
        {new Date(d.time).toLocaleString([], {
          month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        })}
      </p>
      <p className="font-mono text-base font-black" style={{ color: "#F5F5F5" }}>{fmtUSD(d.priceUSD)}</p>
      <p style={{ color: "#555555" }}>{d.price.toFixed(12)} BNB</p>
      <div className="mt-2 flex gap-3 pt-2" style={{ borderTop: "1px solid #333333" }}>
        <div>
          <p style={{ color: "#555555" }}>High</p>
          <p className="font-mono font-bold" style={{ color: "#4ade80" }}>{fmtUSD(d.high)}</p>
        </div>
        <div>
          <p style={{ color: "#555555" }}>Low</p>
          <p className="font-mono font-bold" style={{ color: "#D62828" }}>{fmtUSD(d.low)}</p>
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
    <div className="p-3 text-xs" style={{ background: "#222222", border: "1px solid #333333" }}>
      <p className="font-mono font-bold" style={{ color: "#F5F5F5" }}>
        {fmtUSD(total, true)} vol
      </p>
      <div className="mt-1 flex gap-3">
        <span style={{ color: "#4ade80" }}>Buy {fmtUSD(d.buyVol, true)}</span>
        <span style={{ color: "#D62828" }}>Sell {fmtUSD(d.sellVol, true)}</span>
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
      <motion.div
        variants={variants.slideUp}
        initial="hidden"
        animate="visible"
        className="flex h-80 items-center justify-center gap-3"
        style={{ color: "#555555" }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-5 w-5" style={{ color: "#F5C220" }} />
        </motion.div>
        <motion.span
          className="text-sm font-bold uppercase tracking-wider"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Loading price data…
        </motion.span>
      </motion.div>
    );
  }

  // ── Empty state (token on-chain, curve found, but no trades yet) ───────────
  if (tokenAddress && fetched && curveFound && data.length === 0) {
    return (
      <motion.div
        variants={variants.slideUp}
        initial="hidden"
        animate="visible"
        className="flex h-80 flex-col items-center justify-center gap-3 text-center"
        style={{ border: "1px solid #333333" }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <TrendingUp className="h-8 w-8" style={{ color: "#333333" }} />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm font-black uppercase tracking-wider"
          style={{ color: "#888888" }}
        >
          No trades yet
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="max-w-xs text-xs font-bold uppercase tracking-wider"
          style={{ color: "#444444" }}
        >
          Be the first to buy — price history will appear here once trading starts.
        </motion.p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={variants.slideUp}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-0"
    >
      {/* Current price + stats row */}
      <motion.div
        className="mb-4 flex flex-wrap items-end gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <motion.p
            className="text-3xl font-black tracking-tight"
            style={{ color: "#F5F5F5" }}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {fmtUSD(currentPrice)}
          </motion.p>
          <motion.p
            className="mt-0.5 font-mono text-xs"
            style={{ color: "#555555" }}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            {token.price.toFixed(12)} BNB
          </motion.p>
        </motion.div>
        <motion.div
          className="flex flex-wrap gap-4 pb-0.5 text-sm"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.span
            className="font-bold"
            style={{ color: isUp ? "#4ade80" : "#D62828" }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            {isUp ? "▲" : "▼"} {Math.abs(stats.priceChange).toFixed(2)}%
          </motion.span>
          <span style={{ color: "#555555" }}>
            H <span style={{ color: "#F5F5F5" }}>{fmtUSD(stats.high)}</span>
          </span>
          <span style={{ color: "#555555" }}>
            L <span style={{ color: "#F5F5F5" }}>{fmtUSD(stats.low)}</span>
          </span>
          <span style={{ color: "#555555" }}>
            Vol <span style={{ color: "#F5F5F5" }}>{fmtUSD(stats.volumeUSD, true)}</span>
          </span>
        </motion.div>
        {/* Range tabs */}
        <motion.div
          className="ml-auto flex"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          style={{ border: "1px solid #333333" }}
        >
          <AnimatePresence mode="wait">
            {RANGES.map((r, idx) => (
              <motion.button
                key={r}
                onClick={() => setRange(r)}
                className="px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors"
                style={{
                  background: range === r ? "#F5C220" : "#1A1A1A",
                  color: range === r ? "#0F0F0F" : "#555555",
                  borderRight: idx < RANGES.length - 1 ? "1px solid #333333" : "none",
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + idx * 0.05 }}
              >
                {r}
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Price chart */}
      <motion.div
        className="h-48 w-full select-none md:h-64"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        key={`price-${range}`}
      >
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
              stroke="#333333"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tickFormatter={(v) => fmtAxisTime(v, range)}
              tick={{ fill: "#555555", fontSize: 10, fontWeight: 700 }}
              axisLine={{ stroke: "#333333" }}
              tickLine={false}
              minTickGap={60}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tickFormatter={(v) => fmtUSD(v)}
              tick={{ fill: "#555555", fontSize: 10, fontWeight: 700 }}
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
      </motion.div>

      {/* Volume chart */}
      <motion.div
        className="mt-1 h-16 w-full select-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        key={`volume-${range}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId="tokenChart" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Tooltip content={<VolumeTooltip />} />
            <Bar dataKey="buyVol"  stackId="vol" fill="#22c55e" fillOpacity={0.6} radius={[0,0,0,0]} maxBarSize={8} />
            <Bar dataKey="sellVol" stackId="vol" fill="#ef4444" fillOpacity={0.6} radius={[0,0,0,0]} maxBarSize={8} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Volume label */}
      <motion.div
        className="mt-1 flex items-center gap-3 text-[11px] text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <motion.span
          className="flex items-center gap-1"
          whileHover={{ scale: 1.1 }}
        >
          <span className="inline-block h-2 w-2 rounded-sm bg-green-500/60" /> Buy vol
        </motion.span>
        <motion.span
          className="flex items-center gap-1"
          whileHover={{ scale: 1.1 }}
        >
          <span className="inline-block h-2 w-2 rounded-sm bg-red-500/60" /> Sell vol
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
