import { Flame, Rocket, Bot, TrendingUp } from "lucide-react";
import { platformStats, formatUSD } from "../lib/mock-data";

const stats = [
  {
    label: "Tokens Launched",
    value: platformStats.totalLaunched.toLocaleString(),
    icon: Rocket,
    color: "text-bnb-yellow",
  },
  {
    label: "Total Volume",
    value: formatUSD(platformStats.totalVolume),
    icon: TrendingUp,
    color: "text-green-400",
  },
  {
    label: "Active Agents",
    value: platformStats.activeAgents.toLocaleString(),
    icon: Bot,
    color: "text-purple-400",
  },
  {
    label: "Tokens Burned",
    value: `${(platformStats.totalBurned / 1_000_000).toFixed(1)}M`,
    icon: Flame,
    color: "text-orange-400",
  },
];

export function StatsBar() {
  return (
    <div className="border-y border-bnb-border bg-bnb-card/50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 py-px md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-4">
            <div className={`rounded-lg bg-white/5 p-2 ${color}`}>
              <Icon size={16} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
