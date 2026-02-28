import Link from "next/link";
import { Rocket, ChevronRight, Bot, Coins, Puzzle, Zap, Shield, TrendingUp } from "lucide-react";
import { StatsBar } from "../components/StatsBar";
import { TrendingFeed } from "../components/TrendingFeed";
import { ParticleBg } from "../components/ParticleBg";

function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-16 pt-20" style={{ borderBottom: "1px solid #333333" }}>
      <ParticleBg />

      <div className="relative z-10 mx-auto max-w-4xl px-4">

        {/* Live badge — flat rectangular */}
        <div
          className="mb-8 inline-flex items-center gap-2.5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
          style={{ background: "#F5C220", color: "#0F0F0F" }}
        >
          <span className="h-1.5 w-1.5" style={{ background: "#0F0F0F" }} />
          Live on BNB Chain Testnet
          <span
            className="px-1.5 py-0.5 text-[10px] font-black"
            style={{ background: "#0F0F0F", color: "#F5C220" }}
          >
            BETA
          </span>
        </div>

        {/* Main heading */}
        <h1
          className="mb-6 text-5xl font-black leading-[1.05] tracking-tight md:text-6xl lg:text-7xl animate-slide-up"
          style={{ animationDelay: "0.1s", letterSpacing: "-0.02em" }}
        >
          <span style={{ color: "#F5F5F5" }}>Launch Your</span>
          <br />
          <span style={{ color: "#F5C220" }}>Token on BNB Chain</span>
        </h1>

        <p
          className="mb-10 mx-auto max-w-2xl text-base leading-relaxed animate-slide-up"
          style={{ animationDelay: "0.2s", color: "#888888" }}
        >
          The most powerful AI-native token launchpad. Deploy agents, tokens, and skill modules
          with built-in bonding curves, reputation scoring, and DeFi growth tools.
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-wrap items-center gap-4 animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          <Link
            href="/launch"
            className="btn-neon flex items-center gap-2.5 px-8 py-3.5 text-sm"
          >
            <Rocket size={16} />
            Create Token
          </Link>
          <Link
            href="/explore"
            className="btn-outline-neon flex items-center gap-2.5 px-8 py-3.5 text-sm"
          >
            Explore Tokens
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Feature pills — flat rectangles */}
        <div
          className="mt-14 flex flex-wrap items-center gap-3 animate-slide-up"
          style={{ animationDelay: "0.4s" }}
        >
          {[
            { icon: Bot,       label: "AI Agents",       accentColor: "#1B4EF8" },
            { icon: Coins,     label: "Fair-launch",      accentColor: "#F5C220" },
            { icon: Puzzle,    label: "Skill Tokens",     accentColor: "#D62828" },
            { icon: Shield,    label: "Reputation",       accentColor: "#1B4EF8" },
            { icon: TrendingUp,label: "Auto-DEX listing", accentColor: "#F5C220" },
          ].map(({ icon: Icon, label, accentColor }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
              style={{
                background: "#1A1A1A",
                border: `1px solid #333333`,
                borderLeft: `3px solid ${accentColor}`,
                color: "#F5F5F5",
              }}
            >
              <Icon size={13} style={{ color: accentColor }} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Geometric divider */}
        <div className="mt-14 flex items-center gap-3">
          <div className="h-px flex-1 max-w-24" style={{ background: "#333333" }} />
          <div className="h-2 w-2" style={{ background: "#F5C220" }} />
          <div className="h-px flex-1 max-w-24" style={{ background: "#333333" }} />
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
