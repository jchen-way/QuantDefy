import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        panel: "var(--panel)",
        panelStrong: "var(--panel-strong)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        edge: "var(--edge)",
        green: "var(--green)",
        red: "var(--red)",
        gold: "var(--gold)"
      },
      boxShadow: {
        soft: "0 20px 80px rgba(15, 23, 42, 0.08)",
        panel: "0 12px 40px rgba(15, 23, 42, 0.08)"
      },
      borderRadius: {
        xl2: "1.5rem"
      },
      fontFamily: {
        sans: [
          "\"Avenir Next\"",
          "\"Segoe UI\"",
          "\"Helvetica Neue\"",
          "sans-serif"
        ],
        mono: [
          "\"IBM Plex Mono\"",
          "\"SFMono-Regular\"",
          "\"SF Mono\"",
          "monospace"
        ]
      }
    }
  },
  plugins: []
};

export default config;
