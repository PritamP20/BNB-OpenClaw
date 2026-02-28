"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
    Search, SlidersHorizontal, TrendingUp, TrendingDown,
    Bot, Coins, Puzzle, Flame, Zap, Star, Trophy,
    ChevronDown, X, Rocket, ArrowUpDown,
} from "lucide-react";
import { formatUSD, timeAgo } from "../../lib/mock-data";
import { TokenCard } from "../../components/TokenCard";
import { useTokens, type Token } from "../../hooks/useTokens";

// ── Types ────────────────────────────────────────────────────────────────────

type TokenTypeFilter = "all" | "agent" | "normal" | "skill";
type SortKey = "marketCap" | "volume24h" | "priceChange24h" | "reputationScore" | "createdAt" | "holders";
type SortDir = "asc" | "desc";

// ── Config ───────────────────────────────────────────────────────────────────

const TYPE_FILTERS: { key: TokenTypeFilter; label: string; Icon: React.ElementType; color: string }[] = [
    { key: "all", label: "All", Icon: Rocket, color: "text-bnb-yellow border-bnb-yellow/40 bg-bnb-yellow/10" },
    { key: "agent", label: "AI Agents", Icon: Bot, color: "text-purple-400 border-purple-400/40 bg-purple-400/10" },
    { key: "normal", label: "Tokens", Icon: Coins, color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
    { key: "skill", label: "Skills", Icon: Puzzle, color: "text-green-400 border-green-400/40 bg-green-400/10" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "marketCap", label: "Market Cap" },
    { key: "volume24h", label: "24h Volume" },
    { key: "priceChange24h", label: "24h Change" },
    { key: "reputationScore", label: "Reputation" },
    { key: "holders", label: "Holders" },
    { key: "createdAt", label: "Newest" },
];

const TAGS = [
    { label: "🔥 Hot", filter: (t: Token) => t.priceChange24h > 20 },
    { label: "🎓 Graduated", filter: (t: Token) => t.isGraduated },
    { label: "⭐ Top Rep", filter: (t: Token) => t.reputationScore >= 75 },
    { label: "🆕 New", filter: (t: Token) => Date.now() - t.createdAt < 7 * 86400000 },
];

// ── Hero stat strip ───────────────────────────────────────────────────────────

function ExploreHero({ total, agents, tokens, skills }: {
    total: number; agents: number; tokens: number; skills: number;
}) {
    return (
        <div className="relative overflow-hidden pb-8 pt-10" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {/* Glow */}
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-48 w-[700px] rounded-full blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(243,186,47,0.07) 0%, transparent 70%)" }} />

            <div className="relative mx-auto max-w-7xl px-4">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/[0.06] px-3 py-1 text-xs text-gray-400" style={{ background: "rgba(255,255,255,0.03)" }}>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                            Live · BNB Chain Testnet
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                            Explore <span className="shimmer-text">Tokens</span>
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Browse all AI agents, tokens, and skill modules launching on BNB Chain.
                        </p>
                    </div>
                    <Link
                        href="/launch"
                        className="btn-neon flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm"
                    >
                        <Rocket size={14} /> Launch Token
                    </Link>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                        { label: "Total Listed",  value: total,  icon: Star,   accent: "text-bnb-yellow",  bg: "rgba(255,255,255,0.015)" },
                        { label: "AI Agents",     value: agents, icon: Bot,    accent: "text-purple-400", bg: "rgba(255,255,255,0.015)" },
                        { label: "Tokens",        value: tokens, icon: Coins,  accent: "text-blue-400",   bg: "rgba(255,255,255,0.015)" },
                        { label: "Skill Modules", value: skills, icon: Puzzle, accent: "text-emerald-400",  bg: "rgba(255,255,255,0.015)" },
                    ].map(({ label, value, icon: Icon, accent, bg }) => (
                        <div
                            key={label}
                            className="group relative flex items-center gap-3 rounded-2xl px-4 py-3 transition-all hover:scale-[1.01]"
                            style={{ background: bg, border: "1px solid rgba(255,255,255,0.04)", backdropFilter: "blur(12px)" }}
                        >
                            <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                            <div className={`relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${accent}`} style={{ background: "rgba(255,255,255,0.04)" }}>
                                <Icon size={17} />
                            </div>
                            <div className="relative z-10">
                                <p className="text-[11px] uppercase tracking-wider text-gray-600">{label}</p>
                                <p className="text-lg font-extrabold text-white">{value.toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Sort dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({ sort, dir, onChange }: {
    sort: SortKey; dir: SortDir; onChange: (k: SortKey, d: SortDir) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const label = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Sort";

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-gray-300 transition-all hover:border-white/10 hover:text-white`}
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}
            >
                <ArrowUpDown size={13} className="text-gray-500" />
                {label}
                <span className="text-xs text-gray-600">{dir === "desc" ? "↓" : "↑"}</span>
                <ChevronDown size={13} className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-2xl shadow-xl shadow-black/60 backdrop-blur-xl" style={{ background: "rgba(14,14,20,0.96)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {SORT_OPTIONS.map((o) => (
                        <button
                            key={o.key}
                            onClick={() => {
                                const newDir = o.key === sort ? (dir === "desc" ? "asc" : "desc") : "desc";
                                onChange(o.key, newDir);
                                setOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${sort === o.key ? "text-bnb-yellow" : "text-gray-400"
                                }`}
                        >
                            {o.label}
                            {sort === o.key && <span className="text-xs">{dir === "desc" ? "↓" : "↑"}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Token row (list view variant) ─────────────────────────────────────────────

const TYPE_CFG = {
    agent: { Icon: Bot, color: "text-purple-400", bg: "bg-purple-400/10", label: "Agent" },
    normal: { Icon: Coins, color: "text-blue-400", bg: "bg-blue-400/10", label: "Token" },
    skill: { Icon: Puzzle, color: "text-green-400", bg: "bg-green-400/10", label: "Skill" },
};

const AVATARS: Record<Token["type"], string[]> = {
    agent: ["🤖", "🧠", "⚡", "🔮", "🎯", "🚀"],
    normal: ["🟡", "💎", "🔥", "🌕", "⭐", "🦁"],
    skill: ["🔧", "⚙️", "🔬", "📡", "🧩", "💡"],
};

function TokenRow({ token, rank }: { token: Token; rank: number }) {
    const cfg = TYPE_CFG[token.type];
    const isUp = token.priceChange24h >= 0;
    const emoji = AVATARS[token.type][(token.name.charCodeAt(0) || 0) % 6];

    return (
        <Link href={`/token/${token.address}`}>
            <div
            className={`group grid grid-cols-[32px_1fr_100px_100px_90px_90px_80px] items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.02]`}
            style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                {/* Rank */}
                <span className="text-center text-xs font-semibold text-gray-600">{rank}</span>

                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg">{emoji}</div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white group-hover:text-bnb-yellow transition-colors">{token.name}</p>
                        <p className="text-xs text-gray-600">${token.symbol}</p>
                    </div>
                    <span className={`hidden sm:flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cfg.color} ${cfg.bg} border-current/20`}>
                        <cfg.Icon size={9} />{cfg.label}
                    </span>
                </div>

                {/* Market Cap */}
                <span className="text-right font-mono text-sm text-white">{formatUSD(token.marketCap)}</span>

                {/* Volume */}
                <span className="text-right font-mono text-sm text-gray-400">{formatUSD(token.volume24h)}</span>

                {/* 24h change */}
                <span className={`flex items-center justify-end gap-0.5 text-sm font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
                    {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {isUp ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                </span>

                {/* Rep */}
                <span className={`text-right text-sm font-mono ${token.reputationScore >= 75 ? "text-green-400" : token.reputationScore >= 50 ? "text-bnb-yellow" : "text-red-400"}`}>
                    {token.reputationScore}
                </span>

                {/* Progress bar */}
                <div className="flex flex-col items-end gap-1">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                            className={`h-full rounded-full ${token.isGraduated ? "bg-green-400" : "bg-bnb-yellow"}`}
                            style={{ width: `${token.graduationProgress}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-gray-600">{token.graduationProgress}%</span>
                </div>
            </div>
        </Link>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list";

export function ExploreClient() {
    const { tokens, isLoading, error, refresh } = useTokens();
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<TokenTypeFilter>("all");
    const [sort, setSort] = useState<SortKey>("marketCap");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [activeTag, setActiveTag] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [graduated, setGraduated] = useState<boolean | null>(null);

    // Derived counts
    const counts = useMemo(() => ({
        total: tokens.length,
        agents: tokens.filter((t) => t.type === "agent").length,
        tokens: tokens.filter((t) => t.type === "normal").length,
        skills: tokens.filter((t) => t.type === "skill").length,
    }), [tokens]);

    // Filtered + sorted list
    const filtered = useMemo(() => {
        let list = [...tokens];

        if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
        if (query.trim()) list = list.filter((t) =>
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            t.symbol.toLowerCase().includes(query.toLowerCase()) ||
            t.description.toLowerCase().includes(query.toLowerCase())
        );
        if (activeTag !== null && TAGS[activeTag]) list = list.filter(TAGS[activeTag].filter);
        if (graduated === true) list = list.filter((t) => t.isGraduated);
        if (graduated === false) list = list.filter((t) => !t.isGraduated);

        list.sort((a, b) => {
            const av = a[sort] as number;
            const bv = b[sort] as number;
            return sortDir === "desc" ? bv - av : av - bv;
        });

        return list;
    }, [tokens, typeFilter, query, sort, sortDir, activeTag, graduated]);

    const hasFilters = typeFilter !== "all" || query.trim() || activeTag !== null || graduated !== null;
    const clearFilters = () => {
        setQuery(""); setTypeFilter("all"); setActiveTag(null); setGraduated(null);
    };

    return (
        <div className="min-h-screen">
            <ExploreHero {...counts} />

            <div className="mx-auto max-w-7xl px-4 py-8">

                {/* ── Controls bar ─────────────────────────────────────────────────── */}
                <div className="mb-6 flex flex-col gap-4">

                    {/* Type filter pills */}
                    <div className="flex flex-wrap gap-2">
                        {TYPE_FILTERS.map(({ key, label, Icon, color }) => (
                            <button
                                key={key}
                                onClick={() => setTypeFilter(key)}
                                className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${typeFilter === key
                                    ? color
                                    : "border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300"
                                    }`}
                                style={typeFilter === key ? { boxShadow: "0 0 12px rgba(243,186,47,0.15)" } : {}}
                            >
                                <Icon size={13} />{label}
                                <span className="ml-0.5 text-[11px] opacity-60">
                                    ({key === "all" ? counts.total : key === "agent" ? counts.agents : key === "normal" ? counts.tokens : counts.skills})
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search + sort row */}
                    <div className="flex flex-wrap gap-3">
                        {/* Search */}
                        <div className="relative min-w-[200px] flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name, symbol, or description…"
                                className="w-full rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-white/10"
                                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}
                            />
                            {query && (
                                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Graduated toggle */}
                        <button
                            onClick={() => setGraduated(graduated === true ? null : true)}
                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm transition-all ${graduated === true
                                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                                : "border-white/[0.06] text-gray-500 hover:border-white/10 hover:text-gray-300"
                                }`}
                        >
                            <Trophy size={13} /> Graduated
                        </button>

                        {/* Sort */}
                        <SortDropdown sort={sort} dir={sortDir} onChange={(k, d) => { setSort(k); setSortDir(d); }} />

                        {/* View toggle */}
                        <div
                            className="flex overflow-hidden rounded-xl"
                            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                            {(["grid", "list"] as ViewMode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setViewMode(m)}
                                    className={`px-3 py-2.5 text-xs font-semibold transition-all ${viewMode === m
                                    ? "text-bnb-yellow"
                                    : "text-gray-600 hover:text-gray-400"
                                }`}
                                style={viewMode === m ? { background: "rgba(243,186,47,0.1)" } : {}}>
                                    {m === "grid" ? "⊞ Grid" : "☰ List"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick tag strip */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                            <SlidersHorizontal size={11} /> Quick filters:
                        </span>
                        {TAGS.map(({ label }, i) => (
                            <button
                                key={label}
                                onClick={() => setActiveTag(activeTag === i ? null : i)}
                                className={`rounded-full border px-3 py-1 text-xs transition-all ${activeTag === i
                                    ? "border-bnb-yellow/30 bg-bnb-yellow/10 text-bnb-yellow"
                                    : "border-white/[0.06] text-gray-500 hover:border-white/10 hover:text-gray-300"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 rounded-full border border-red-400/20 px-3 py-1 text-xs text-red-400 transition-colors hover:border-red-400/40"
                            >
                                <X size={10} /> Clear all
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Results summary ───────────────────────────────────────────────── */}
                <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Showing <span className="font-semibold text-white">{filtered.length}</span> of{" "}
                        <span className="font-semibold text-white">{counts.total}</span> tokens
                    </p>
                    {sort === "priceChange24h" && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Flame size={11} className="text-orange-400" /> Sorted by momentum
                        </div>
                    )}
                    {sort === "reputationScore" && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Zap size={11} className="text-bnb-yellow" /> Sorted by reputation
                        </div>
                    )}
                </div>

                {/* ── Token grid / list ──────────────────────────────────────────────── */}
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl py-20 text-center backdrop-blur-xl" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div className="mb-4 text-5xl">🔍</div>
                        <p className="text-lg font-semibold text-white">No tokens found</p>
                        <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search query.</p>
                        <button onClick={clearFilters} className="btn-outline-neon mt-5 rounded-xl px-5 py-2 text-sm transition-colors">
                            Clear filters
                        </button>
                    </div>
                ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filtered.map((token) => (
                            <TokenCard key={token.address} token={token} />
                        ))}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl backdrop-blur-xl" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        {/* List header */}
                        <div className="grid grid-cols-[32px_1fr_100px_100px_90px_90px_80px] items-center gap-4 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <span className="text-center">#</span>
                            <span>Token</span>
                            <span className="text-right">Mkt Cap</span>
                            <span className="text-right">Volume</span>
                            <span className="text-right">24h</span>
                            <span className="text-right">Rep</span>
                            <span className="text-right">Progress</span>
                        </div>
                        {filtered.map((token, i) => (
                            <TokenRow key={token.address} token={token} rank={i + 1} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
