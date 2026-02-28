import { Flame, Rocket, Bot, TrendingUp, Droplets, Zap } from "lucide-react";
import { platformStats, formatUSD } from "../lib/mock-data";

const stats = [
  {
    label: "Tokens Launched",
    value: platformStats.totalLaunched.toLocaleString(),
    icon: Rocket,
    color: "text-bnb-yellow",
    glow: "rgba(243,186,47,0.35)",
    bg: "rgba(243,186,47,0.08)",
    border: "rgba(243,186,47,0.2)",
  },
  {
    label: "Total Volume",
    value: formatUSD(platformStats.totalVolume),
    icon: TrendingUp,
    color: "text-green-400",
    glow: "rgba(74,222,128,0.35)",
    bg: "rgba(74,222,128,0.08)",
    border: "rgba(74,222,128,0.2)",
  },
  {
    label: "Active Agents",
    value: platformStats.activeAgents.toLocaleString(),
    icon: Bot,
    color: "text-purple-400",
    glow: "rgba(192,132,252,0.35)",
    bg: "rgba(192,132,252,0.08)",
    border: "rgba(192,132,252,0.2)",
  },
  {
    label: "Total Liquidity",
    value: formatUSD(platformStats.totalVolume * 0.4),
    icon: Droplets,
    color: "text-cyan-400",
    glow: "rgba(34,211,238,0.35)",
    bg: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.2)",
  },
  {
    label: "Tokens Burned",
    value: `${(platformStats.totalBurned / 1_000_000).toFixed(1)}M`,
    icon: Flame,
    color: "text-orange-400",
    glow: "rgba(251,146,60,0.35)",
    bg: "rgba(251,146,60,0.08)",
    border: "rgba(251,146,60,0.2)",
  },
  {
    label: "Transactions",
    value: (platformStats.totalLaunched * 14).toLocaleString(),
    icon: Zap,
    color: "text-blue-400",
    glow: "rgba(96,165,250,0.35)",
    bg: "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.2)",
  },
];

export function StatsBar() {
  return (
    <div className="relative overflow-hidden py-8">
      {/* Thin separator lines */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent 10%, rgba(243,186,47,0.12) 30%, rgba(243,186,47,0.25) 50%, rgba(243,186,47,0.12) 70%, transparent 90%)" }} />
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.04) 50%, transparent 90%)" }} />

      {/* Background tint */}
      <div className="absolute inset-0" style={{ background: "rgba(10,10,14,0.5)", backdropFilter: "blur(12px)" }} />

      <div className="relative mx-auto max-w-7xl px-5">
        {/* Section header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04))" }} />
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-gray-600">Platform Stats</span>
          <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.04), transparent)" }} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(({ label, value, icon: Icon, color, glow, bg, border }) => (
            <div
              key={label}
              className="group relative flex flex-col gap-3 rounded-2xl p-4 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.015)",
                border: `1px solid rgba(255,255,255,0.04)`,
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ boxShadow: `0 0 20px ${glow.replace("0.35", "0.15")}`, background: bg.replace("0.08", "0.03") }}
              />

              {/* Top highlight */}
              <div className="absolute inset-x-0 top-0 h-12 rounded-t-2xl bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

              <div
                className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <Icon size={14} className={color} />
              </div>

              <div className="relative z-10">
                <p className="text-lg font-extrabold tracking-tight text-gray-100"
                  style={{ fontVariantNumeric: "tabular-nums" }}>
                  {value}
                </p>
                <p className="text-[10px] font-medium text-gray-600 mt-0.5 tracking-wide">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

