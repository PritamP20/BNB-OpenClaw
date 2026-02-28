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

const TYPE_FILTERS: { key: TokenTypeFilter; label: string; Icon: React.ElementType; accentColor: string }[] = [
    { key: "all",    label: "All",       Icon: Rocket, accentColor: "#F5C220" },
    { key: "agent",  label: "AI Agents", Icon: Bot,    accentColor: "#1B4EF8" },
    { key: "normal", label: "Tokens",    Icon: Coins,  accentColor: "#F5C220" },
    { key: "skill",  label: "Skills",    Icon: Puzzle, accentColor: "#D62828" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "marketCap",      label: "Market Cap" },
    { key: "volume24h",      label: "24h Volume" },
    { key: "priceChange24h", label: "24h Change" },
    { key: "reputationScore",label: "Reputation" },
    { key: "holders",        label: "Holders"    },
    { key: "createdAt",      label: "Newest"     },
];

const TAGS = [
    { label: "Hot",      emoji: "🔥", filter: (t: Token) => t.priceChange24h > 20 },
    { label: "Graduated",emoji: "🎓", filter: (t: Token) => t.isGraduated },
    { label: "Top Rep",  emoji: "⭐", filter: (t: Token) => t.reputationScore >= 75 },
    { label: "New",      emoji: "🆕", filter: (t: Token) => Date.now() - t.createdAt < 7 * 86400000 },
];

// ── Hero stat strip ───────────────────────────────────────────────────────────

function ExploreHero({ total, agents, tokens, skills }: {
    total: number; agents: number; tokens: number; skills: number;
}) {
    return (
        <div className="relative pb-8 pt-10" style={{ borderBottom: "1px solid #222222" }}>
            <div className="mx-auto max-w-7xl px-4">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        {/* Live badge */}
                        <div
                            className="mb-3 inline-flex items-center gap-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                            style={{ background: "#F5C220", color: "#0F0F0F" }}
                        >
                            <span className="h-1.5 w-1.5" style={{ background: "#0F0F0F" }} />
                            Live · BNB Chain Testnet
                        </div>
                        <h1 className="text-3xl font-black tracking-tight uppercase md:text-4xl" style={{ color: "#F5F5F5", letterSpacing: "-0.02em" }}>
                            Explore <span style={{ color: "#F5C220" }}>Tokens</span>
                        </h1>
                        <p className="mt-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: "#555555" }}>
                            Browse all AI agents, tokens, and skill modules launching on BNB Chain.
                        </p>
                    </div>
                    <Link
                        href="/launch"
                        className="btn-neon flex items-center gap-2 px-5 py-3 text-xs"
                    >
                        <Rocket size={13} /> Launch Token
                    </Link>
                </div>

                {/* Stat cards — Bauhaus grid blocks */}
                <div className="grid grid-cols-2 gap-0 sm:grid-cols-4" style={{ border: "1px solid #222222" }}>
                    {[
                        { label: "Total Listed",  value: total,  Icon: Star,   accentColor: "#F5C220" },
                        { label: "AI Agents",     value: agents, Icon: Bot,    accentColor: "#1B4EF8" },
                        { label: "Tokens",        value: tokens, Icon: Coins,  accentColor: "#F5C220" },
                        { label: "Skill Modules", value: skills, Icon: Puzzle, accentColor: "#D62828" },
                    ].map(({ label, value, Icon, accentColor }, i) => (
                        <div
                            key={label}
                            className="flex items-center gap-3 px-5 py-4 transition-colors"
                            style={{
                                borderRight: i < 3 ? "1px solid #222222" : "none",
                                borderLeft: `3px solid ${accentColor}`,
                                background: "#111111",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#1A1A1A"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "#111111"; }}
                        >
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center" style={{ background: "#222222" }}>
                                <Icon size={16} style={{ color: accentColor }} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#555555" }}>{label}</p>
                                <p className="text-xl font-black" style={{ color: "#F5F5F5" }}>{value.toLocaleString()}</p>
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
                className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
                style={{ background: "#1A1A1A", border: "1px solid #333333", color: "#888888" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#F5C220"; e.currentTarget.style.color = "#F5F5F5"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#333333"; e.currentTarget.style.color = "#888888"; }}
            >
                <ArrowUpDown size={12} />
                {label}
                <span className="text-[10px]">{dir === "desc" ? "↓" : "↑"}</span>
                <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44" style={{ background: "#1A1A1A", border: "1px solid #333333" }}>
                    {SORT_OPTIONS.map((o) => (
                        <button
                            key={o.key}
                            onClick={() => {
                                const newDir = o.key === sort ? (dir === "desc" ? "asc" : "desc") : "desc";
                                onChange(o.key, newDir);
                                setOpen(false);
                            }}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
                            style={{
                                color: sort === o.key ? "#F5C220" : "#888888",
                                borderLeft: sort === o.key ? "2px solid #F5C220" : "2px solid transparent",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#222222"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                            {o.label}
                            {sort === o.key && <span className="text-[10px]">{dir === "desc" ? "↓" : "↑"}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Token row (list view variant) ─────────────────────────────────────────────

const TYPE_CFG = {
    agent:  { Icon: Bot,    color: "#1B4EF8", label: "Agent" },
    normal: { Icon: Coins,  color: "#F5C220", label: "Token" },
    skill:  { Icon: Puzzle, color: "#D62828", label: "Skill" },
};

const AVATARS: Record<Token["type"], string[]> = {
    agent:  ["🤖", "🧠", "⚡", "🔮", "🎯", "🚀"],
    normal: ["🟡", "💎", "🔥", "🌕", "⭐", "🦁"],
    skill:  ["🔧", "⚙️", "🔬", "📡", "🧩", "💡"],
};

function TokenRow({ token, rank }: { token: Token; rank: number }) {
    const cfg = TYPE_CFG[token.type];
    const isUp = token.priceChange24h >= 0;
    const emoji = AVATARS[token.type][(token.name.charCodeAt(0) || 0) % 6];

    return (
        <Link href={`/token/${token.address}`}>
            <div
                className="grid grid-cols-[32px_1fr_100px_100px_90px_90px_80px] items-center gap-4 px-4 py-3 transition-colors"
                style={{ borderBottom: "1px solid #222222" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#1A1A1A"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
                {/* Rank */}
                <span className="text-center text-xs font-black" style={{ color: "#444444" }}>{rank}</span>

                {/* Name */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-lg" style={{ background: "#222222" }}>
                        {emoji}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold" style={{ color: "#F5F5F5" }}>{token.name}</p>
                        <p className="text-xs font-mono" style={{ color: "#555555" }}>${token.symbol}</p>
                    </div>
                    <span
                        className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                        style={{ background: "#222222", border: `1px solid ${cfg.color}`, color: cfg.color }}
                    >
                        <cfg.Icon size={9} />{cfg.label}
                    </span>
                </div>

                {/* Market Cap */}
                <span className="text-right font-mono text-sm font-bold" style={{ color: "#F5F5F5" }}>{formatUSD(token.marketCap)}</span>

                {/* Volume */}
                <span className="text-right font-mono text-sm" style={{ color: "#888888" }}>{formatUSD(token.volume24h)}</span>

                {/* 24h change */}
                <span className="flex items-center justify-end gap-0.5 text-sm font-bold" style={{ color: isUp ? "#4ade80" : "#D62828" }}>
                    {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {isUp ? "+" : ""}{token.priceChange24h.toFixed(1)}%
                </span>

                {/* Rep */}
                <span
                    className="text-right text-sm font-mono font-bold"
                    style={{ color: token.reputationScore >= 75 ? "#4ade80" : token.reputationScore >= 50 ? "#F5C220" : "#D62828" }}
                >
                    {token.reputationScore}
                </span>

                {/* Progress */}
                <div className="flex flex-col items-end gap-1">
                    <div className="h-1 w-full bh-progress-track">
                        <div
                            className="h-full"
                            style={{
                                width: `${token.graduationProgress}%`,
                                background: token.isGraduated ? "#4ade80" : "#F5C220",
                            }}
                        />
                    </div>
                    <span className="text-[9px] font-bold" style={{ color: "#444444" }}>{token.graduationProgress}%</span>
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
        <div className="min-h-screen" style={{ background: "#0F0F0F" }}>
            <ExploreHero {...counts} />

            <div className="mx-auto max-w-7xl px-4 py-8">

                {/* ── Controls bar ─────────────────────────────────────────────────── */}
                <div className="mb-6 flex flex-col gap-4">

                    {/* Type filter — flat button strip */}
                    <div className="flex flex-wrap gap-0" style={{ border: "1px solid #333333", width: "fit-content" }}>
                        {TYPE_FILTERS.map(({ key, label, Icon, accentColor }) => (
                            <button
                                key={key}
                                onClick={() => setTypeFilter(key)}
                                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
                                style={{
                                    background: typeFilter === key ? accentColor : "#1A1A1A",
                                    color: typeFilter === key ? "#0F0F0F" : "#888888",
                                    borderRight: "1px solid #333333",
                                }}
                            >
                                <Icon size={12} />
                                {label}
                                <span className="text-[9px] opacity-70">
                                    ({key === "all" ? counts.total : key === "agent" ? counts.agents : key === "normal" ? counts.tokens : counts.skills})
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search + sort row */}
                    <div className="flex flex-wrap gap-3">
                        {/* Search */}
                        <div className="relative min-w-[200px] flex-1">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#555555" }} />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name, symbol, or description…"
                                className="w-full py-2.5 pl-9 pr-4 text-sm outline-none"
                                style={{
                                    background: "#1A1A1A",
                                    border: "1px solid #333333",
                                    color: "#F5F5F5",
                                }}
                                onFocus={e => { e.currentTarget.style.borderColor = "#F5C220"; }}
                                onBlur={e => { e.currentTarget.style.borderColor = "#333333"; }}
                            />
                            {query && (
                                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#555555" }}>
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Graduated toggle */}
                        <button
                            onClick={() => setGraduated(graduated === true ? null : true)}
                            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
                            style={{
                                background: graduated === true ? "#4ade80" : "#1A1A1A",
                                border: `1px solid ${graduated === true ? "#4ade80" : "#333333"}`,
                                color: graduated === true ? "#0F0F0F" : "#888888",
                            }}
                        >
                            <Trophy size={12} /> Graduated
                        </button>

                        {/* Sort */}
                        <SortDropdown sort={sort} dir={sortDir} onChange={(k, d) => { setSort(k); setSortDir(d); }} />

                        {/* View toggle */}
                        <div className="flex" style={{ border: "1px solid #333333" }}>
                            {(["grid", "list"] as ViewMode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setViewMode(m)}
                                    className="px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
                                    style={{
                                        background: viewMode === m ? "#F5C220" : "#1A1A1A",
                                        color: viewMode === m ? "#0F0F0F" : "#555555",
                                        borderRight: m === "grid" ? "1px solid #333333" : "none",
                                    }}
                                >
                                    {m === "grid" ? "⊞ Grid" : "☰ List"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick tag strip */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest" style={{ color: "#444444" }}>
                            <SlidersHorizontal size={10} /> Filters:
                        </span>
                        {TAGS.map(({ label, emoji }, i) => (
                            <button
                                key={label}
                                onClick={() => setActiveTag(activeTag === i ? null : i)}
                                className="flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all"
                                style={{
                                    background: activeTag === i ? "#F5C220" : "#1A1A1A",
                                    border: `1px solid ${activeTag === i ? "#F5C220" : "#333333"}`,
                                    color: activeTag === i ? "#0F0F0F" : "#888888",
                                }}
                            >
                                {emoji} {label}
                            </button>
                        ))}
                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-wider"
                                style={{ border: "1px solid #D62828", color: "#D62828", background: "transparent" }}
                            >
                                <X size={9} /> Clear all
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Results summary ───────────────────────────────────────────────── */}
                <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#555555" }}>
                        Showing <span style={{ color: "#F5F5F5" }}>{filtered.length}</span> of{" "}
                        <span style={{ color: "#F5F5F5" }}>{counts.total}</span> tokens
                    </p>
                    {sort === "priceChange24h" && (
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#555555" }}>
                            <Flame size={10} style={{ color: "#D62828" }} /> Sorted by momentum
                        </div>
                    )}
                    {sort === "reputationScore" && (
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#555555" }}>
                            <Zap size={10} style={{ color: "#F5C220" }} /> Sorted by reputation
                        </div>
                    )}
                </div>

                {/* ── Token grid / list ──────────────────────────────────────────────── */}
                {filtered.length === 0 ? (
                    <div
                        className="flex flex-col items-center justify-center py-20 text-center"
                        style={{ background: "#1A1A1A", border: "1px solid #333333" }}
                    >
                        <div className="mb-4 text-4xl">—</div>
                        <p className="text-base font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>No tokens found</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wider" style={{ color: "#555555" }}>
                            Try adjusting your filters or search query.
                        </p>
                        <button
                            onClick={clearFilters}
                            className="btn-outline-neon mt-5 px-5 py-2 text-xs"
                        >
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
                    <div style={{ background: "#111111", border: "1px solid #333333" }}>
                        {/* List header */}
                        <div
                            className="grid grid-cols-[32px_1fr_100px_100px_90px_90px_80px] items-center gap-4 px-4 py-3 text-[9px] font-black uppercase tracking-widest"
                            style={{ background: "#1A1A1A", borderBottom: "1px solid #333333", color: "#555555" }}
                        >
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
