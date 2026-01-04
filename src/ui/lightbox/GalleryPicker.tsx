import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useImageDialog } from "@embeddr/react-ui/hooks";
import type { Gallery } from "@embeddr/react-ui/types/gallery";

interface GalleryPickerProps {
  currentGalleryId?: string;
  onGalleryChange: (galleryId: string) => void;
}

export const GalleryPicker = ({
  currentGalleryId,
  onGalleryChange,
}: GalleryPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { galleries } = useImageDialog();

  const currentGallery = galleries.find((g) => g.id === currentGalleryId);

  return (
    <div className="relative w-full">
      {/* Toggle Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer w-full flex items-center justify-between px-4 py-3 bg-background/40 border-b border-border hover:bg-secondary/20 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          {currentGallery && (
            <>
              <img
                src={currentGallery.thumbnail}
                alt={currentGallery.name}
                className="w-8 h-8 object-cover rounded"
              />
              <div className="text-left">
                <div className="font-medium text-sm">{currentGallery.name}</div>
                {currentGallery.description && (
                  <div className="text-xs text-muted-foreground">
                    {currentGallery.description}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Gallery Grid */}
      {isOpen && (
        <div className="overflow-hidden bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex flex-wrap gap-2 p-4 max-h-64 overflow-y-auto">
            {galleries.map((gallery: Gallery) => (
              <button
                key={gallery.id}
                onClick={() => {
                  onGalleryChange(gallery.id);
                  setIsOpen(false);
                }}
                className={`cursor-pointer relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 shrink-0 ${
                  gallery.id === currentGalleryId
                    ? "border-primary ring-2 ring-primary/50"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img
                  src={gallery.thumbnail}
                  alt={gallery.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent flex items-end p-1">
                  <span className="text-xs font-medium truncate w-full text-center leading-tight">
                    {gallery.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
