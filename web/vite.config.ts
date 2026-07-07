import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer/",
    },
    dedupe: ["react", "react-dom"],
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            if (id.includes("/generated/vesting-positions/")) {
              return "vesting-program";
            }
            return;
          }

          if (
            id.includes("@solana/") ||
            id.includes("@solana-program/") ||
            id.includes("bn.js") ||
            id.includes("/buffer/")
          ) {
            return "solana";
          }

          if (
            id.includes("@tanstack/") &&
            !id.includes("@tanstack/react-table")
          ) {
            return "tanstack";
          }

          if (
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("/react/")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
