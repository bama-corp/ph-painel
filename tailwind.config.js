/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        mist: "rgb(var(--mist) / <alpha-value>)",
        pine: "rgb(var(--pine) / <alpha-value>)",
        moss: "rgb(var(--moss) / <alpha-value>)",
        rust: "rgb(var(--rust) / <alpha-value>)",
        copper: "rgb(var(--copper) / <alpha-value>)",
        rule: "rgb(var(--rule) / <alpha-value>)",
        wash: "rgb(var(--wash) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Syne", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Figtree", "ui-sans-serif", "system-ui", "sans-serif"],
        num: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
