import React from "react";
import Link from "next/link";
import {
  Rocket, ChevronRight, Bot, Coins, Puzzle, Zap, Shield, TrendingUp,
  Lock, Unlock, BarChart3, Layers, ArrowRight, CheckCircle2,
} from "lucide-react";
import { StatsBar } from "../components/StatsBar";
import { TrendingFeed } from "../components/TrendingFeed";
import { ParticleBg } from "../components/ParticleBg";

function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-20 pt-24 text-center">
      {/* Particle / orb background layer */}
      <ParticleBg />

      {/* Content sits above particles */}
      <div className="relative z-10 mx-auto max-w-4xl px-5">

        {/* Live badge */}
        <div className="mb-10 inline-flex items-center gap-2.5 rounded-full border border-white/[0.06] px-5 py-2 text-[13px] font-medium text-gray-400 shadow-[0_2px_20px_rgba(0,0,0,0.3)]"
          style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          </span>
          <span className="text-gray-300">Live on BNB Chain Testnet</span>
          <span className="rounded-full bg-bnb-yellow/15 border border-bnb-yellow/20 px-2.5 py-0.5 text-[10px] font-bold text-bnb-yellow tracking-wider">BETA</span>
        </div>

        {/* Main heading */}
        <h1
          className="mb-7 text-5xl font-extrabold leading-[1.08] tracking-[-0.03em] md:text-6xl lg:text-[72px] animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="text-white">Launch Your</span>
          <br />
          <span className="shimmer-text">Token on BNB Chain</span>
        </h1>

        <p
          className="mb-12 mx-auto max-w-xl text-[15px] text-gray-500 md:text-base leading-relaxed animate-slide-up tracking-[-0.01em]"
          style={{ animationDelay: "0.2s" }}
        >
          The most powerful AI-native token launchpad. Deploy agents, tokens, and skill modules
          with built-in bonding curves, reputation scoring, and DeFi growth tools.
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-wrap items-center justify-center gap-4 animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          <Link
            href="/launch"
            className="btn-neon flex items-center gap-2.5 rounded-2xl px-9 py-3.5 text-[15px]"
          >
            <Rocket size={17} />
            Create Token
          </Link>
          <Link
            href="/explore"
            className="btn-outline-neon flex items-center gap-2.5 rounded-2xl px-9 py-3.5 text-[15px] font-semibold"
          >
            Explore Tokens
            <ChevronRight size={15} />
          </Link>
        </div>

        {/* Feature pills */}
        <div
          className="mt-16 flex flex-wrap items-center justify-center gap-2.5 animate-slide-up"
          style={{ animationDelay: "0.4s" }}
        >
          {[
            { icon: Bot,       label: "AI Agents",        desc: "NFA-grade AI", color: "text-purple-400 border-purple-500/15 bg-purple-500/[0.06]" },
            { icon: Coins,     label: "Fair-launch",       desc: "Bonding curves", color: "text-bnb-yellow border-bnb-yellow/15 bg-bnb-yellow/[0.06]" },
            { icon: Puzzle,    label: "Skill Tokens",      desc: "Modular AI", color: "text-emerald-400 border-emerald-500/15 bg-emerald-500/[0.06]" },
            { icon: Shield,    label: "Reputation",        desc: "On-chain trust", color: "text-blue-400 border-blue-500/15 bg-blue-500/[0.06]" },
            { icon: TrendingUp,label: "Auto-DEX listing",  desc: "Uniswap V3", color: "text-cyan-400 border-cyan-500/15 bg-cyan-500/[0.06]" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] transition-all duration-300 hover:scale-[1.03] ${color}`}
              style={{ backdropFilter: "blur(8px)" }}
            >
              <Icon size={13} />
              <span className="font-semibold">{label}</span>
              <span className="text-gray-600 text-[11px] hidden sm:inline">· {desc}</span>
            </div>
          ))}
        </div>

        {/* Decorative horizontal rule */}
        <div className="mt-16 flex items-center justify-center gap-4">
          <div className="h-px flex-1 max-w-40" style={{ background: "linear-gradient(90deg, transparent, rgba(243,186,47,0.2))" }} />
          <Zap size={12} className="text-bnb-yellow/40" />
          <div className="h-px flex-1 max-w-40" style={{ background: "linear-gradient(90deg, rgba(243,186,47,0.2), transparent)" }} />
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <StatsBar />
      <TrendingFeed />
      <FeaturesSection />
    </>
  );
}

// ── Features Section ──────────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <section className="relative py-20">
      {/* Subtle grid pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative mx-auto max-w-7xl px-5">

        {/* Section header */}
        <div className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.06] px-4 py-1.5 text-[12px] font-medium text-gray-500"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <Zap size={11} className="text-bnb-yellow" />
            How AgentLaunch Works
          </div>
          <h2 className="text-3xl font-extrabold tracking-[-0.03em] text-white md:text-4xl">
            Built different.<br />
            <span className="shimmer-text">Designed for AI-native tokens.</span>
          </h2>
          <p className="mt-4 mx-auto max-w-lg text-sm text-gray-500 leading-relaxed">
            Every token launched here benefits from a battle-tested DeFi stack — bonding curves, programmable liquidity release, and per-pool AMM configuration.
          </p>
        </div>

        {/* Feature cards — 2 × 2 grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

          {/* Card 1 — Bonding Curve */}
          <FeatureCard
            icon={TrendingUp}
            iconColor="text-bnb-yellow"
            iconBg="bg-bnb-yellow/[0.07] border-bnb-yellow/15"
            accentFrom="from-bnb-yellow/40"
            badge="Live"
            badgeColor="text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.06]"
            title="pump.fun-style Bonding Curve"
            description="Every token trades on an xy = k constant-product curve with a virtual BNB reserve — no upfront liquidity required. Price rises as demand grows. When real BNB raised hits the graduation target, trading automatically migrates to PancakeSwap."
            points={[
              "Virtual reserve sets initial price without real BNB deposit",
              "Buy & sell formulas: tokenOut = tokensLeft × bnbIn / (effectiveBNB + bnbIn)",
              "Configurable fee (up to 5%), forwarded to platform",
              "Auto-graduates to DEX at your chosen BNB milestone",
            ]}
            cta={{ label: "Launch a Token", href: "/launch" }}
          />

          {/* Card 2 — PLU */}
          <FeatureCard
            icon={Unlock}
            iconColor="text-purple-400"
            iconBg="bg-purple-500/[0.07] border-purple-500/15"
            accentFrom="from-purple-500/40"
            badge="Phase 2"
            badgeColor="text-purple-400 border-purple-500/20 bg-purple-500/[0.06]"
            title="Progressive Liquidity Unlock"
            description="Lock LP or team tokens in on-chain vaults split into up to 50 tranches. Each tranche unlocks independently based on its own condition — no rug-pull possible once releasing has begun."
            points={[
              "Time-based unlock: each tranche releases after a set timestamp",
              "Volume milestone unlock (Phase 3 — requires DEX oracle)",
              "Holder-count & agent-activity conditions scaffolded",
              "cancelVault() only permitted if zero tranches released yet",
            ]}
            cta={{ label: "Read the SDK Docs", href: "/sdk" }}
          />

          {/* Card 3 — DAMM */}
          <FeatureCard
            icon={BarChart3}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/[0.07] border-blue-500/15"
            accentFrom="from-blue-500/40"
            badge="Phase 3"
            badgeColor="text-blue-400 border-blue-500/20 bg-blue-500/[0.06]"
            title="Dynamic AMM Configuration"
            description="Every post-graduation pool is governed by a per-token AMMConfig: choose your fee tier, enable dynamic fee adjustment, set whale-size limits, and even swap out the underlying price curve model."
            points={[
              "4 curve models: Linear, BondingCurve (k·supply²), Exponential, Flat",
              "Dynamic fees — auto-adjust based on volatility & volume",
              "Anti-whale gates: maxBuyBps / maxSellBps per transaction",
              "Token creators assigned as pool configurors, not just platform admins",
            ]}
            cta={{ label: "View Contracts", href: "/sdk" }}
          />

          {/* Card 4 — AI Agents */}
          <FeatureCard
            icon={Bot}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/[0.07] border-emerald-500/15"
            accentFrom="from-emerald-500/40"
            badge="Live"
            badgeColor="text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.06]"
            title="Token-Gated AI Agents"
            description="Deploy any AI as a Dockerfile, pair it with an on-chain NFA identity token, and open a bonding-curve market. Only wallets holding your token can call the agent API — your community becomes your access list."
            points={[
              "Docker container deployed & managed by CreateOS",
              "NFA (Non-Fungible Agent) identity minted on-chain",
              "Skill modules: composable pay-per-use ERC-20 extensions",
              "ECDSA wallet-signature auth — no centralised API keys",
            ]}
            cta={{ label: "Launch an Agent", href: "/launch" }}
          />

        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  iconColor,
  iconBg,
  accentFrom,
  badge,
  badgeColor,
  title,
  description,
  points,
  cta,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  accentFrom: string;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  points: string[];
  cta: { label: string; href: string };
}) {
  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-2px]"
      style={{
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 2px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentFrom} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      {/* Icon + badge row */}
      <div className="mb-5 flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeColor}`}>
          {badge}
        </span>
      </div>

      {/* Title + description */}
      <h3 className="mb-2 text-[17px] font-bold leading-snug text-white">{title}</h3>
      <p className="mb-5 text-sm text-gray-500 leading-relaxed">{description}</p>

      {/* Bullet points */}
      <ul className="mb-6 flex flex-col gap-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[13px] text-gray-400">
            <CheckCircle2 size={13} className={`mt-0.5 flex-shrink-0 ${iconColor}`} />
            {p}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-auto">
        <Link
          href={cta.href}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-all ${iconColor} hover:gap-3`}
        >
          {cta.label} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

