import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0c1017",
        graphite: "#151923",
        bone: "#f4efe6",
        signal: "#e9ff5c",
        volt: "#31f0b2",
        danger: "#ff5964",
        panel: "#1b2230",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        cut: "10px 10px 0 rgba(233, 255, 92, 0.12)",
        danger: "10px 10px 0 rgba(255, 89, 100, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
