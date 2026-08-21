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
        // Brand: emerald green (calm, professional, business-friendly)
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
        // Neutral: zinc (Linear/Vercel style — more sophisticated than slate)
        ink: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
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
        DEFAULT: "0.5rem",
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.625rem",
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
