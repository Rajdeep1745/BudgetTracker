import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-deep-purple)",
        mist: "var(--color-background)",
      },
    },
  },
  plugins: [],
} satisfies Config;
