import { describe, expect, it } from "vitest";
import { cn } from "../../lib/utils";

describe("cn utility", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    const includeBar = 1 + 1 === 2;
    const includeBaz = 1 + 1 === 3;
    expect(
      cn("foo", includeBar ? "bar" : undefined, includeBaz ? "baz" : undefined),
    ).toBe("foo bar");
  });

  it("should merge tailwind classes correctly", () => {
    // tailwind-merge should override p-4 with p-8
    expect(cn("p-4", "p-8")).toBe("p-8");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("should handle arrays and objects", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
    expect(cn({ foo: true, bar: false })).toBe("foo");
  });
});
