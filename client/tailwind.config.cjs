module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["Merriweather", "Georgia", "Cambria", "serif"],
      },
      colors: {
        ink: {
          50: "#f4f6fb",
          100: "#e8ecf5",
          200: "#cbd4e6",
          700: "#1a2234",
          800: "#111726",
          900: "#0b0f19",
          950: "#060911",
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },
      boxShadow: {
        "elev-1": "0 1px 3px rgba(11, 15, 25, 0.06), 0 1px 2px rgba(11, 15, 25, 0.04)",
        "elev-2": "0 8px 24px -4px rgba(11, 15, 25, 0.08), 0 2px 6px -1px rgba(11, 15, 25, 0.04)",
        "elev-3": "0 16px 36px -6px rgba(11, 15, 25, 0.14), 0 4px 12px -2px rgba(11, 15, 25, 0.06)",
        "elev-4": "0 24px 48px -12px rgba(11, 15, 25, 0.22), 0 8px 20px -4px rgba(79, 70, 229, 0.12)",
      },
      transitionDuration: {
        fast: "150ms",
        normal: "250ms",
        slow: "400ms",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
