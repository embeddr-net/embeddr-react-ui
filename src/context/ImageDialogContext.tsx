import { createContext, useContext } from "react";
import type { Gallery, GalleryImage, ImageAction } from "../types/gallery";

export interface GalleryWithTotal extends Gallery {
  totalImages?: number;
}

export interface ImageDialogContextType {
  // openImage: src, then optional galleryId OR an inline gallery-like context (images[])
  openImage: (
    imageSrc: string,
    galleryIdOrContext?:
      | string
      | { images: Array<GalleryImage>; id?: string; name?: string }
      | any,
    initialIndex?: number,
    actions?: Array<ImageAction>,
    imagePath?: string
  ) => void;
  // Allows external callers (like Search) to update the shared gallery images
  setGalleryImages: (
    images: Array<GalleryImage>,
    replace?: boolean,
    newIndex?: number,
    totalImages?: number
  ) => void;
  closeImage: () => void;
  galleries: Array<Gallery>;
  currentGallery: GalleryWithTotal | null;
  currentImageIndex: number;
  isOpen: boolean;
}

export const ImageDialogContext = createContext<ImageDialogContextType | null>(
  null
);
