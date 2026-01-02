import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Gallery } from "../../types/gallery";

interface ImageThumbnailStripProps {
  gallery: Gallery;
  currentIndex: number;
  onImageChange: (index: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ImageThumbnailStrip = ({
  gallery,
  currentIndex,
  onImageChange,
  isOpen,
  onToggle,
}: ImageThumbnailStripProps) => {
  const [showInfo, setShowInfo] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentImage = gallery.images[currentIndex];

  // Auto-scroll to current image
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      const thumbnail = scrollContainerRef.current.children[
        currentIndex
      ] as HTMLElement;
      thumbnail.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex, isOpen]);

  return (
    <div className="relative w-full flex flex-col-reverse">
      {/* Toggle Button - stays at bottom */}
      <div
        onClick={onToggle}
        className="cursor-pointer w-full flex items-center justify-between px-4 py-3 hover:bg-background/40 backdrop-blur-sm border-t border-border bg-secondary/20 transition-colors select-none focus:outline-none focus:ring-0"
      >
        <div className="flex items-center gap-3">
          {currentImage && (
            <>
              <img
                src={currentImage.thumbnail || currentImage.src}
                alt={currentImage.title || `Image ${currentIndex + 1}`}
                className="w-10 h-10 object-cover rounded"
              />
              <div className="text-left">
                <div className="font-medium text-sm">
                  {currentImage.title || `Image ${currentIndex + 1}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentIndex + 1} / {gallery.images.length}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentImage?.description && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowInfo(!showInfo);
              }}
              className="p-1 hover:bg-primary/20 rounded transition-colors cursor-pointer"
            >
              <Info className="w-4 h-4" />
            </div>
          )}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Thumbnail Strip */}
      {isOpen && (
        <div className="w-full bg-background/80 backdrop-blur-md border-t border-border p-2 animate-in slide-in-from-bottom-10 fade-in duration-200">
          <div
            ref={scrollContainerRef}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent px-2"
          >
            {gallery.images.map((img, idx) => (
              <div
                key={idx}
                onClick={() => onImageChange(idx)}
                className={`relative flex-shrink-0 cursor-pointer transition-all duration-200 ${
                  idx === currentIndex
                    ? "ring-2 ring-primary scale-105 z-10"
                    : "opacity-70 hover:opacity-100 hover:scale-105"
                }`}
              >
                <img
                  src={img.thumbnail || img.src}
                  alt={img.title || `Thumbnail ${idx + 1}`}
                  className="h-20 w-auto object-cover rounded-sm"
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          {/* Info Panel */}
          {showInfo && currentImage?.description && (
            <div className="p-4 text-sm text-muted-foreground border-t border-border mt-2">
              {currentImage.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
