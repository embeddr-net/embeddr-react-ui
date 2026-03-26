import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

const originalConsoleWarn = console.warn;
console.warn = (...args: Array<unknown>) => {
  const firstArg = args[0];
  if (
    typeof firstArg === "string" &&
    firstArg.includes(
      "THREE.WARNING: Multiple instances of Three.js being imported",
    )
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});
