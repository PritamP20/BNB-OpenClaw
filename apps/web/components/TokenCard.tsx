import Link from "next/link";
import { Bot, Coins, Puzzle, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { Token } from "../hooks/useTokens";
import { formatUSD, timeAgo } from "../lib/mock-data";

const TYPE_CONFIG = {
  agent:  { label: "AI Agent", icon: Bot,    color: "#1B4EF8", bg: "rgba(27,78,248,0.1)",  border: "#1B4EF8" },
  normal: { label: "Token",    icon: Coins,  color: "#F5C220", bg: "rgba(245,194,32,0.08)", border: "#F5C220" },
  skill:  { label: "Skill",    icon: Puzzle, color: "#D62828", bg: "rgba(214,40,40,0.1)",   border: "#D62828" },
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
      className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center text-xl"
      style={{ background: cfg.bg, borderLeft: `3px solid ${cfg.border}` }}
    >
      <span>{EMOJI_MAP[type][idx]}</span>
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
        className="group relative flex flex-col gap-3 p-4 cursor-pointer transition-all duration-200"
        style={{
          background: "#1A1A1A",
          border: "1px solid #333333",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#F5C220"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#333333"; }}
      >
        {/* Bauhaus color block top accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: cfg.color }} />

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <TokenAvatar name={token.name} type={token.type} />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-sm" style={{ color: "#F5F5F5" }}>{token.name}</span>
                {token.isGraduated && (
                  <span
                    className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                    style={{ background: "#F5C220", color: "#0F0F0F" }}
                  >
                    GRAD
                  </span>
                )}
              </div>
              <span className="text-xs font-mono" style={{ color: "#555555" }}>${token.symbol}</span>
            </div>
          </div>
          {/* Type badge */}
          <span
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider flex-shrink-0"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
          >
            <TypeIcon size={9} />
            {cfg.label}
          </span>
        </div>

        {/* Description */}
        <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: "#555555" }}>
          {token.description}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Market Cap", value: formatUSD(token.marketCap) },
            { label: "24h Vol",    value: formatUSD(token.volume24h)  },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="px-3 py-2"
              style={{ background: "#222222", borderLeft: "2px solid #333333" }}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#555555" }}>{label}</p>
              <p className="font-mono text-sm font-bold" style={{ color: "#F5F5F5" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Price change */}
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold"
            style={{
              background: isUp ? "rgba(74,222,128,0.1)" : "rgba(214,40,40,0.1)",
              border: `1px solid ${isUp ? "#4ade80" : "#D62828"}`,
              color: isUp ? "#4ade80" : "#D62828",
            }}
          >
            {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isUp ? "+" : ""}{token.priceChange24h.toFixed(1)}%
          </div>
          <div className="flex items-center gap-1 text-[10px]" style={{ color: "#555555" }}>
            <span
              className="h-1.5 w-1.5"
              style={{
                background: token.reputationScore >= 75 ? "#4ade80"
                  : token.reputationScore >= 50 ? "#F5C220"
                  : "#D62828",
              }}
            />
            Rep {token.reputationScore}/100
          </div>
        </div>

        {/* Graduation progress */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[9px]">
            <span className="font-bold uppercase tracking-wider" style={{ color: "#555555" }}>Bonding Curve</span>
            <span
              className="font-mono font-black"
              style={{ color: token.isGraduated ? "#4ade80" : "#F5C220" }}
            >
              {token.graduationProgress}%
            </span>
          </div>
          <div className="h-1.5 w-full bh-progress-track">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${token.graduationProgress}%`,
                background: token.isGraduated ? "#4ade80" : "#F5C220",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px]" style={{ color: "#555555" }}>
          <span>{token.holders.toLocaleString()} holders</span>
          <span>{timeAgo(token.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
