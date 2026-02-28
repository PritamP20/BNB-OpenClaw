"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, Flame, Clock, TrendingUp, Bot, Coins, Puzzle, Rocket, X } from "lucide-react";
import { TokenCard } from "./TokenCard";
import { useTokens, type Token } from "../hooks/useTokens";
import { Loader2 } from "lucide-react";

type Filter  = "all" | Token["type"];
type SortKey = "trending" | "new" | "marketcap";

const FILTERS: { value: Filter; label: string; icon: React.ElementType; color: string }[] = [
  { value: "all",    label: "All",       icon: Rocket, color: "text-bnb-yellow" },
  { value: "agent",  label: "AI Agents", icon: Bot,    color: "text-purple-400"  },
  { value: "normal", label: "Tokens",    icon: Coins,  color: "text-blue-400"    },
  { value: "skill",  label: "Skills",    icon: Puzzle, color: "text-green-400"   },
];

const SORTS: { value: SortKey; label: string; icon: React.ElementType }[] = [
  { value: "trending",  label: "Trending", icon: Flame   },
  { value: "new",       label: "New",      icon: Clock   },
  { value: "marketcap", label: "Top Cap",  icon: TrendingUp },
];

export function TrendingFeed() {
  const { tokens, isLoading, error } = useTokens();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort,   setSort]   = useState<SortKey>("trending");
  const [search, setSearch] = useState("");

  const filtered = tokens
    .filter((t) => filter === "all" || t.type === filter)
    .filter(
      (t) =>
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.symbol.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "new")       return b.createdAt - a.createdAt;
      if (sort === "marketcap") return b.marketCap - a.marketCap;
      return (
        b.volume24h * 0.6 + b.priceChange24h * 100 -
        (a.volume24h * 0.6 + a.priceChange24h * 100)
      );
    });

  return (
    <section className="relative mx-auto max-w-7xl px-5 py-12">
      {/* Section header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-white">
            Live <span className="shimmer-text">Token Feed</span>
          </h2>
          <p className="mt-1.5 text-[13px] text-gray-600">
            {tokens.length} token{tokens.length !== 1 ? "s" : ""} on BNB Chain
          </p>
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            placeholder="Search tokens…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-60 rounded-xl pl-9 pr-9 text-sm text-white placeholder-gray-700 outline-none transition-all duration-300"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = "1px solid rgba(243,186,47,0.3)";
              e.currentTarget.style.boxShadow = "0 0 16px rgba(243,186,47,0.06)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Controls row */}
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Type filters */}
        <div
          className="flex gap-0.5 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
        >
          {FILTERS.map(({ value, label, icon: Icon, color }) => {
            const active = filter === value;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className="relative flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all duration-200"
                style={{
                  background: active ? "rgba(243,186,47,0.08)" : "transparent",
                  color: active ? "#F3BA2F" : "#6b7280",
                  border: active ? "1px solid rgba(243,186,47,0.15)" : "1px solid transparent",
                  boxShadow: active ? "0 0 12px rgba(243,186,47,0.08)" : "none",
                }}
              >
                <Icon size={12} className={active ? "text-bnb-yellow" : color} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Sort tabs */}
        <div
          className="flex gap-0.5 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
        >
          {SORTS.map(({ value, label, icon: Icon }) => {
            const active = sort === value;
            return (
              <button
                key={value}
                onClick={() => setSort(value)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200"
                style={{
                  background: active ? "rgba(255,255,255,0.05)" : "transparent",
                  color: active ? "#e2e8f0" : "#4b5563",
                }}
              >
                <Icon size={11} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Token grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-28 gap-3 text-gray-600">
          <Loader2 size={20} className="animate-spin text-bnb-yellow/60" />
          <span className="text-sm">Loading tokens from chain…</span>
        </div>
      ) : error ? (
        <div className="py-24 text-center text-red-400/80 text-sm">
          Failed to load tokens. Check your connection.
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center">
          <div className="text-4xl mb-4 opacity-50">🔍</div>
          <p className="text-gray-600 text-sm">No tokens found matching your search.</p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-3 text-sm text-bnb-yellow/60 hover:text-bnb-yellow transition-colors">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((token) => (
              <TokenCard key={token.address} token={token} />
            ))}
          </div>
          <p className="mt-8 text-center text-[11px] text-gray-700">
            Showing {filtered.length} of {tokens.length} tokens
          </p>
        </>
      )}
    </section>
  );
}
