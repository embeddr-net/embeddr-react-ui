import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLocalStorage } from "./useLocalStorage";

describe("useLocalStorage", () => {
  const key = "test-key";
  const initialValue = "initial";

  afterEach(() => {
    window.localStorage.clear();
  });

  it("should return initial value if nothing in localStorage", () => {
    const { result } = renderHook(() => useLocalStorage(key, initialValue));
    expect(result.current[0]).toBe(initialValue);
  });

  it("should return stored value if available", () => {
    window.localStorage.setItem(key, JSON.stringify("stored"));
    const { result } = renderHook(() => useLocalStorage(key, initialValue));
    expect(result.current[0]).toBe("stored");
  });

  it("should update localStorage when state changes", () => {
    const { result } = renderHook(() => useLocalStorage(key, initialValue));

    act(() => {
      result.current[1]("new-value");
    });

    expect(result.current[0]).toBe("new-value");
    expect(window.localStorage.getItem(key)).toBe(JSON.stringify("new-value"));
  });

  it("should handle function updates", () => {
    const { result } = renderHook(() => useLocalStorage<number>("count", 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
    expect(window.localStorage.getItem("count")).toBe(JSON.stringify(1));
  });
});
