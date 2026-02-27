import Link from "next/link";
import { Rocket, ChevronRight, Bot, Coins, Puzzle } from "lucide-react";
import { StatsBar } from "../components/StatsBar";
import { TrendingFeed } from "../components/TrendingFeed";

function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-12 pt-16 text-center">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-64 w-96 rounded-full bg-bnb-yellow/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-bnb-yellow/30 bg-bnb-yellow/10 px-4 py-1.5 text-sm text-bnb-yellow">
          <span className="h-1.5 w-1.5 rounded-full bg-bnb-yellow animate-pulse-slow" />
          Live on BNB Chain Testnet
        </div>

        <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl">
          Launch AI Agents &{" "}
          <span className="text-bnb-yellow">Tokens</span>
          <br />
          on BNB Chain
        </h1>

        <p className="mb-8 text-base text-gray-400 md:text-lg">
          Pump.fun simplicity. BNB Chain power. AI-native infrastructure.
          <br />
          Launch agents, tokens, and skill modules with built-in growth tools.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/launch"
            className="flex items-center gap-2 rounded-xl bg-bnb-yellow px-6 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            <Rocket size={16} />
            Launch a Token
          </Link>
          <Link
            href="/explore"
            className="flex items-center gap-2 rounded-xl border border-bnb-border px-6 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-white/30 hover:text-white"
          >
            Explore Tokens
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {/* Feature pills */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3 px-4">
        {[
          { icon: Bot, label: "AI Agents (NFA)" },
          { icon: Coins, label: "Fair-launch tokens" },
          { icon: Puzzle, label: "Skill marketplace" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-full border border-bnb-border bg-bnb-card px-4 py-2 text-sm text-gray-400"
          >
            <Icon size={14} className="text-bnb-yellow" />
            {label}
          </div>
        ))}
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
