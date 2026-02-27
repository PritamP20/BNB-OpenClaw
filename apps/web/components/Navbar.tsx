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

// Extend Window for injected wallet detection
declare global {
  interface Window { ethereum?: unknown }
}
import { injected } from "wagmi/connectors";
import { bscTestnet } from "wagmi/chains";
import {
  Zap, Rocket, BarChart2, Menu, X,
  AlertTriangle, Loader2, ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/",       label: "Explore", icon: BarChart2 },
  { href: "/launch", label: "Launch",  icon: Rocket    },
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

  // Detect injected wallet presence after hydration
  useEffect(() => {
    setHasInjected(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  const isWrongChain = isConnected && chainId !== bscTestnet.id;
  const shortAddr    = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  // ── Wallet button ──────────────────────────────────────────────────────────

  function handleConnect() {
    if (connectError) reset();
    connect({ connector: injected() });
  }

  let walletBtn: React.ReactNode;

  if (isConnected && isWrongChain) {
    // Wrong chain — prompt switch to BSC Testnet
    walletBtn = (
      <button
        onClick={() => switchChain({ chainId: bscTestnet.id })}
        disabled={isSwitching}
        className="flex items-center gap-1.5 rounded-lg border border-orange-400/40 bg-orange-400/10 px-4 py-2 text-sm font-medium text-orange-300 transition-colors hover:border-orange-400/60 disabled:opacity-60"
      >
        {isSwitching
          ? <Loader2 size={13} className="animate-spin" />
          : <AlertTriangle size={13} />}
        {isSwitching ? "Switching…" : "Switch to BSC Testnet"}
      </button>
    );

  } else if (isConnected) {
    // Connected — show address with disconnect dropdown
    walletBtn = (
      <div className="relative">
        <button
          onClick={() => setShowDropdown((o) => !o)}
          className="flex items-center gap-1.5 rounded-lg border border-bnb-border px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white"
        >
          <span className="h-2 w-2 rounded-full bg-green-400" />
          {shortAddr}
          <ChevronDown size={13} />
        </button>
        {showDropdown && (
          <>
            {/* Click-outside dismiss */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-xl border border-bnb-border bg-bnb-card p-1 shadow-xl">
              <button
                onClick={() => { disconnect(); setShowDropdown(false); }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-400/10"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );

  } else if (isPending) {
    // Connecting in progress — show spinner
    walletBtn = (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg bg-bnb-yellow/60 px-4 py-2 text-sm font-bold text-black"
      >
        <Loader2 size={14} className="animate-spin" /> Connecting…
      </button>
    );

  } else if (hasInjected === false) {
    // No wallet extension found
    walletBtn = (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-bnb-border px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:border-white/20 hover:text-white"
      >
        Install MetaMask
      </a>
    );

  } else {
    // Default: connect button
    walletBtn = (
      <button
        onClick={handleConnect}
        className="rounded-lg bg-bnb-yellow px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90"
      >
        Connect Wallet
      </button>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <nav className="sticky top-0 z-50 border-b border-bnb-border bg-bnb-dark/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bnb-yellow text-black">
            <Zap size={16} strokeWidth={2.5} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Agent<span className="text-bnb-yellow">Launch</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>

        {/* Wallet button + mobile toggle */}
        <div className="flex items-center gap-2">
          {walletBtn}

          <button
            className="rounded-lg p-2 text-gray-400 hover:text-white md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Connection error banner */}
      {connectError && !isConnected && !isPending && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-center text-xs text-red-400">
          {connectError.message.includes("rejected") || connectError.message.includes("denied")
            ? "Connection cancelled."
            : `Could not connect: ${connectError.message}`}
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-bnb-border px-4 py-3 md:hidden">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
