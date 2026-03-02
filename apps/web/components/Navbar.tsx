"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChainId } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Zap, Rocket, BarChart2, Menu, X,
  MessageSquare, Code2,
} from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "/",       label: "Explore", icon: BarChart2     },
  { href: "/launch", label: "Launch",  icon: Rocket        },
  { href: "/chat",   label: "Chat",    icon: MessageSquare },
  { href: "/sdk",    label: "SDK",     icon: Code2         },
];

export function Navbar() {
  const pathname = usePathname();
  const chainId = useChainId();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50" style={{ background: "#0F0F0F", borderBottom: "2px solid #222222" }}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
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

          {/* RainbowKit Connect Button */}
          <ConnectButton />

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
