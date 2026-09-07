import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand: indigo-blue (professional B2B SaaS, Duralux-inspired)
        // 500 = #3454d1 (Duralux primary)
        brand: {
          50: "#eef1fa",
          100: "#d5deef",
          200: "#aab8de",
          300: "#8093ce",
          400: "#566dbc",
          500: "#3454d1",
          600: "#2a44b0",
          700: "#21358a",
          800: "#182865",
          900: "#0f1a41",
          950: "#080f28",
        },
        // Neutral: slate (cool tone, complements indigo brand — Bootstrap/Duralux family)
        ink: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        // Semantic colors matched to Duralux palette
        success: {
          50: "#e8f9ef",
          500: "#17c666",
          600: "#12a052",
          700: "#0d7a3e",
        },
        info: {
          50: "#e6f7f6",
          500: "#3dc7be",
          600: "#2ba39c",
          700: "#1e7f79",
        },
        warn: {
          50: "#fff5e0",
          500: "#ffa21d",
          600: "#e88a00",
          700: "#b56b00",
        },
        danger: {
          50: "#fde9e9",
          500: "#ea4d4d",
          600: "#c73838",
          700: "#9c2828",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Fluid sizes: scale smoothly between mobile (~320px) and desktop (~1280px)
        // clamp(min, preferred, max) — viewport-aware without breakpoint jumps
        xs: ["clamp(0.6875rem, 0.65rem + 0.2vw, 0.75rem)", { lineHeight: "1.1rem" }],
        sm: ["clamp(0.75rem, 0.7rem + 0.25vw, 0.8125rem)", { lineHeight: "1.25rem" }],
        base: ["clamp(0.8125rem, 0.75rem + 0.3vw, 0.9375rem)", { lineHeight: "1.375rem" }],
        lg: ["clamp(0.9375rem, 0.85rem + 0.4vw, 1.0625rem)", { lineHeight: "1.5rem" }],
        xl: ["clamp(1.0625rem, 0.95rem + 0.5vw, 1.25rem)", { lineHeight: "1.75rem" }],
        "2xl": ["clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)", { lineHeight: "2rem" }],
      },
      borderRadius: {
        // Duralux-inspired tighter radius (4px default — more "professional B2B")
        DEFAULT: "0.25rem",  // 4px
        sm: "0.125rem",       // 2px
        md: "0.25rem",        // 4px
        lg: "0.375rem",       // 6px
        xl: "1rem",           // 16px (cards)
        "2xl": "1.25rem",     // 20px (large containers)
      },
      boxShadow: {
        // Softer shadows
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.05)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
