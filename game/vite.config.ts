import { defineConfig } from "vite";

// Poki uploads a zip of dist/: every path must be relative, nothing may load from another host.
export default defineConfig({
  base: "./",
  build: { target: "es2020", assetsInlineLimit: 0, reportCompressedSize: true },
});
