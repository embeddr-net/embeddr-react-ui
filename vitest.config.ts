import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const projectRoot = resolve(__dirname, ".");

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    dedupe: ["three", "@react-three/fiber", "@react-three/drei"],
    alias: {
      "@": resolve(__dirname, "./src"),
      three: resolve(projectRoot, "node_modules/three"),
      "@react-three/fiber": resolve(
        projectRoot,
        "node_modules/@react-three/fiber",
      ),
      "@react-three/drei": resolve(
        projectRoot,
        "node_modules/@react-three/drei",
      ),
    },
  },
});
