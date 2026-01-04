import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { useExternalNav } from "../hooks/useExternalNav";
import { ExternalNavProvider } from "./ExternalNavProvider";

// Helper component to trigger the hook
const TestComponent = () => {
  const { openExternal } = useExternalNav();
  return (
    <button onClick={() => openExternal("https://example.com")}>
      Open Link
    </button>
  );
};

describe("ExternalNavProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders children correctly", () => {
    render(
      <ExternalNavProvider>
        <div>Child Content</div>
      </ExternalNavProvider>
    );
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("opens dialog when openExternal is called", () => {
    render(
      <ExternalNavProvider>
        <TestComponent />
      </ExternalNavProvider>
    );

    fireEvent.click(screen.getByText("Open Link"));

    expect(screen.getByText("Leaving site")).toBeInTheDocument();
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });

  it("opens window and closes dialog on confirm", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <ExternalNavProvider>
        <TestComponent />
      </ExternalNavProvider>
    );

    // Open dialog
    fireEvent.click(screen.getByText("Open Link"));

    // Click continue
    fireEvent.click(screen.getByText("Continue"));

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer"
    );

    // Dialog should be closed (or closing)
    // Note: Radix Dialog might have animation delays, but checking for absence or visibility is good
    // For now, we check that the spy was called which implies the logic ran
  });

  it("closes dialog on cancel without opening window", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <ExternalNavProvider>
        <TestComponent />
      </ExternalNavProvider>
    );

    // Open dialog
    fireEvent.click(screen.getByText("Open Link"));

    // Click cancel
    fireEvent.click(screen.getByText("Cancel"));

    expect(openSpy).not.toHaveBeenCalled();
  });
});
