import type { ReactNode } from "react";

export interface GalleryImage {
  src: string;
  thumbnail?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, any>; // For custom data like model, prompt, etc.
}

export interface Gallery {
  id: string;
  name: string;
  description?: string;
  thumbnail: string;
  images: Array<GalleryImage>;
  customHtml?: string; // Optional HTML content for gallery info
  totalImages?: number;
  fetchMore?: (direction: "next" | "prev", offset: number) => Promise<void>;
}

export interface GalleriesData {
  galleries: Array<Gallery>;
}

export interface ImageAction {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: (image: GalleryImage) => void;
  isVisible?: (image: GalleryImage) => boolean;
}
