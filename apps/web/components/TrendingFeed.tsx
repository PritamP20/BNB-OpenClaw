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
    <section className="relative mx-auto max-w-7xl px-4 py-10">
      {/* Section header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            Live <span className="shimmer-text">Token Feed</span>
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {tokens.length} token{tokens.length !== 1 ? "s" : ""} on BNB Chain
          </p>
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search tokens…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-56 rounded-xl pl-9 pr-9 text-sm text-white placeholder-gray-600 outline-none transition-all"
            style={{
              background: "rgba(18,18,26,0.9)",
              border: "1px solid rgba(243,186,47,0.15)",
              backdropFilter: "blur(12px)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = "1px solid rgba(243,186,47,0.45)";
              e.currentTarget.style.boxShadow = "0 0 12px rgba(243,186,47,0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid rgba(243,186,47,0.15)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Controls row */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Type filters */}
        <div
          className="flex gap-1 p-1 rounded-2xl"
          style={{ background: "rgba(18,18,26,0.9)", border: "1px solid rgba(243,186,47,0.1)" }}
        >
          {FILTERS.map(({ value, label, icon: Icon, color }) => {
            const active = filter === value;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className="relative flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  background: active ? "rgba(243,186,47,0.12)" : "transparent",
                  color: active ? "#F3BA2F" : "#9ca3af",
                  border: active ? "1px solid rgba(243,186,47,0.3)" : "1px solid transparent",
                  boxShadow: active ? "0 0 12px rgba(243,186,47,0.15)" : "none",
                }}
              >
                <Icon size={13} className={active ? "text-bnb-yellow" : color} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Sort tabs */}
        <div
          className="flex gap-1 p-1 rounded-2xl"
          style={{ background: "rgba(18,18,26,0.9)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {SORTS.map(({ value, label, icon: Icon }) => {
            const active = sort === value;
            return (
              <button
                key={value}
                onClick={() => setSort(value)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                style={{
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  color: active ? "#ffffff" : "#6b7280",
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Token grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
          <Loader2 size={20} className="animate-spin text-bnb-yellow" />
          <span className="text-sm">Loading tokens from chain…</span>
        </div>
      ) : error ? (
        <div className="py-20 text-center text-red-400 text-sm">
          Failed to load tokens. Check your connection.
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-500 text-sm">No tokens found matching your search.</p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-2 text-sm text-bnb-yellow/70 hover:text-bnb-yellow transition-colors">
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
          <p className="mt-6 text-center text-xs text-gray-600">
            Showing {filtered.length} of {tokens.length} tokens
          </p>
        </>
      )}
    </section>
  );
}
