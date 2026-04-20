import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "dev",
  base: "./",
  build: {
    outDir: resolve(__dirname, "docs"),
    emptyOutDir: true,
    target: "es2020",
  },
  server: {
    port: 5173,
    host: true,
  },
});
