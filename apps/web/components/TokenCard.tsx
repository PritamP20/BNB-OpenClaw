import Link from "next/link";
import { Bot, Coins, Puzzle, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { Token } from "../hooks/useTokens";
import { formatUSD, timeAgo } from "../lib/mock-data";

const TYPE_CONFIG = {
  agent:  { label: "AI Agent", icon: Bot,    color: "text-purple-400", bg: "rgba(192,132,252,0.1)", border: "rgba(192,132,252,0.25)", glow: "rgba(192,132,252,0.12)" },
  normal: { label: "Token",    icon: Coins,  color: "text-bnb-yellow",  bg: "rgba(243,186,47,0.1)",  border: "rgba(243,186,47,0.25)",  glow: "rgba(243,186,47,0.1)"   },
  skill:  { label: "Skill",    icon: Puzzle, color: "text-green-400",  bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.25)",  glow: "rgba(74,222,128,0.1)"   },
};

const EMOJI_MAP: Record<Token["type"], string[]> = {
  agent:  ["🤖", "🧠", "⚡", "🔮", "🎯", "🚀"],
  normal: ["🟡", "💎", "🔥", "🌕", "⭐", "🦁"],
  skill:  ["🔧", "⚙️", "🔬", "📡", "🧩", "💡"],
};

function TokenAvatar({ name, type }: { name: string; type: Token["type"] }) {
  const cfg = TYPE_CONFIG[type];
  const idx = (name.charCodeAt(0) || 0) % EMOJI_MAP[type].length;
  return (
    <div
      className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl overflow-hidden"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {/* Inner glow ring */}
      <div className="absolute inset-0 rounded-2xl opacity-50" style={{ boxShadow: `inset 0 0 12px ${cfg.glow}` }} />
      <span className="relative z-10">{EMOJI_MAP[type][idx]}</span>
    </div>
  );
}

export function TokenCard({ token }: { token: Token }) {
  const cfg  = TYPE_CONFIG[token.type];
  const TypeIcon = cfg.icon;
  const isUp = token.priceChange24h >= 0;

  return (
    <Link href={`/token/${token.address}`}>
      <div
        className="group relative flex flex-col gap-3 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:-translate-y-1"
        style={{
          background: "rgba(14,14,20,0.85)",
          border: "1px solid rgba(243,186,47,0.1)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Hover glow border */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            boxShadow: `0 0 0 1px rgba(243,186,47,0.3), 0 0 24px rgba(243,186,47,0.07), 0 8px 32px rgba(0,0,0,0.5)`,
          }}
        />

        {/* Gradient corner accent */}
        <div
          className="absolute top-0 right-0 h-16 w-16 rounded-2xl opacity-20 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 100% 0%, ${cfg.glow} 0%, transparent 70%)`,
          }}
        />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <TokenAvatar name={token.name} type={token.type} />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-white leading-tight">{token.name}</span>
                {token.isGraduated && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-bnb-yellow"
                    style={{ background: "rgba(243,186,47,0.15)", border: "1px solid rgba(243,186,47,0.3)" }}
                  >
                    GRAD
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 font-mono">${token.symbol}</span>
            </div>
          </div>
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold flex-shrink-0"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
          >
            <TypeIcon size={10} />
            {cfg.label}
          </span>
        </div>

        {/* Description */}
        <p className="relative z-10 line-clamp-2 text-xs leading-relaxed text-gray-500">
          {token.description}
        </p>

        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-2 gap-2">
          {[
            { label: "Market Cap", value: formatUSD(token.marketCap) },
            { label: "24h Vol",    value: formatUSD(token.volume24h)  },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[10px] text-gray-600 mb-0.5">{label}</p>
              <p className="font-mono text-sm font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Price change */}
        <div className="relative z-10 flex items-center justify-between">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              background: isUp ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
              border: `1px solid ${isUp ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
              color: isUp ? "#4ade80" : "#f87171",
            }}
          >
            {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {isUp ? "+" : ""}{token.priceChange24h.toFixed(1)}%
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <span
              className={`h-1.5 w-1.5 rounded-full ${token.reputationScore >= 75 ? "bg-green-400" : token.reputationScore >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
            />
            Rep {token.reputationScore}/100
          </div>
        </div>

        {/* Graduation progress */}
        <div className="relative z-10">
          <div className="mb-1.5 flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 text-gray-600">
              <Zap size={9} className="text-bnb-yellow/60" />
              Bonding curve
            </span>
            <span
              className="font-mono font-bold"
              style={{ color: token.isGraduated ? "#4ade80" : "#F3BA2F" }}
            >
              {token.graduationProgress}%
            </span>
          </div>
          <div
            className="relative h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${token.graduationProgress}%`,
                background: token.isGraduated
                  ? "linear-gradient(90deg, #4ade80, #22d3ee)"
                  : "linear-gradient(90deg, #F3BA2F, #ffe07a)",
                boxShadow: token.isGraduated
                  ? "0 0 8px rgba(74,222,128,0.5)"
                  : "0 0 8px rgba(243,186,47,0.5)",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-gray-600">
          <span>{token.holders.toLocaleString()} holders</span>
          <span>{timeAgo(token.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

