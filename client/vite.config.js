import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const target = "http://127.0.0.1:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target,
        changeOrigin: true,
      },
      "/sitemap.xml": {
        target,
        changeOrigin: true,
      },
      "/robots.txt": {
        target,
        changeOrigin: true,
      },
    },
  },
});
