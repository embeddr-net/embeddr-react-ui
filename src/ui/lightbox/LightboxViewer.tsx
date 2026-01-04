import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, X } from "lucide-react";
import { Button } from "../button";
import { PannableImage } from "./PannableImage";
import { ImageThumbnailStrip } from "./ImageThumbnailStrip";
import { GalleryPicker } from "./GalleryPicker";
import type { Gallery, ImageAction } from "../../types/gallery";

interface LightboxViewerProps {
  imageSrc?: string | null;
  gallery: Gallery | null;
  imageIndex: number;
  onGalleryChange: (galleryId: string) => void;
  onImageChange: (index: number) => void;
  isOpen?: boolean;
  actions?: Array<ImageAction>;
  isLoading?: boolean;
  onClose?: () => void;
  showGalleryPicker?: boolean;
  showThumbnailStrip?: boolean;
}

export const LightboxViewer = ({
  imageSrc,
  gallery,
  imageIndex,
  onGalleryChange,
  onImageChange,
  isOpen,
  actions = [],
  isLoading,
  onClose,
  showGalleryPicker = false,
  showThumbnailStrip = false,
}: LightboxViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStripOpen, setIsStripOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        onImageChange(imageIndex + 1);
      }, 2500);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, imageIndex, onImageChange]);

  // Stop playing if dialog closes
  useEffect(() => {
    if (!isOpen) setIsPlaying(false);
  }, [isOpen]);

  const handleImageChange = async (index: number) => {
    if (!gallery) return;
    await onImageChange(index);
  };

  // Prepare actions for PannableImage
  const currentImage = gallery?.images[imageIndex];
  const pannableActions = currentImage
    ? actions
        .filter((action) => !action.isVisible || action.isVisible(currentImage))
        .map((action) => ({
          icon: action.icon,
          label: action.label,
          onClick: () => action.onClick(currentImage),
        }))
    : [];

  // Calculate bottom offset for controls based on strip state
  const controlsBottomOffset = showThumbnailStrip
    ? isStripOpen
      ? 180 // Strip open height + padding
      : 80 // Strip closed height + padding
    : 16; // Default padding

  return (
    <div className="flex flex-col w-full h-full relative min-h-max flex-1 focus:outline-none">
      {/* Top Gallery Picker */}
      {showGalleryPicker && (
        <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <GalleryPicker
              currentGalleryId={gallery?.id}
              onGalleryChange={onGalleryChange}
            />
          </div>
        </div>
      )}

      <div className="absolute top-2 right-10 z-30 pointer-events-auto flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled
          className="px-4  flex items-center justify-center text-sm font-medium text-muted-foreground  backdrop-blur-sm"
        >
          {imageIndex + 1} /{" "}
          {gallery?.totalImages || gallery?.images.length || 0}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setIsPlaying(!isPlaying)}
          className=" rounded-none bg-background/90 hover:bg-secondary/20 text-muted-foreground hover:text-foreground border-b border-l border-border backdrop-blur-sm"
          title={isPlaying ? "Pause slideshow" : "Start slideshow"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Main Image - Pannable Canvas */}
      <div className="flex-1 flex items-center justify-center relative w-full h-full  min-h-full">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
        {imageSrc && (
          <PannableImage
            src={imageSrc}
            mediaType={currentImage?.media_type === "video" ? "video" : "image"}
            className="w-full h-full"
            isOpen={isOpen}
            actions={pannableActions}
            controlsBottomOffset={controlsBottomOffset}
          />
        )}
      </div>

      {/* Close Button - positioned over content */}
      {onClose && (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onClose}
          className="cursor-pointer hover:bg-secondary/20 fixed top-2 right-1.5 z-50  flex items-center justify-center group"
          aria-label="Close dialog"
        >
          <X className=" text-muted-foreground group-hover:text-foreground transition-colors" />
        </Button>
      )}

      {/* Bottom Image Strip */}
      {showThumbnailStrip && (
        <div className="absolute bottom-0 left-0 right-0 z-20 select-none focus-visible:outline-none focus:ring-0 focus:ring-transparent">
          {gallery && (
            <ImageThumbnailStrip
              gallery={gallery}
              currentIndex={imageIndex}
              onImageChange={handleImageChange}
              isOpen={isStripOpen}
              onToggle={() => setIsStripOpen(!isStripOpen)}
            />
          )}
        </div>
      )}
    </div>
  );
};
