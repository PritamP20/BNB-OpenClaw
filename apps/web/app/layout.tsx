import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { Providers } from "../providers";
import { Navbar } from "../components/Navbar";
import { Zap, Github, ExternalLink } from "lucide-react";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "AgentLaunch — AI Token Launchpad on BNB Chain",
  description:
    "Launch AI agents, fungible tokens, and skill tokens on BNB Chain. Progressive liquidity, reputation scoring, and built-in growth tools.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-bnb-dark font-sans text-white antialiased selection:bg-bnb-yellow/20 selection:text-bnb-yellow`}
        style={{ background: "#060608" }}
      >
        <Providers>
          <Navbar />
          <main className="relative">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}

// ── Site Footer ───────────────────────────────────────────────────────────────

function SiteFooter() {
  return (
    <footer className="relative mt-16 border-t border-white/[0.04]" style={{ background: "rgba(255,255,255,0.01)" }}>
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-bnb-yellow/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="mb-4 inline-flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bnb-yellow/15 border border-bnb-yellow/20">
                <Zap size={13} className="text-bnb-yellow" />
              </div>
              <span className="font-extrabold text-white tracking-tight">AgentLaunch</span>
            </Link>
            <p className="text-sm text-gray-600 leading-relaxed max-w-[220px]">
              The AI-native token launchpad on BNB Chain. Bonding curves, progressive liquidity, and on-chain AI agents.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]" />
              <span className="text-[12px] text-gray-600">Live on BSC Testnet</span>
            </div>
            <div className="mt-4 flex gap-2">
              <a
                href="https://github.com"
                target="_blank" rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] text-gray-600 transition-colors hover:border-white/[0.1] hover:text-gray-400"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <Github size={14} />
              </a>
              <a
                href="https://testnet.bscscan.com"
                target="_blank" rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] text-gray-600 transition-colors hover:border-white/[0.1] hover:text-gray-400"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Platform links */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gray-600">Platform</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Launch Token",   href: "/launch"  },
                { label: "Explore Tokens", href: "/explore" },
                { label: "Chat with Agent",href: "/chat"    },
                { label: "SDK & API Docs", href: "/sdk"     },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-gray-500 transition-colors hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Technology */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gray-600">Technology</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Bonding Curves",          desc: "xy = k price discovery" },
                { label: "Progressive Liquidity",   desc: "Time & milestone unlock" },
                { label: "Dynamic AMM Config",      desc: "Per-pool fee & curve model" },
                { label: "Token-Gated AI",           desc: "Dockerised agents on-chain" },
              ].map(({ label, desc }) => (
                <li key={label}>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-[11px] text-gray-700">{desc}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Status */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gray-600">Roadmap</p>
            <ul className="flex flex-col gap-3">
              {[
                { label: "Token factory & bonding curve",  done: true  },
                { label: "AI Agent & NFA identity",        done: true  },
                { label: "Skill token modules",            done: true  },
                { label: "PLU vaults (time-based)",        done: true  },
                { label: "DAMM config registry",           done: true  },
                { label: "DEX oracle conditions (vol / holders)", done: false },
                { label: "PancakeSwap auto-LP migration",  done: false },
              ].map(({ label, done }) => (
                <li key={label} className="flex items-center gap-2 text-[12px]">
                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${done ? "bg-emerald-400" : "bg-gray-700"}`} />
                  <span className={done ? "text-gray-500" : "text-gray-700"}>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.03] pt-6 text-[12px] text-gray-700">
          <span>© {new Date().getFullYear()} AgentLaunch. Built on BNB Chain.</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-gray-700" />
            Contracts on{" "}
            <a
              href="https://testnet.bscscan.com"
              target="_blank" rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              BSC Testnet ↗
            </a>
            <span className="h-1 w-1 rounded-full bg-gray-700" />
            Not audited — use at your own risk
          </span>
        </div>
      </div>
    </footer>
  );
}
