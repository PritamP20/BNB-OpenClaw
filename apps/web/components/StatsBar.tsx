"use client";

import { Flame, Rocket, Bot, TrendingUp, Droplets, Zap } from "lucide-react";
import { platformStats, formatUSD } from "../lib/mock-data";

const stats = [
  { label: "Tokens Launched", value: platformStats.totalLaunched.toLocaleString(), icon: Rocket,    accentColor: "#F5C220" },
  { label: "Total Volume",    value: formatUSD(platformStats.totalVolume),           icon: TrendingUp, accentColor: "#4ade80" },
  { label: "Active Agents",  value: platformStats.activeAgents.toLocaleString(),    icon: Bot,        accentColor: "#1B4EF8" },
  { label: "Total Liquidity",value: formatUSD(platformStats.totalVolume * 0.4),     icon: Droplets,   accentColor: "#F5C220" },
  { label: "Tokens Burned",  value: `${(platformStats.totalBurned / 1_000_000).toFixed(1)}M`, icon: Flame, accentColor: "#D62828" },
  { label: "Transactions",   value: (platformStats.totalLaunched * 14).toLocaleString(), icon: Zap,   accentColor: "#1B4EF8" },
];

export function StatsBar() {
  return (
    <div className="relative py-8" style={{ background: "#111111", borderBottom: "1px solid #222222" }}>
      <div className="mx-auto max-w-7xl px-4">
        {/* Section header — Bauhaus style */}
        <div className="mb-6 flex items-center gap-4">
          <div className="h-5 w-1" style={{ background: "#F5C220" }} />
          <span className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "#888888" }}>
            Platform Stats
          </span>
          <div className="h-px flex-1" style={{ background: "#222222" }} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-6" style={{ border: "1px solid #222222" }}>
          {stats.map(({ label, value, icon: Icon, accentColor }, i) => (
            <div
              key={label}
              className="flex flex-col gap-3 p-4 transition-colors"
              style={{
                borderRight: i < stats.length - 1 ? "1px solid #222222" : "none",
                borderLeft: `3px solid ${accentColor}`,
                background: "#111111",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#1A1A1A"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "#111111"; }}
            >
              {/* Icon block */}
              <div
                className="flex h-8 w-8 items-center justify-center"
                style={{ background: "#222222" }}
              >
                <Icon size={14} style={{ color: accentColor }} />
              </div>

              <div>
                <p
                  className="text-xl font-black tracking-tight"
                  style={{ color: "#F5F5F5", fontVariantNumeric: "tabular-nums" }}
                >
                  {value}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "#555555" }}>
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
