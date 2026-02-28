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
          "yellow-dim": "#c9982a",
          dark:    "#08080c",
          card:    "#12121a",
          border:  "#1e1e2e",
          muted:   "#9ca3af",
          glass:   "rgba(18,18,26,0.85)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px) scale(1)" },
          "50%":     { transform: "translateY(-24px) scale(1.04)" },
        },
        "float-reverse": {
          "0%,100%": { transform: "translateY(0px)" },
          "50%":     { transform: "translateY(18px)" },
        },
        "glow-pulse": {
          "0%,100%": { opacity: "0.3" },
          "50%":     { opacity: "0.9" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "border-glow": {
          "0%,100%": { boxShadow: "0 0 8px rgba(243,186,47,0.2)" },
          "50%":     { boxShadow: "0 0 28px rgba(243,186,47,0.55)" },
        },
        streak: {
          "0%":   { transform: "translateX(-100%) skewX(-12deg)", opacity: "0" },
          "10%":  { opacity: "0.6" },
          "90%":  { opacity: "0.3" },
          "100%": { transform: "translateX(400%) skewX(-12deg)", opacity: "0" },
        },
      },
      animation: {
        "pulse-slow":   "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        float:          "float 6s ease-in-out infinite",
        "float-rev":    "float-reverse 8s ease-in-out infinite",
        "glow-pulse":   "glow-pulse 2.2s ease-in-out infinite",
        shimmer:        "shimmer 3s linear infinite",
        "slide-up":     "slide-up 0.5s ease-out both",
        "border-glow":  "border-glow 2.5s ease-in-out infinite",
        streak:         "streak 4s linear infinite",
      },
      backgroundImage: {
        "gold-gradient":   "linear-gradient(135deg, #F3BA2F 0%, #ffe07a 50%, #c9982a 100%)",
        "card-gradient":   "linear-gradient(135deg, rgba(22,22,30,0.95) 0%, rgba(10,10,16,0.98) 100%)",
        "hero-radial":     "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(243,186,47,0.12) 0%, transparent 70%)",
      },
      boxShadow: {
        "glow-sm":  "0 0 10px rgba(243,186,47,0.3)",
        "glow-md":  "0 0 24px rgba(243,186,47,0.4)",
        "glow-lg":  "0 0 48px rgba(243,186,47,0.35), 0 8px 32px rgba(0,0,0,0.6)",
        "card":     "0 4px 32px rgba(0,0,0,0.5)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.7), 0 0 28px rgba(243,186,47,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
