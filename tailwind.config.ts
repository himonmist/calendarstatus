import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#0b1220", 900: "#111a2e", 700: "#334155", 500: "#64748b", 300: "#cbd5e1", 100: "#eef2f7", 50: "#f6f8fb" },
        brand: { DEFAULT: "#0f766e", dark: "#0b5d57", soft: "#e6f4f2" },
        ok: "#16a34a", warn: "#d97706", busy: "#dc2626",
      },
      fontFamily: { sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(15,23,42,.06), 0 8px 24px -12px rgba(15,23,42,.12)" },
    },
  },
  plugins: [],
} satisfies Config;
