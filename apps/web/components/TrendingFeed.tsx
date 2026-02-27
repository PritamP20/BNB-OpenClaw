"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { TokenCard } from "./TokenCard";
import { useTokens, type Token } from "../hooks/useTokens";

type Filter = "all" | Token["type"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "agent", label: "🤖 Agents" },
  { value: "normal", label: "🟡 Tokens" },
  { value: "skill", label: "🧩 Skills" },
];

type SortKey = "trending" | "new" | "marketcap";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "new", label: "New" },
  { value: "marketcap", label: "Market Cap" },
];

export function TrendingFeed() {
  const { tokens, isLoading, error } = useTokens();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("trending");
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
      if (sort === "new") return b.createdAt - a.createdAt;
      if (sort === "marketcap") return b.marketCap - a.marketCap;
      // trending: weighted by volume + price change
      return (
        b.volume24h * 0.6 + b.priceChange24h * 100 -
        (a.volume24h * 0.6 + a.priceChange24h * 100)
      );
    });

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter tabs */}
        <div className="flex gap-1 rounded-xl border border-bnb-border bg-bnb-card p-1">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filter === value
                  ? "bg-bnb-yellow text-black"
                  : "text-gray-400 hover:text-white"
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <div className="flex gap-1 rounded-xl border border-bnb-border bg-bnb-card p-1">
            {SORTS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSort(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${sort === value
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:text-white"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-xl border border-bnb-border bg-bnb-card pl-8 pr-3 text-sm text-white placeholder-gray-600 outline-none focus:border-bnb-yellow/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-500">
          No tokens found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((token) => (
            <TokenCard key={token.address} token={token} />
          ))}
        </div>
      )}
    </section>
  );
}
