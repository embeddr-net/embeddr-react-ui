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
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Prevent shadcn primitives being imported via relative paths from
      // WITHIN the ui/ directory itself. Components in embeddr/ are allowed
      // to import from ../ui/ since they compose primitives.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "./ui",
            "./ui/*",
          ],
        },
      ],
      // Disable until eslint-plugin-react-hooks v7 compat is resolved
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default config;
