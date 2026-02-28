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
        className="flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider disabled:opacity-60"
        style={{ background: "transparent", border: "2px solid #D62828", color: "#D62828" }}
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
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider"
          style={{ background: "#1A1A1A", border: "2px solid #F5C220", color: "#F5C220" }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#4ade80" }} />
          {shortAddr}
          <ChevronDown size={12} className={`transition-transform ${showDropdown ? "rotate-180" : ""}`} />
        </button>
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
            <div
              className="absolute right-0 top-full z-20 mt-1 w-48 p-1"
              style={{ background: "#1A1A1A", border: "1px solid #333333" }}
            >
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555555", borderBottom: "1px solid #333333" }}>
                BSC Testnet
              </div>
              <button
                onClick={() => { disconnect(); setShowDropdown(false); }}
                className="mt-1 w-full px-3 py-2 text-left text-sm font-bold uppercase tracking-wider transition-colors"
                style={{ color: "#D62828" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(214,40,40,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
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
      <button disabled className="flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wider" style={{ background: "#F5C220", color: "#0F0F0F", opacity: 0.7 }}>
        <Loader2 size={14} className="animate-spin" /> Connecting…
      </button>
    );
  } else if (hasInjected === false) {
    walletBtn = (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-outline-neon flex items-center gap-2 px-4 py-2 text-sm"
      >
        <Wallet size={14} /> Install MetaMask
      </a>
    );
  } else {
    walletBtn = (
      <button
        onClick={handleConnect}
        className="btn-neon flex items-center gap-2 px-5 py-2 text-sm"
      >
        <Wallet size={14} />
        Connect Wallet
      </button>
    );
  }

  return (
    <nav className="sticky top-0 z-50" style={{ background: "#0F0F0F", borderBottom: "2px solid #222222" }}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          {/* Bauhaus geometric logo mark */}
          <div
            className="flex h-8 w-8 items-center justify-center"
            style={{ background: "#F5C220" }}
          >
            <Zap size={16} strokeWidth={3} style={{ color: "#0F0F0F" }} />
          </div>
          <div>
            <span className="text-base font-black tracking-tight uppercase" style={{ color: "#F5F5F5", letterSpacing: "-0.01em" }}>
              Agent<span style={{ color: "#F5C220" }}>Launch</span>
            </span>
            <div className="text-[8px] font-black tracking-[0.25em] uppercase -mt-0.5" style={{ color: "#555555" }}>
              BNB Chain
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center md:flex" style={{ gap: "1px", background: "#222222" }}>
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="relative flex items-center gap-1.5 px-5 py-4 text-sm font-bold uppercase tracking-wider transition-colors"
                style={{
                  color: active ? "#F5C220" : "#888888",
                  background: active ? "#1A1A1A" : "transparent",
                  borderBottom: active ? "2px solid #F5C220" : "2px solid transparent",
                }}
              >
                <Icon size={14} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Network badge */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: "#1A1A1A", border: "1px solid #333333", color: "#888888" }}
          >
            <span className="h-1.5 w-1.5" style={{ background: "#4ade80" }} />
            Testnet
          </div>

          {walletBtn}

          <button
            className="p-2 transition-colors md:hidden"
            style={{ border: "1px solid #333333", color: "#888888" }}
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {connectError && !isConnected && !isPending && (
        <div
          className="px-4 py-2 text-center text-xs font-bold uppercase tracking-wider"
          style={{ background: "rgba(214,40,40,0.12)", borderTop: "1px solid rgba(214,40,40,0.3)", color: "#D62828" }}
        >
          {connectError.message.includes("rejected") || connectError.message.includes("denied")
            ? "Connection cancelled."
            : `Could not connect: ${connectError.message}`}
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden" style={{ borderTop: "1px solid #222222", background: "#0F0F0F" }}>
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors"
              style={{
                color: pathname === href ? "#F5C220" : "#888888",
                background: pathname === href ? "#1A1A1A" : "transparent",
                borderLeft: pathname === href ? "3px solid #F5C220" : "3px solid transparent",
              }}
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
