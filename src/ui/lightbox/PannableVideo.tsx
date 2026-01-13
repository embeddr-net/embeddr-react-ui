import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RotateCcw,
  RotateCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Repeat,
} from "lucide-react";
import { Button } from "../button";
import { Slider } from "../slider";
import type { PannableImageAction } from "./PannableImage";
import { cn } from "../../lib/utils";

interface PannableVideoProps {
  src: string;
  className?: string;
  isOpen?: boolean;
  actions?: Array<PannableImageAction>;
  controlsBottomOffset?: number;
  // External control props
  autoPlay?: boolean;
  onEnded?: () => void;
  loop?: boolean;
}

export const PannableVideo: React.FC<PannableVideoProps> = ({
  src,
  className,
  isOpen = true,
  actions = [],
  controlsBottomOffset = 16,
  autoPlay = true,
  onEnded,
  loop: propLoop = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pan/Zoom State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showHelp, setShowHelp] = useState(false);

  // Video State
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(propLoop);
  const [showControls, setShowControls] = useState(true);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  // Refs
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize Volume from LocalStorage
  useEffect(() => {
    const savedVol = localStorage.getItem("embeddr-video-volume");
    if (savedVol) setVolume(parseFloat(savedVol));
  }, []);

  // Save volume
  const handleVolumeChange = (val: number) => {
    setVolume(val);
    localStorage.setItem("embeddr-video-volume", val.toString());
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    if (!newMuted && volume === 0) {
      handleVolumeChange(1);
    }
  };

  // Reset View Reset
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setRotation(0);
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };
    }
  }, [src, isOpen]);

  // Sync zoom refs
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // Handle Video Events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volume;
    video.loop = isLooping;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [volume, isLooping, onEnded]);

  // Prop updates
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = isLooping;
    }
  }, [isLooping]);

  useEffect(() => {
    // Sync internal loop state if prop changes (e.g. from slideshow settings)
    setIsLooping(propLoop);
  }, [propLoop]);

  // Controls Visibility
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  }, [isPlaying]);

  useEffect(() => {
    showControlsTemporarily();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, showControlsTemporarily]);

  // --- Handlers ---

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleSeek = (val: number[]) => {
    if (!videoRef.current || !duration) return;
    const value = val[0] ?? 0;
    const newTime = (value / 100) * duration;
    videoRef.current.currentTime = newTime;
    setProgress(value);
  };

  // --- Panning Logic (Same as before) ---
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Logic omitted for brevity, keeping existing implementation
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rx = mouseX - cx - panRef.current.x;
    const ry = mouseY - cy - panRef.current.y;
    const delta = -Math.sign(e.deltaY) * 0.1;
    const newZoom = Math.max(0.1, Math.min(10, zoomRef.current + delta));
    const zoomFactor = newZoom / zoomRef.current;
    const newPanX = mouseX - cx - (mouseX - cx - panRef.current.x) * zoomFactor;
    const newPanY = mouseY - cy - (mouseY - cy - panRef.current.y) * zoomFactor;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });

    // Show zoom indicator
    setShowZoomIndicator(true);
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    zoomTimeoutRef.current = setTimeout(
      () => setShowZoomIndicator(false),
      2000
    );
  }, []);

  // Mouse Drag Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't drag if clicking controls
    if ((e.target as HTMLElement).closest(".video-controls")) return;
    if (e.button !== 0) return;
    e.preventDefault();
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    showControlsTemporarily();
    if (isDragging) {
      e.preventDefault();
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleDoubleClick = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  // Event Listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full overflow-hidden bg-black/90 flex items-center justify-center select-none group",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Video Content */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          transformOrigin: "center",
          transition: isDragging ? "none" : "transform 0.1s ease-out",
          willChange: "transform",
          maxWidth: "100%",
          maxHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        className="w-full h-full pointer-events-none"
      >
        <video
          ref={videoRef}
          src={src}
          autoPlay={autoPlay}
          playsInline
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* --- Custom Controls Overlay --- */}
      <div
        className={cn(
          "video-controls absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-black/60 backdrop-blur-md border border-white/10 p-3 flex flex-col gap-2 transition-all duration-300",
          showControls || !isPlaying
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
        style={{ marginBottom: controlsBottomOffset }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div className="flex items-center gap-3 w-full">
          <span className="text-xs font-mono text-white/70 min-w-[40px] text-right">
            {formatTime(videoRef.current?.currentTime || 0)}
          </span>
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1 cursor-pointer py-1"
          />
          <span className="text-xs font-mono text-white/70 min-w-[40px]">
            {formatTime(duration || 0)}
          </span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={togglePlay}
              className="hover:bg-white/10 text-white rounded-none h-8 w-8"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleMute}
                className="hover:bg-white/10 text-white rounded-none h-8 w-8"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
              <div className="w-24">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.05}
                  onValueChange={(v) => handleVolumeChange(v[0] ?? 0)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsLooping(!isLooping)}
              className={cn(
                "hover:bg-white/10 rounded-none h-8 w-8 transition-colors",
                isLooping ? "text-primary" : "text-white/50"
              )}
              title="Toggle Loop"
            >
              <Repeat className="w-4 h-4" />
            </Button>

            {/* Rotation Controls (integrated into bar) */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setRotation((r) => r - 90)}
              className="hover:bg-white/10 text-white rounded-none h-8 w-8"
              title="Rotate Left"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setRotation((r) => r + 90)}
              className="hover:bg-white/10 text-white rounded-none h-8 w-8"
              title="Rotate Right"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Zoom indicator and Help (Bottom Right) */}
      <div
        className="absolute right-2 flex items-center gap-2 transition-all duration-300 ease-in-out"
        style={{ bottom: `${controlsBottomOffset}px` }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Action Buttons */}
        {actions.map((action, idx) => (
          <Button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            className="h-8 w-8 bg-background/90 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-primary/20 transition-all duration-200"
            title={action.label}
          >
            {action.icon}
          </Button>
        ))}

        {/* Zoom Level */}
        <div className="h-8 ring-1 ring-foreground/10 bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground pointer-events-none border border-border/50 transition-opacity duration-0 items-center justify-center flex">
          {Math.round(zoom * 100)}%
        </div>

        {/* Help Icon */}
        <div className="relative">
          <div
            onMouseEnter={() => setShowHelp(true)}
            onMouseLeave={() => setShowHelp(false)}
            className="w-8 h-8 ring-1 ring-foreground/10 bg-background/90 backdrop-blur-sm border border-border/50 flex items-center justify-center cursor-help transition-all duration-0 hover:bg-primary/20"
          >
            <span className="text-xs text-muted-foreground font-medium">?</span>
          </div>

          {/* Help Tooltip */}
          {showHelp && (
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-background/95 backdrop-blur-sm border border-border p-3 text-xs text-muted-foreground shadow-lg">
              <div className="space-y-1">
                <div>
                  <span className="text-foreground">Scroll/Pinch:</span> Zoom
                  in/out
                </div>
                <div>
                  <span className="text-foreground">Drag:</span> Pan around
                  video
                </div>
                <div>
                  <span className="text-foreground">Double-click:</span> Reset
                  view
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
