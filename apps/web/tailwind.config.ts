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
        /* Bauhaus palette */
        bh: {
          bg:      "#0F0F0F",
          surface: "#1A1A1A",
          card:    "#222222",
          border:  "#333333",
          strong:  "#555555",
          yellow:  "#F5C220",
          red:     "#D62828",
          blue:    "#1B4EF8",
          white:   "#F5F5F5",
          gray:    "#888888",
          muted:   "#444444",
        },
        /* Legacy bnb aliases */
        bnb: {
          yellow:      "#F5C220",
          "yellow-dim": "#c9a010",
          dark:        "#0F0F0F",
          card:        "#222222",
          border:      "#333333",
          muted:       "#888888",
          glass:       "#222222",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      keyframes: {
        "slide-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
      animation: {
        "slide-up":  "slide-up 0.35s ease-out both",
        "fade-in":   "fade-in 0.3s ease-out both",
      },
      backgroundImage: {
        /* flat solid stubs — no gradients in Bauhaus */
        "gold-gradient": "none",
        "card-gradient": "none",
        "hero-radial":   "none",
      },
      boxShadow: {
        /* Bauhaus: no glow shadows */
        "glow-sm":    "none",
        "glow-md":    "none",
        "glow-lg":    "none",
        "card":       "0 1px 0 #333333",
        "card-hover": "0 0 0 1px #F5C220",
      },
    },
  },
  plugins: [],
};

export default config;
