"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";

declare global {
  interface Window { ethereum?: unknown }
}
import { injected } from "wagmi/connectors";
import { bscTestnet } from "wagmi/chains";
import {
  Zap, Rocket, BarChart2, Menu, X,
  AlertTriangle, Loader2, ChevronDown, MessageSquare,
  Wallet, Code2,
} from "lucide-react";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/",       label: "Explore", icon: BarChart2     },
  { href: "/launch", label: "Launch",  icon: Rocket        },
  { href: "/chat",   label: "Chat",    icon: MessageSquare },
  { href: "/sdk",    label: "SDK",     icon: Code2         },
];

export function Navbar() {
  const pathname   = usePathname();
  const { address, isConnected } = useAccount();
  const { connect, isPending, error: connectError, reset } = useConnect();
  const { disconnect }  = useDisconnect();
  const chainId         = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [hasInjected,  setHasInjected]  = useState<boolean | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setHasInjected(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  const isWrongChain = isConnected && chainId !== bscTestnet.id;
  const shortAddr    = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  function handleConnect() {
    if (connectError) reset();
    connect({ connector: injected() });
  }

  let walletBtn: React.ReactNode;

  if (isConnected && isWrongChain) {
    walletBtn = (
      <button
        onClick={() => switchChain({ chainId: bscTestnet.id })}
        disabled={isSwitching}
        className="flex items-center gap-2 rounded-xl border border-orange-400/50 bg-orange-400/10 px-4 py-2 text-sm font-semibold text-orange-300 transition-all hover:bg-orange-400/20 hover:shadow-[0_0_16px_rgba(251,146,60,0.3)] disabled:opacity-60"
      >
        {isSwitching ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
        {isSwitching ? "Switching…" : "Wrong Network"}
      </button>
    );
  } else if (isConnected) {
    walletBtn = (
      <div className="relative">
        <button
          onClick={() => setShowDropdown((o) => !o)}
          className="flex items-center gap-2 rounded-xl border border-bnb-yellow/30 bg-bnb-yellow/8 px-4 py-2 text-sm font-semibold text-bnb-yellow transition-all hover:border-bnb-yellow/60 hover:bg-bnb-yellow/15 hover:shadow-[0_0_16px_rgba(243,186,47,0.2)]"
          style={{ background: "rgba(243,186,47,0.06)" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          {shortAddr}
          <ChevronDown size={13} className={`transition-transform ${showDropdown ? "rotate-180" : ""}`} />
        </button>
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-2xl border border-bnb-yellow/20 glass/95 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_12px_rgba(243,186,47,0.1)] backdrop-blur-xl">
              <div className="border-b border-white/5 px-3 py-2 text-[11px] text-gray-500">
                BSC Testnet
              </div>
              <button
                onClick={() => { disconnect(); setShowDropdown(false); }}
                className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  } else if (isPending) {
    walletBtn = (
      <button disabled className="flex items-center gap-2 rounded-xl bg-bnb-yellow/70 px-4 py-2 text-sm font-bold text-black">
        <Loader2 size={14} className="animate-spin" /> Connecting…
      </button>
    );
  } else if (hasInjected === false) {
    walletBtn = (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-outline-neon flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
      >
        <Wallet size={14} /> Install MetaMask
      </a>
    );
  } else {
    walletBtn = (
      <button
        onClick={handleConnect}
        className="btn-neon flex items-center gap-2 rounded-xl px-5 py-2 text-sm"
      >
        <Wallet size={14} />
        Connect Wallet
      </button>
    );
  }

  return (
    <nav className="sticky top-0 z-50">
      {/* Glowing top border line */}
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(243,186,47,0.5) 30%, rgba(243,186,47,0.8) 50%, rgba(243,186,47,0.5) 70%, transparent)" }} />

      <div
        className="border-b border-bnb-yellow/10 backdrop-blur-2xl"
        style={{ background: "rgba(8,8,12,0.88)", backdropFilter: "blur(24px) saturate(1.4)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">

          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-bnb-yellow to-bnb-yellow-dim shadow-glow-sm transition-all group-hover:shadow-glow-md">
              {/* Scan-line shimmer on logo */}
              <div className="absolute inset-0 overflow-hidden rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="h-full w-0.5 bg-white/30" style={{ animation: "streak 1.5s linear infinite" }} />
              </div>
              <Zap size={17} strokeWidth={2.5} className="relative z-10 text-black" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-white">
                Agent<span className="shimmer-text">Launch</span>
              </span>
              <div className="text-[9px] font-semibold tracking-widest text-bnb-yellow/60 uppercase -mt-0.5">
                BNB Chain
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                    active
                      ? "text-bnb-yellow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-xl bg-bnb-yellow/10 border border-bnb-yellow/20" />
                  )}
                  <Icon size={15} className="relative z-10" />
                  <span className="relative z-10">{label}</span>
                  {active && (
                    <span className="relative z-10 h-1 w-1 rounded-full bg-bnb-yellow animate-pulse-slow ml-0.5" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* BNB Chain badge */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-bnb-yellow/20 bg-bnb-yellow/5 px-3 py-1 text-[11px] font-medium text-bnb-yellow/80">
              <span className="h-1.5 w-1.5 rounded-full bg-bnb-yellow animate-pulse-slow" />
              Testnet
            </div>

            {walletBtn}

            <button
              className="rounded-xl border border-white/10 p-2 text-gray-400 hover:border-white/20 hover:text-white transition-colors md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {connectError && !isConnected && !isPending && (
          <div className="border-t border-red-500/20 bg-red-500/8 px-4 py-2 text-center text-xs text-red-400">
            {connectError.message.includes("rejected") || connectError.message.includes("denied")
              ? "Connection cancelled."
              : `Could not connect: ${connectError.message}`}
          </div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-bnb-yellow/10 px-4 py-3 md:hidden">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === href
                    ? "bg-bnb-yellow/10 text-bnb-yellow border border-bnb-yellow/20"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
