import type { Linter } from "eslint"; // Make sure this import resolves
import { tanstackConfig } from "@tanstack/eslint-config";

const config: Linter.Config[] = [
  ...tanstackConfig,
  {
    ignores: [
      "vite.config.d.ts",
      "tsconfig.json",
      "*.config.{js,ts}",
      "dist/**",
      "build/**",
      ".vite/**",
    ],
  },
];

export default config;
