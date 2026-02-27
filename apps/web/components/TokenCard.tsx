import Link from "next/link";
import { Bot, Coins, Puzzle, TrendingUp, TrendingDown } from "lucide-react";
import { Token } from "../hooks/useTokens";
import { formatUSD, timeAgo } from "../lib/mock-data";

const TYPE_CONFIG = {
  agent: { label: "Agent", icon: Bot, color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  normal: { label: "Token", icon: Coins, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  skill: { label: "Skill", icon: Puzzle, color: "text-green-400 bg-green-400/10 border-green-400/20" },
};

function TokenAvatar({ name, type }: { name: string; type: Token["type"] }) {
  const emojis: Record<Token["type"], string[]> = {
    agent: ["🤖", "🧠", "⚡", "🔮", "🎯", "🚀"],
    normal: ["🟡", "💎", "🔥", "🌕", "⭐", "🦁"],
    skill: ["🔧", "⚙️", "🔬", "📡", "🧩", "💡"],
  };
  const idx = (name.charCodeAt(0) || 0) % emojis[type].length;
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl">
      {emojis[type][idx]}
    </div>
  );
}

function ReputationDot({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-green-400" : score >= 50 ? "bg-yellow-400" : "bg-red-400";
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
  );
}

export function TokenCard({ token }: { token: Token }) {
  const cfg = TYPE_CONFIG[token.type];
  const TypeIcon = cfg.icon;
  const isUp = token.priceChange24h >= 0;

  return (
    <Link href={`/token/${token.address}`}>
      <div className="group flex flex-col gap-3 rounded-xl border border-bnb-border bg-bnb-card p-4 transition-all duration-200 hover:border-bnb-yellow/30 hover:bg-white/5 hover:shadow-lg hover:shadow-bnb-yellow/5 cursor-pointer">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <TokenAvatar name={token.name} type={token.type} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold leading-tight text-white">{token.name}</span>
                {token.isGraduated && (
                  <span className="rounded bg-bnb-yellow/20 px-1 py-0.5 text-[10px] font-bold text-bnb-yellow">
                    GRAD
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">${token.symbol}</span>
            </div>
          </div>
          <span
            className={`flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}
          >
            <TypeIcon size={10} />
            {cfg.label}
          </span>
        </div>

        {/* Description */}
        <p className="line-clamp-2 text-xs leading-relaxed text-gray-400">
          {token.description}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[11px] text-gray-500">Market Cap</p>
            <p className="font-mono text-sm font-semibold text-white">
              {formatUSD(token.marketCap)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-500">24h Vol</p>
            <p className="font-mono text-sm font-semibold text-white">
              {formatUSD(token.volume24h)}
            </p>
          </div>
        </div>

        {/* Price change */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs">
            {isUp ? (
              <TrendingUp size={13} className="text-green-400" />
            ) : (
              <TrendingDown size={13} className="text-red-400" />
            )}
            <span className={isUp ? "text-green-400" : "text-red-400"}>
              {isUp ? "+" : ""}{token.priceChange24h.toFixed(1)}%
            </span>
            <span className="text-gray-500">24h</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <ReputationDot score={token.reputationScore} />
            {token.reputationScore}/100
          </div>
        </div>

        {/* Graduation progress */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Bonding curve</span>
            <span className="text-gray-400">{token.graduationProgress}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${token.isGraduated ? "bg-green-400" : "bg-bnb-yellow"
                }`}
              style={{ width: `${token.graduationProgress}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>{token.holders.toLocaleString()} holders</span>
          <span>{timeAgo(token.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
