/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  safelist: [
    { pattern: /^(bg|text|border)-guild-/ },
    { pattern: /^bg-guild-accent-tint$/ },
    { pattern: /^bg-guild-danger-tint$/ },
    "shadow-soft",
    "rounded-card",
    "rounded-inner",
    "rounded-pill",
    "animate-shake",
    "animate-score-pop",
  ],
  theme: {
    extend: {
      colors: {
        guild: {
          page: "#FFFFFF",
          panel: "#F2F4F6",
          card: "#FFFFFF",
          text: "#24272A",
          muted: "#6A737D",
          faint: "#9FA6AE",
          border: "#D6D9DC",
          primary: "#037DD6",
          "primary-hover": "#0260A4",
          accent: "#F6851B",
          "accent-tint": "rgba(246,133,27,0.08)",
          danger: "#D73847",
          "danger-tint": "rgba(215,56,71,0.07)",
          success: "#1C8234",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        card: "16px",
        inner: "10px",
        pill: "999px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.06)",
      },
      keyframes: {
        "score-pop": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-4px)" },
          "40%, 80%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        "score-pop": "score-pop 0.35s ease-out forwards",
        shake: "shake 0.45s ease-in-out",
      },
    },
  },
  plugins: [],
};
