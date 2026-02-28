"use client";

import { useState } from "react";
import { Search, Flame, Clock, TrendingUp, Bot, Coins, Puzzle, Rocket, X } from "lucide-react";
import { TokenCard } from "./TokenCard";
import { useTokens, type Token } from "../hooks/useTokens";
import { Loader2 } from "lucide-react";

type Filter  = "all" | Token["type"];
type SortKey = "trending" | "new" | "marketcap";

const FILTERS: { value: Filter; label: string; icon: React.ElementType; accentColor: string }[] = [
  { value: "all",    label: "All",       icon: Rocket, accentColor: "#F5C220" },
  { value: "agent",  label: "AI Agents", icon: Bot,    accentColor: "#1B4EF8" },
  { value: "normal", label: "Tokens",    icon: Coins,  accentColor: "#F5C220" },
  { value: "skill",  label: "Skills",    icon: Puzzle, accentColor: "#D62828" },
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
        <div className="flex items-center gap-3">
          <div className="h-8 w-1" style={{ background: "#F5C220" }} />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: "#F5F5F5" }}>
              Live Token Feed
            </h2>
            <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: "#555555" }}>
              {tokens.length} token{tokens.length !== 1 ? "s" : ""} on BNB Chain
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#555555" }} />
          <input
            type="text"
            placeholder="Search tokens…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-56 pl-9 pr-9 text-sm outline-none"
            style={{
              background: "#1A1A1A",
              border: "1px solid #333333",
              color: "#F5F5F5",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#F5C220"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#333333"; }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: "#555555" }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Controls row */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Type filters — flat rectangular buttons */}
        <div className="flex" style={{ border: "1px solid #333333" }}>
          {FILTERS.map(({ value, label, icon: Icon, accentColor }) => {
            const active = filter === value;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
                style={{
                  background: active ? accentColor : "#1A1A1A",
                  color: active ? "#0F0F0F" : "#888888",
                  borderRight: "1px solid #333333",
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Sort tabs */}
        <div className="flex" style={{ border: "1px solid #333333" }}>
          {SORTS.map(({ value, label, icon: Icon }) => {
            const active = sort === value;
            return (
              <button
                key={value}
                onClick={() => setSort(value)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
                style={{
                  background: active ? "#222222" : "#1A1A1A",
                  color: active ? "#F5F5F5" : "#555555",
                  borderRight: "1px solid #333333",
                  borderBottom: active ? "2px solid #F5C220" : "2px solid transparent",
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
        <div className="flex items-center justify-center py-24 gap-3" style={{ color: "#555555" }}>
          <Loader2 size={18} className="animate-spin" style={{ color: "#F5C220" }} />
          <span className="text-sm font-bold uppercase tracking-wider">Loading tokens from chain…</span>
        </div>
      ) : error ? (
        <div className="py-20 text-center text-sm font-bold uppercase tracking-wider" style={{ color: "#D62828" }}>
          Failed to load tokens. Check your connection.
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center" style={{ border: "1px solid #222222", background: "#1A1A1A" }}>
          <div className="text-4xl mb-4">—</div>
          <p className="text-sm font-bold uppercase tracking-wider" style={{ color: "#555555" }}>No tokens found matching your search.</p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-4 text-xs font-black uppercase tracking-wider transition-colors"
              style={{ color: "#F5C220", borderBottom: "1px solid #F5C220", paddingBottom: "1px" }}
            >
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
          <p className="mt-6 text-center text-xs font-bold uppercase tracking-wider" style={{ color: "#444444" }}>
            Showing {filtered.length} of {tokens.length} tokens
          </p>
        </>
      )}
    </section>
  );
}
