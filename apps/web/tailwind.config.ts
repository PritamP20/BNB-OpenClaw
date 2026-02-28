import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./providers.tsx",
  ],
  theme: {
    extend: {
      colors: {
        bnb: {
          yellow:  "#F3BA2F",
          "yellow-dim": "#b8912a",
          gold:    "#d4a121",
          amber:   "#e8a820",
          dark:    "#060608",
          card:    "#0e0e16",
          border:  "#1a1a24",
          muted:   "#6b7280",
          glass:   "rgba(14,14,22,0.75)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px) scale(1)" },
          "50%":     { transform: "translateY(-20px) scale(1.02)" },
        },
        "float-reverse": {
          "0%,100%": { transform: "translateY(0px)" },
          "50%":     { transform: "translateY(16px)" },
        },
        "glow-pulse": {
          "0%,100%": { opacity: "0.35" },
          "50%":     { opacity: "0.9" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(24px) scale(0.98)" },
          to:   { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "border-glow": {
          "0%,100%": { boxShadow: "0 0 6px rgba(243,186,47,0.15)" },
          "50%":     { boxShadow: "0 0 20px rgba(243,186,47,0.4)" },
        },
        streak: {
          "0%":   { transform: "translateX(-100%) skewX(-15deg)", opacity: "0" },
          "10%":  { opacity: "0.5" },
          "90%":  { opacity: "0.3" },
          "100%": { transform: "translateX(400%) skewX(-15deg)", opacity: "0" },
        },
        breathe: {
          "0%,100%": { opacity: "0.5", transform: "scale(1)" },
          "50%":      { opacity: "0.8", transform: "scale(1.05)" },
        },
      },
      animation: {
        "pulse-slow":   "pulse 3.5s cubic-bezier(0.4,0,0.6,1) infinite",
        float:          "float 7s ease-in-out infinite",
        "float-rev":    "float-reverse 9s ease-in-out infinite",
        "glow-pulse":   "glow-pulse 2.5s ease-in-out infinite",
        shimmer:        "shimmer 4s linear infinite",
        "slide-up":     "slide-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "border-glow":  "border-glow 3s ease-in-out infinite",
        streak:         "streak 5s linear infinite",
        breathe:        "breathe 4s ease-in-out infinite",
      },
      backgroundImage: {
        "gold-gradient":   "linear-gradient(135deg, #F3BA2F 0%, #ffe999 40%, #e8a820 70%, #d4a121 100%)",
        "card-gradient":   "linear-gradient(145deg, rgba(14,14,22,0.95) 0%, rgba(10,10,16,0.98) 100%)",
        "hero-radial":     "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(243,186,47,0.1) 0%, transparent 70%)",
      },
      boxShadow: {
        "glow-sm":  "0 0 10px rgba(243,186,47,0.25)",
        "glow-md":  "0 0 24px rgba(243,186,47,0.35)",
        "glow-lg":  "0 0 48px rgba(243,186,47,0.3), 0 8px 32px rgba(0,0,0,0.5)",
        "card":     "0 2px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.5), 0 0 24px rgba(243,186,47,0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
