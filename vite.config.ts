/// <reference types="vitest" />
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Auto-generate externals from package.json — no more manual maintenance
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8"),
);
const externalDeps = [
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
];
// Match both direct imports and deep imports (e.g. @radix-ui/react-dialog/dist/...)
const externalPattern = new RegExp(
  `^(${externalDeps.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(/.*)?$`,
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["three", "@react-three/fiber", "@react-three/drei"],
    alias: {
      three: resolve(__dirname, "node_modules/three"),
      "@react-three/fiber": resolve(
        __dirname,
        "node_modules/@react-three/fiber",
      ),
      "@react-three/drei": resolve(__dirname, "node_modules/@react-three/drei"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      formats: ["es"],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: (id) => {
        if (id === "react/jsx-runtime") return true;
        return externalPattern.test(id);
      },
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
