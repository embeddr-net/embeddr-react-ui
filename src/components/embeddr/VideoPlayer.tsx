import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button, Slider } from "@embeddr/react-ui/components/ui";
import { cn } from "../../lib/utils";

interface VideoPlayerProps {
  src: string;
  className?: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean; // if false, completely headless (default true)
  objectFit?: "contain" | "cover" | "fill";
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  className,
  poster,
  autoPlay = false,
  loop = true,
  muted = false,
  controls = true,
  objectFit = "contain",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);

  // Sync volume/muted from state and incoming prop updates.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    setIsMuted(muted);
  }, [muted]);

  // Handle autoPlay
  useEffect(() => {
    if (autoPlay && videoRef.current) {
      void videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((error) => {
          const err = error as { name?: string } | undefined;
          if (err?.name !== "NotAllowedError") {
            console.warn("Auto-play failed:", error);
          }
          setIsPlaying(false);
        });
    }
  }, [autoPlay, src]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((value: Array<number>) => {
    const newVol = value[0] ?? 1; // Default to 1 if undefined
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      setVolume(newVol);
      if (newVol === 0 && !videoRef.current.muted) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else if (newVol > 0 && videoRef.current.muted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  }, []);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(cur);
    if (dur > 0) {
      setProgress((cur / dur) * 100);
    }
  };

  const handleSeek = (value: Array<number>) => {
    if (!videoRef.current || value[0] === undefined) return;
    const seekVal = value[0];
    const newTime = (seekVal / 100) * duration;
    videoRef.current.currentTime = newTime;
    setProgress(seekVal);
    setCurrentTime(newTime);
  };

  const handleDurationChange = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleLoadedData = () => {
    setIsLoading(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative bg-card overflow-hidden flex items-center justify-center border-none",
        className,
      )}
      onMouseEnter={() => {
        setShowControls(true);
      }}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={cn("block", {
          "w-full h-full object-cover": objectFit === "cover",
          "w-full h-full object-fill": objectFit === "fill",
          "w-full h-full object-contain": objectFit === "contain",
        })}
        loop={loop}
        playsInline
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onLoadedData={handleLoadedData}
        onLoadedMetadata={handleDurationChange}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary/80" />
        </div>
      )}

      {/* Big Play Button Overlay (only when paused and not loading) */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-card/10 cursor-pointer z-10 group/overlay"
          onClick={togglePlay}
        >
          <div className="w-14 h-10  bg-card/60 border border-white/10 backdrop-blur-md flex items-center justify-center group-hover/overlay:bg-black/80 group-hover/overlay:scale-110 transition-all duration-300 shadow-xl rounded-md">
            <Play className="w-5 h-5 text-foreground fill-primary ml-0.5" />
          </div>
        </div>
      )}

      {/* Controls Bar */}
      {controls && (
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0  p-1 transition-opacity duration-300 z-20 flex flex-col gap-1 ",
            showControls || !isPlaying ? "opacity-100" : "opacity-0",
          )}
        >
          {/* Top Row: Buttons */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className=" aspect-square shrink-0 text-foreground hover:text-foreground hover:bg-white/20 "
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 text-foreground fill-primary" />
                ) : (
                  <Play className="h-5 w-5 text-foreground fill-primary" />
                )}
              </Button>

              <div className="flex items-center gap-1 group/vol">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 shrink-0 text-foreground hover:text-foreground hover:bg-white/20 "
                  onClick={toggleMute}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
                <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 flex items-center">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="w-20"
                  />
                </div>
              </div>

              <div className="text-[10px] font-mono text-white/80 select-none ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 shrink-0 text-foreground hover:text-foreground hover:bg-white/20 "
              onClick={handleFullscreen}
            >
              <Maximize className="w-4 h-4" />
            </Button>
          </div>

          {/* Bottom Row: Progress Bar */}
          <div className="group/slider bottom-2 transition-all cursor-pointer w-full">
            <Slider
              value={[progress]}
              max={100}
              onValueChange={handleSeek}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};
