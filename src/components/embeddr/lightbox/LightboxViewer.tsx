import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Settings2, X } from "lucide-react";
import {
  Button,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Slider,
  Switch,
} from "@embeddr/react-ui/components/ui";
import { GalleryPicker } from "./GalleryPicker";
import { ImageThumbnailStrip } from "./ImageThumbnailStrip";
import { PannableVideo } from "./PannableVideo";
import { PannableImage } from "./PannableImage";

import type { Gallery, ImageAction } from "../../../types/gallery";

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
  videoControls?: "auto" | "hidden";
  apiKey?: string;
}

interface LightboxSettings {
  slideDuration: number;
  videoAutoAdvance: boolean;
  videoLoop: boolean;
  videoAutoPlay: boolean;
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
  videoControls = "auto",
  apiKey,
}: LightboxViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStripOpen, setIsStripOpen] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<LightboxSettings>(() => {
    const saved = localStorage.getItem("embeddr-lightbox-settings");
    return saved
      ? JSON.parse(saved)
      : {
          slideDuration: 3000,
          videoAutoAdvance: true,
          videoLoop: true,
          videoAutoPlay: true,
        };
  });

  const updateSettings = (updates: Partial<LightboxSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("embeddr-lightbox-settings", JSON.stringify(next));
      return next;
    });
  };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentImage = gallery?.images[imageIndex];
  const isVideo = currentImage?.media_type === "video";

  // Slideshow Logic
  const nextSlide = useCallback(() => {
    if (!gallery) return;
    const nextIndex = (imageIndex + 1) % gallery.images.length;
    onImageChange(nextIndex);
  }, [gallery, imageIndex, onImageChange]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!isPlaying) return;

    // If it's a video and we are auto-advancing, we wait for onEnded instead of a timer
    if (isVideo && settings.videoAutoAdvance) {
      return;
    }

    // Default timer for images or non-auto-advancing videos
    timerRef.current = setTimeout(() => {
      nextSlide();
    }, settings.slideDuration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    isPlaying,
    isVideo,
    settings.slideDuration,
    settings.videoAutoAdvance,
    nextSlide,
  ]);

  // Handle Video Ended (for slideshow)
  const handleVideoEnded = useCallback(() => {
    if (isPlaying && settings.videoAutoAdvance) {
      nextSlide();
    }
  }, [isPlaying, settings.videoAutoAdvance, nextSlide]);

  // Stop playing if dialog closes
  useEffect(() => {
    if (!isOpen) setIsPlaying(false);
  }, [isOpen]);

  const handleImageChange = async (index: number) => {
    if (!gallery) return;
    await onImageChange(index);
  };

  // Prepare actions for PannableImage
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
    <div className="flex flex-col w-full h-full relative min-h-0 flex-1 focus:outline-none">
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

      {/* Top Right Controls */}
      <div className="absolute top-2 right-10 z-30 pointer-events-auto flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled
          className="px-4 flex items-center justify-center text-sm font-medium text-muted-foreground backdrop-blur-sm shadow-sm"
        >
          {imageIndex + 1} /{" "}
          {gallery?.totalImages || gallery?.images.length || 0}
        </Button>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setIsPlaying(!isPlaying)}
          className=" bg-background/90 hover:bg-secondary/20 text-muted-foreground hover:text-foreground border border-border backdrop-blur-sm shadow-sm"
          title={isPlaying ? "Pause slideshow" : "Start slideshow"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        {/* Settings Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              className=" bg-background/90 hover:bg-secondary/20 text-muted-foreground hover:text-foreground border border-border backdrop-blur-sm shadow-sm"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80 bg-background/95 backdrop-blur-md"
          >
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Slideshow Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Customize playback behavior.
                </p>
              </div>
              <Separator />

              {/* Slide Duration */}
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="duration">Slide Duration (Images)</Label>
                  <span className="text-xs text-muted-foreground">
                    {settings.slideDuration / 1000}s
                  </span>
                </div>
                <Slider
                  id="duration"
                  min={1000}
                  max={10000}
                  step={500}
                  value={[settings.slideDuration]}
                  onValueChange={(val) =>
                    updateSettings({ slideDuration: val[0] ?? 3000 })
                  }
                />
              </div>

              <Separator />

              {/* Video Settings */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label
                    htmlFor="auto-advance"
                    className=" items-start flex flex-col gap-1"
                  >
                    <span>Video Auto-Advance</span>
                    <span className="font-normal text-xs text-muted-foreground">
                      Next slide when video ends
                    </span>
                  </Label>
                  <Switch
                    id="auto-advance"
                    checked={settings.videoAutoAdvance}
                    onCheckedChange={(c) =>
                      updateSettings({ videoAutoAdvance: c })
                    }
                  />
                </div>
                <div className="flex justify-between">
                  <Label
                    htmlFor="video-loop"
                    className=" items-start flex flex-col gap-1"
                  >
                    <span>Loop Videos</span>
                    <span className="font-normal text-xs text-muted-foreground">
                      Repeat video when playing manually
                    </span>
                  </Label>
                  <Switch
                    id="video-loop"
                    checked={settings.videoLoop}
                    onCheckedChange={(c) => updateSettings({ videoLoop: c })}
                  />
                </div>
                <div className="flex justify-between">
                  <Label
                    htmlFor="video-play"
                    className="items-start flex flex-col gap-1"
                  >
                    <span>Auto Play</span>
                    <span className="font-normal text-xs text-muted-foreground">
                      Start videos automatically
                    </span>
                  </Label>
                  <Switch
                    id="video-play"
                    checked={settings.videoAutoPlay}
                    onCheckedChange={(c) =>
                      updateSettings({ videoAutoPlay: c })
                    }
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Main Image - Pannable Canvas */}
      <div className="flex-1 flex items-center justify-center relative w-full h-full min-h-0">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
        {imageSrc &&
          // Determine if we show video or image component
          (isVideo ? (
            <PannableVideo
              apiKey={apiKey}
              src={imageSrc}
              className="w-full h-full"
              isOpen={isOpen}
              actions={pannableActions}
              controlsBottomOffset={controlsBottomOffset}
              autoPlay={settings.videoAutoPlay}
              controlsMode={videoControls}
              // If we are in slideshow mode AND auto-advance is on, we force loop to false so it ends
              loop={
                isPlaying && settings.videoAutoAdvance
                  ? false
                  : settings.videoLoop
              }
              onEnded={handleVideoEnded}
            />
          ) : (
            <PannableImage
              apiKey={apiKey}
              src={imageSrc}
              mediaType="image"
              className="w-full h-full"
              isOpen={isOpen}
              actions={pannableActions}
              controlsBottomOffset={controlsBottomOffset}
            />
          ))}
      </div>

      {/* Close Button - positioned over content */}
      {onClose && (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onClose}
          className="cursor-pointer hover:bg-secondary/20 fixed top-2 right-1.5 z-50 flex items-center justify-center group"
          aria-label="Close dialog"
        >
          <X className="text-muted-foreground group-hover:text-foreground transition-colors" />
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
              apiKey={apiKey}
            />
          )}
        </div>
      )}
    </div>
  );
};
