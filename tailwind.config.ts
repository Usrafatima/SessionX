import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "SFMono-Regular", "Consolas", "monospace"]
      },
      colors: {
        brand: {
          bg: "#050505",
          deep: "#030405",
          card: "#0A0A0A",
          surface: "#111111",
          orange: "#FF8A00",
          bright: "#FF9F1C",
          text: "#F5F5F5",
          muted: "#8A8A8A",
          border: "#222222",
          borderStrong: "#2A2A2A"
        }
      },
      boxShadow: {
        glow: "0 0 28px rgba(255, 138, 0, 0.12)",
        panel: "0 20px 80px rgba(0, 0, 0, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
