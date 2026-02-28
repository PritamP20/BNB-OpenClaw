import Link from "next/link";
import { Rocket, ChevronRight, Bot, Coins, Puzzle, Zap, Shield, TrendingUp } from "lucide-react";
import { StatsBar } from "../components/StatsBar";
import { TrendingFeed } from "../components/TrendingFeed";
import { ParticleBg } from "../components/ParticleBg";

function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-16 pt-20 text-center">
      {/* Particle / orb background layer */}
      <ParticleBg />

      {/* Content sits above particles */}
      <div className="relative z-10 mx-auto max-w-4xl px-4">

        {/* Live badge */}
        <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-bnb-yellow/30 bg-bnb-yellow/8 px-5 py-2 text-sm font-medium text-bnb-yellow shadow-glow-sm"
          style={{ background: "rgba(243,186,47,0.06)" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bnb-yellow opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-bnb-yellow" />
          </span>
          Live on BNB Chain Testnet
          <span className="rounded-full bg-bnb-yellow/20 px-2 py-0.5 text-xs font-bold">BETA</span>
        </div>

        {/* Main heading */}
        <h1
          className="mb-6 text-5xl font-extrabold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="text-white">Launch Your</span>
          <br />
          <span className="shimmer-text">Token on BNB Chain</span>
        </h1>

        <p
          className="mb-10 mx-auto max-w-2xl text-base text-gray-400 md:text-lg leading-relaxed animate-slide-up"
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
            className="btn-neon flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-base"
          >
            <Rocket size={18} />
            Create Token
          </Link>
          <Link
            href="/explore"
            className="btn-outline-neon flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-base font-semibold"
          >
            Explore Tokens
            <ChevronRight size={16} />
          </Link>
        </div>

        {/* Feature pills */}
        <div
          className="mt-14 flex flex-wrap items-center justify-center gap-3 animate-slide-up"
          style={{ animationDelay: "0.4s" }}
        >
          {[
            { icon: Bot,       label: "AI Agents",        desc: "NFA-grade AI", color: "text-purple-400 border-purple-400/25 bg-purple-400/8" },
            { icon: Coins,     label: "Fair-launch",       desc: "Bonding curves", color: "text-bnb-yellow border-bnb-yellow/25 bg-bnb-yellow/8" },
            { icon: Puzzle,    label: "Skill Tokens",      desc: "Modular AI", color: "text-green-400 border-green-400/25 bg-green-400/8" },
            { icon: Shield,    label: "Reputation",        desc: "On-chain trust", color: "text-blue-400 border-blue-400/25 bg-blue-400/8" },
            { icon: TrendingUp,label: "Auto-DEX listing",  desc: "Uniswap V3", color: "text-cyan-400 border-cyan-400/25 bg-cyan-400/8" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div
              key={label}
              className={`flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm transition-all hover:scale-105 ${color}`}
              style={{ backdropFilter: "blur(8px)" }}
            >
              <Icon size={14} />
              <span className="font-medium">{label}</span>
              <span className="text-gray-500 text-xs hidden sm:inline">· {desc}</span>
            </div>
          ))}
        </div>

        {/* Decorative horizontal rule */}
        <div className="mt-14 flex items-center justify-center gap-4">
          <div className="h-px flex-1 max-w-32" style={{ background: "linear-gradient(90deg, transparent, rgba(243,186,47,0.3))" }} />
          <Zap size={14} className="text-bnb-yellow/50" />
          <div className="h-px flex-1 max-w-32" style={{ background: "linear-gradient(90deg, rgba(243,186,47,0.3), transparent)" }} />
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
    </>
  );
}

