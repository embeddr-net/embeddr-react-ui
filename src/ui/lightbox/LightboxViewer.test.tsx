import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { LightboxViewer } from "./LightboxViewer";

// Mock dependencies that might cause issues in JSDOM or are complex
vi.mock("./PannableImage", () => ({
  PannableImage: ({ src }: { src: string }) => (
    <img data-testid="pannable-image" src={src} />
  ),
}));

vi.mock("./ImageThumbnailStrip", () => ({
  ImageThumbnailStrip: () => <div data-testid="thumbnail-strip">Strip</div>,
}));

vi.mock("./GalleryPicker", () => ({
  GalleryPicker: () => <div data-testid="gallery-picker">Picker</div>,
}));

describe("LightboxViewer", () => {
  const mockGallery = {
    id: "g1",
    name: "Test Gallery",
    images: [
      { id: "1", url: "img1.jpg", width: 100, height: 100 },
      { id: "2", url: "img2.jpg", width: 100, height: 100 },
    ],
  };

  const defaultProps = {
    imageSrc: "img1.jpg",
    gallery: mockGallery,
    imageIndex: 0,
    onGalleryChange: vi.fn(),
    onImageChange: vi.fn(),
    isOpen: true,
    onClose: vi.fn(),
  };

  it("renders correctly when open", () => {
    render(<LightboxViewer {...defaultProps} />);
    expect(screen.getByTestId("pannable-image")).toBeInTheDocument();
  });

  it("shows gallery picker when enabled", () => {
    render(<LightboxViewer {...defaultProps} showGalleryPicker={true} />);
    expect(screen.getByTestId("gallery-picker")).toBeInTheDocument();
  });

  it("does not show gallery picker when disabled", () => {
    render(<LightboxViewer {...defaultProps} showGalleryPicker={false} />);
    expect(screen.queryByTestId("gallery-picker")).not.toBeInTheDocument();
  });

  it("calls onImageChange when slideshow plays", () => {
    vi.useFakeTimers();
    render(<LightboxViewer {...defaultProps} />);

    const playButton = screen.getByTitle("Start slideshow");
    fireEvent.click(playButton);

    // Should now be playing
    expect(screen.getByTitle("Pause slideshow")).toBeInTheDocument();

    // Fast forward time
    vi.advanceTimersByTime(2500);

    expect(defaultProps.onImageChange).toHaveBeenCalledWith(1);

    vi.useRealTimers();
  });

  it("calls onClose when close button is clicked", () => {
    render(<LightboxViewer {...defaultProps} />);
    const closeButton = screen.getByLabelText("Close dialog");
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
