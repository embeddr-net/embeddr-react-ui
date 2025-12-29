import {
  
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { LightboxViewer } from "../ui/lightbox/LightboxViewer";
import {
  
  ImageDialogContext
} from "../context/ImageDialogContext";
import type {GalleryWithTotal} from "../context/ImageDialogContext";
import type {ReactNode} from "react";
import type { Gallery, GalleryImage, ImageAction } from "../types/gallery";

export const ImageDialogProvider = ({ children }: { children: ReactNode }) => {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [galleries, setGalleries] = useState<Array<Gallery>>([]);
  const [currentGallery, setCurrentGallery] = useState<GalleryWithTotal | null>(
    null
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [actions, setActions] = useState<Array<ImageAction>>([]);

  const openImage = useCallback(
    (
      src: string,
      galleryOrMetadata?: any,
      initialIndex?: number,
      customActions: Array<ImageAction> = [],
      imagePath?: string
    ) => {
      setImageSrc(src);

      // Determine if we have a real gallery or just a single image context
      const isGallery =
        galleryOrMetadata && Array.isArray(galleryOrMetadata.images);

      const gallery: GalleryWithTotal = isGallery
        ? (galleryOrMetadata as GalleryWithTotal)
        : {
            id: "single-image",
            name: "Image Viewer",
            thumbnail: src,
            images: [
              {
                src,
                title: imagePath || src,
                metadata:
                  galleryOrMetadata && typeof galleryOrMetadata === "object"
                    ? galleryOrMetadata
                    : { id: galleryOrMetadata },
              },
            ],
            totalImages: 1,
          };

      setCurrentGallery(gallery);

      const idx =
        isGallery && typeof initialIndex === "number"
          ? initialIndex
          : gallery.images.findIndex((img) => img.src === src);

      setCurrentImageIndex(idx >= 0 ? idx : 0);
      setActions(customActions);
      setIsOpen(true);
    },
    []
  );

  const closeImage = useCallback(() => {
    setIsOpen(false);
    setImageSrc(null);
  }, []);

  // Unified image change handler for both keyboard and thumbnail navigation
  const onImageChangeUnified = async (index: number) => {
    if (!currentGallery) return;
    const total = currentGallery.totalImages || currentGallery.images.length;
    const loadedCount = currentGallery.images.length;

    // 1. Check if index is completely out of bounds (negative or beyond total)
    if (index < 0 || index >= total) {
      return;
    }

    // 2. Check if index is within total but not yet loaded
    if (index >= loadedCount) {
      setPendingIndex(index);
      // Trigger fetch more if available
      if (currentGallery.fetchMore) {
        // Calculate how many pages we need to fetch
        // This is a simple heuristic, assuming we fetch in batches
        await currentGallery.fetchMore("next", loadedCount);
      }
      return;
    }

    // 3. Index is loaded
    setCurrentImageIndex(index);
    setPendingIndex(null);

    // Debounce the heavy update (src & prefetch)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const img = currentGallery.images[index];
      if (img) {
        setImageSrc(img.src);

        // Prefetch next/prev images
        const nextImg = currentGallery.images[index + 1];
        const prevImg = currentGallery.images[index - 1];
        if (nextImg) {
          const i = new Image();
          i.src = nextImg.src;
        }
        if (prevImg) {
          const i = new Image();
          i.src = prevImg.src;
        }

        // Check if we need to fetch more (infinite scroll trigger)
        if (
          currentGallery.fetchMore &&
          index >= currentGallery.images.length - 5 &&
          currentGallery.images.length < total
        ) {
          currentGallery.fetchMore("next", currentGallery.images.length);
        }
      }
    }, 50);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        onImageChangeUnified(currentImageIndex + 1);
      } else if (e.key === "ArrowLeft") {
        onImageChangeUnified(currentImageIndex - 1);
      } else if (e.key === "Escape") {
        closeImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentImageIndex, currentGallery]);

  // Update imageSrc when pending index becomes available
  useEffect(() => {
    if (
      pendingIndex !== null &&
      currentGallery &&
      pendingIndex < currentGallery.images.length
    ) {
      onImageChangeUnified(pendingIndex);
    }
  }, [currentGallery?.images.length, pendingIndex]);

  const setGalleryImages = useCallback(
    (
      images: Array<GalleryImage> | any,
      replace = true,
      newIndex?: number,
      totalImages?: number
    ) => {
      setCurrentGallery((prev) => {
        if (!prev) return null;
        const newImages = replace ? images : [...prev.images, ...images];
        return {
          ...prev,
          images: newImages,
          totalImages: totalImages ?? prev.totalImages,
        };
      });

      if (typeof newIndex === "number") {
        setCurrentImageIndex(newIndex);
      }
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      openImage,
      closeImage,
      setGalleryImages,
      galleries,
      currentGallery,
      currentImageIndex,
      isOpen,
    }),
    [
      openImage,
      closeImage,
      setGalleryImages,
      galleries,
      currentGallery,
      currentImageIndex,
      isOpen,
    ]
  );

  return (
    <ImageDialogContext.Provider value={contextValue}>
      {children}
      <Dialog open={isOpen} onOpenChange={(open) => !open && closeImage()}>
        <DialogContent
          className="max-w-[90vw] max-h-[95vh] min-w-[90vw] h-[95vh] w-full overflow-hidden flex items-center justify-center bg-background/95 backdrop-blur-sm p-0 border-2 border-border focus:outline-none data-[state=open]:animate-none data-[state=closed]:animate-none"
          showCloseButton={false}
        >
          <VisuallyHidden>
            <DialogTitle>Image Viewer</DialogTitle>
            <DialogDescription>
              View images in a lightbox gallery
            </DialogDescription>
          </VisuallyHidden>
          <LightboxViewer
            imageSrc={imageSrc}
            gallery={currentGallery}
            imageIndex={currentImageIndex}
            onGalleryChange={() => {}}
            onImageChange={onImageChangeUnified}
            isOpen={isOpen}
            actions={actions}
            isLoading={pendingIndex !== null}
            onClose={closeImage}
          />
        </DialogContent>
      </Dialog>
    </ImageDialogContext.Provider>
  );
};
