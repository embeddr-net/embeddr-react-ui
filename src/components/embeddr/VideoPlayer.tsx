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
  preload?: "none" | "metadata" | "auto";
  persistenceKey?: string | false;
}

type PersistedGlobalVideoState = {
  version: 1;
  muted: boolean;
  volume: number;
};

type PersistedMediaVideoState = {
  version: 1;
  currentTime: number;
  isPlaying: boolean;
  updatedAt: number;
};

const GLOBAL_VIDEO_STATE_KEY = "embeddr:video-player:global";
const CONTROL_HIDE_DELAY_MS = 1600;
const PLAYBACK_PERSIST_INTERVAL_MS = 2000;

const clampVolume = (value: number) => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
};

const readStorageValue = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeStorageValue = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
};

const readPersistedGlobalState = (): PersistedGlobalVideoState | null => {
  const value = readStorageValue<PersistedGlobalVideoState>(GLOBAL_VIDEO_STATE_KEY);
  if (!value || value.version !== 1) return null;
  return {
    version: 1,
    muted: Boolean(value.muted),
    volume: clampVolume(value.volume),
  };
};

const normalizePersistenceSource = (url: string) => {
  const value = String(url || "").trim();
  if (!value || /^blob:/i.test(value) || /^data:/i.test(value)) return "";
  try {
    const urlObj = new URL(
      value,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    const filteredEntries = Array.from(urlObj.searchParams.entries()).filter(
      ([key]) => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === "start" ||
          lowerKey === "apikey" ||
          lowerKey === "api_key" ||
          lowerKey === "token" ||
          lowerKey === "authorization" ||
          lowerKey === "sig" ||
          lowerKey === "signature" ||
          lowerKey === "expires" ||
          lowerKey.startsWith("x-amz-")
        ) {
          return false;
        }
        return true;
      },
    );
    filteredEntries.sort(([a], [b]) => a.localeCompare(b));
    urlObj.search = "";
    for (const [key, entryValue] of filteredEntries) {
      urlObj.searchParams.append(key, entryValue);
    }
    return urlObj.toString();
  } catch {
    return value;
  }
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const buildDefaultPersistenceId = (src: string) => {
  const normalized = normalizePersistenceSource(src);
  if (!normalized) return null;
  return hashString(normalized);
};

const buildMediaStateStorageKey = (id: string) => {
  return `embeddr:video-player:media:${id}`;
};

const readPersistedMediaState = (
  key: string,
): PersistedMediaVideoState | null => {
  const value = readStorageValue<PersistedMediaVideoState>(key);
  if (!value || value.version !== 1) return null;
  return {
    version: 1,
    currentTime: Math.max(0, Number(value.currentTime) || 0),
    isPlaying: Boolean(value.isPlaying),
    updatedAt: Number(value.updatedAt) || 0,
  };
};

const getServerSeekOffset = (url: string) => {
  try {
    const urlObj = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    return Math.max(0, Number(urlObj.searchParams.get("start") || 0) || 0);
  } catch {
    return 0;
  }
};

const isServerSeekableSceneStream = (url: string) => {
  try {
    const urlObj = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    return /\/scene\/[^/]+\/stream\.(mp4|webm)$/i.test(urlObj.pathname);
  } catch {
    return /\/scene\/[^/]+\/stream\.(mp4|webm)(?:\?.*)?$/i.test(url);
  }
};

const isWebmSceneStream = (url: string) => {
  try {
    const urlObj = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    return /\/scene\/[^/]+\/stream\.webm$/i.test(urlObj.pathname);
  } catch {
    return /\/scene\/[^/]+\/stream\.webm(?:\?.*)?$/i.test(url);
  }
};

const withServerSeekOffset = (url: string, offsetSeconds: number) => {
  try {
    const urlObj = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    urlObj.searchParams.set(
      "start",
      String(Math.max(0, Math.floor(offsetSeconds))),
    );
    return urlObj.toString();
  } catch {
    return url;
  }
};

export const VideoPlayer = React.memo(function VideoPlayer({
  src,
  className,
  poster,
  autoPlay = false,
  loop = true,
  muted = false,
  controls = true,
  objectFit = "contain",
  preload = "metadata",
  persistenceKey,
}: VideoPlayerProps) {
  const initialGlobalStateRef = useRef(readPersistedGlobalState());
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTimelineCommitRef = useRef(0);
  const lastPlaybackPersistRef = useRef(0);
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const progressRef = useRef(0);
  const timelineOffsetRef = useRef(getServerSeekOffset(src));
  const fullDurationRef = useRef(0);
  const pendingResumeTimeRef = useRef<number | null>(null);
  const resumePlaybackRef = useRef<boolean | null>(null);
  const scrubbingRef = useRef(false);
  const controlsHideTimerRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  const [activeSrc, setActiveSrc] = useState(src);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(
    initialGlobalStateRef.current?.muted ?? muted,
  );
  const [volume, setVolume] = useState(
    initialGlobalStateRef.current?.volume ?? 1,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);

  const resolvedPersistenceId = React.useMemo(() => {
    if (persistenceKey === false) return null;
    const explicit =
      typeof persistenceKey === "string" ? persistenceKey.trim() : "";
    return explicit || buildDefaultPersistenceId(src);
  }, [persistenceKey, src]);

  const mediaStateStorageKey = React.useMemo(() => {
    return resolvedPersistenceId
      ? buildMediaStateStorageKey(resolvedPersistenceId)
      : null;
  }, [resolvedPersistenceId]);

  // Sync volume/muted from state and incoming prop updates.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (initialGlobalStateRef.current) {
      initialGlobalStateRef.current = null;
      return;
    }
    setIsMuted(muted);
  }, [muted]);

  const resetTimelineState = useCallback(() => {
    setIsLoading(true);
    setIsPlaying(false);
    lastTimelineCommitRef.current = 0;
    durationRef.current = 0;
    currentTimeRef.current = 0;
    progressRef.current = 0;
    fullDurationRef.current = 0;
    setDuration(0);
    setCurrentTime(0);
    setProgress(0);
  }, []);

  useEffect(() => {
    const persistedState = mediaStateStorageKey
      ? readPersistedMediaState(mediaStateStorageKey)
      : null;
    const resumeTime = Math.max(0, persistedState?.currentTime ?? 0);
    const resumeWithServerSeek = resumeTime > 0 && isWebmSceneStream(src);

    setActiveSrc(
      resumeWithServerSeek ? withServerSeekOffset(src, resumeTime) : src,
    );
    timelineOffsetRef.current = resumeWithServerSeek
      ? Math.floor(resumeTime)
      : getServerSeekOffset(src);
    pendingResumeTimeRef.current =
      resumeTime > 0 && !resumeWithServerSeek ? resumeTime : null;
    resumePlaybackRef.current = persistedState?.isPlaying ?? null;
    scrubbingRef.current = false;
    resetTimelineState();
    if (resumeTime > 0) {
      currentTimeRef.current = resumeTime;
      setCurrentTime(resumeTime);
    }
  }, [mediaStateStorageKey, resetTimelineState, src]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    writeStorageValue(GLOBAL_VIDEO_STATE_KEY, {
      version: 1,
      muted: isMuted,
      volume: clampVolume(volume),
    } satisfies PersistedGlobalVideoState);
  }, [isMuted, volume]);

  const updateDurationState = useCallback((nextDuration: number) => {
    const safeDuration =
      Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0;
    if (Math.abs(durationRef.current - safeDuration) < 0.01) return;
    durationRef.current = safeDuration;
    setDuration(safeDuration);
  }, []);

  const syncTimelineState = useCallback(
    (force = false) => {
      const video = videoRef.current;
      if (!video) return;

      const localCurrent = Number.isFinite(video.currentTime)
        ? video.currentTime
        : 0;
      const localDuration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      if (timelineOffsetRef.current <= 0 && localDuration > 0) {
        fullDurationRef.current = localDuration;
      } else if (fullDurationRef.current <= 0 && localDuration > 0) {
        fullDurationRef.current = timelineOffsetRef.current + localDuration;
      }

      const totalDuration = fullDurationRef.current || localDuration;
      const current = Math.min(
        totalDuration || Infinity,
        timelineOffsetRef.current + localCurrent,
      );
      const nextProgress =
        totalDuration > 0 ? (current / totalDuration) * 100 : 0;

      updateDurationState(totalDuration);

      if (force || Math.abs(currentTimeRef.current - current) >= 0.2) {
        currentTimeRef.current = current;
        setCurrentTime(current);
      }
      if (force || Math.abs(progressRef.current - nextProgress) >= 0.5) {
        progressRef.current = nextProgress;
        setProgress(nextProgress);
      }
    },
    [updateDurationState],
  );

  const persistPlaybackState = useCallback(
    (force = false, playingOverride?: boolean) => {
      if (!mediaStateStorageKey) return;
      const now = Date.now();
      if (!force && now - lastPlaybackPersistRef.current < PLAYBACK_PERSIST_INTERVAL_MS) {
        return;
      }
      writeStorageValue(mediaStateStorageKey, {
        version: 1,
        currentTime: Math.max(0, currentTimeRef.current),
        isPlaying: playingOverride ?? isPlayingRef.current,
        updatedAt: now,
      } satisfies PersistedMediaVideoState);
      lastPlaybackPersistRef.current = now;
    },
    [mediaStateStorageKey],
  );

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current !== null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsHideTimer();
    if (!controls || !isPlayingRef.current || scrubbingRef.current) return;
    controlsHideTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
      controlsHideTimerRef.current = null;
    }, CONTROL_HIDE_DELAY_MS);
  }, [clearControlsHideTimer, controls]);

  const revealControls = useCallback(() => {
    if (!controls) return;
    setShowControls(true);
    scheduleControlsHide();
  }, [controls, scheduleControlsHide]);

  const hideControlsImmediately = useCallback(() => {
    clearControlsHideTimer();
    if (isPlayingRef.current) {
      setShowControls(false);
    }
  }, [clearControlsHideTimer]);

  const applyPendingResumeTime = useCallback(() => {
    const video = videoRef.current;
    const pendingResumeTime = pendingResumeTimeRef.current;
    if (!video || pendingResumeTime === null) return;
    const localTarget = Math.max(
      0,
      pendingResumeTime - timelineOffsetRef.current,
    );
    try {
      video.currentTime = localTarget;
    } catch {
      // Ignore failed native seek attempts.
    }
    pendingResumeTimeRef.current = null;
  }, []);

  // Handle autoPlay
  useEffect(() => {
    const shouldPlay = resumePlaybackRef.current ?? autoPlay;
    if (shouldPlay && videoRef.current) {
      resumePlaybackRef.current = null;
      void videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          persistPlaybackState(true, true);
        })
        .catch((error) => {
          const err = error as { name?: string } | undefined;
          if (err?.name !== "NotAllowedError") {
            console.warn("Auto-play failed:", error);
          }
          setIsPlaying(false);
          isPlayingRef.current = false;
        });
    } else {
      resumePlaybackRef.current = null;
    }
  }, [activeSrc, autoPlay, persistPlaybackState]);

  useEffect(() => {
    if (!controls) return;
    if (!isPlaying) {
      clearControlsHideTimer();
      setShowControls(true);
      return;
    }
    scheduleControlsHide();
    return clearControlsHideTimer;
  }, [clearControlsHideTimer, controls, isPlaying, scheduleControlsHide]);

  useEffect(() => {
    return () => {
      clearControlsHideTimer();
      persistPlaybackState(true);
    };
  }, [clearControlsHideTimer, persistPlaybackState]);

  useEffect(() => {
    const handlePersist = () => {
      persistPlaybackState(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistPlaybackState(true);
      }
    };

    window.addEventListener("pagehide", handlePersist);
    window.addEventListener("beforeunload", handlePersist);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePersist);
      window.removeEventListener("beforeunload", handlePersist);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [persistPlaybackState]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          revealControls();
          persistPlaybackState(true, true);
        })
        .catch(() => {
          setIsPlaying(false);
          isPlayingRef.current = false;
        });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
      setShowControls(true);
      persistPlaybackState(true, false);
    }
  }, [persistPlaybackState, revealControls]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    revealControls();
  }, [isMuted, revealControls]);

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
    revealControls();
  }, [revealControls]);

  const handleTimeUpdate = () => {
    if (!controls) return;
    if (scrubbingRef.current) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastTimelineCommitRef.current < 200) return;
    lastTimelineCommitRef.current = now;
    syncTimelineState();
    persistPlaybackState();
  };

  const getEffectiveDuration = useCallback(() => {
    return fullDurationRef.current || durationRef.current || duration;
  }, [duration]);

  const handleSeekPreview = useCallback(
    (value: Array<number>) => {
      if (!controls || value[0] === undefined) return;
      const seekVal = value[0];
      const effectiveDuration = getEffectiveDuration();
      if (effectiveDuration <= 0) return;
      const previewTime = (seekVal / 100) * effectiveDuration;
      scrubbingRef.current = true;
      progressRef.current = seekVal;
      currentTimeRef.current = previewTime;
      setProgress(seekVal);
      setCurrentTime(previewTime);
      revealControls();
    },
    [controls, getEffectiveDuration, revealControls],
  );

  const handleSeekCommit = useCallback((value: Array<number>) => {
    if (!videoRef.current || value[0] === undefined) {
      scrubbingRef.current = false;
      return;
    }
    const seekVal = value[0];
    const effectiveDuration = getEffectiveDuration();
    if (effectiveDuration <= 0) {
      scrubbingRef.current = false;
      return;
    }
    const newTime = (seekVal / 100) * effectiveDuration;
    const video = videoRef.current;
    const shouldUseServerSeek =
      isServerSeekableSceneStream(activeSrc) &&
      (isWebmSceneStream(activeSrc) || video.seekable.length === 0);

    if (shouldUseServerSeek) {
      timelineOffsetRef.current = newTime;
      currentTimeRef.current = newTime;
      progressRef.current = seekVal;
      setCurrentTime(newTime);
      setProgress(seekVal);
      setIsLoading(true);
      resumePlaybackRef.current = autoPlay || !video.paused;
      setActiveSrc(withServerSeekOffset(activeSrc, newTime));
      scrubbingRef.current = false;
      persistPlaybackState(true, !video.paused);
      revealControls();
      return;
    }

    video.currentTime = newTime;
    currentTimeRef.current = newTime;
    progressRef.current = seekVal;
    setProgress(seekVal);
    setCurrentTime(newTime);
    scrubbingRef.current = false;
    persistPlaybackState(true, !video.paused);
    revealControls();
  }, [activeSrc, autoPlay, getEffectiveDuration, persistPlaybackState, revealControls]);

  const handleDurationChange = () => {
    if (!controls) return;
    applyPendingResumeTime();
    syncTimelineState(true);
  };

  const handleLoadedData = () => {
    setIsLoading(false);
    if (controls) {
      applyPendingResumeTime();
      syncTimelineState(true);
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
      onPointerEnter={revealControls}
      onPointerMove={revealControls}
      onPointerLeave={hideControlsImmediately}
      onPointerDown={revealControls}
      onFocusCapture={revealControls}
      onBlurCapture={scheduleControlsHide}
    >
      <video
        ref={videoRef}
        src={activeSrc}
        poster={poster}
        className={cn("block", {
          "w-full h-full object-cover": objectFit === "cover",
          "w-full h-full object-fill": objectFit === "fill",
          "w-full h-full object-contain": objectFit === "contain",
        })}
        loop={loop}
        preload={preload}
        playsInline
        onClick={togglePlay}
        onTimeUpdate={controls ? handleTimeUpdate : undefined}
        onDurationChange={controls ? handleDurationChange : undefined}
        onLoadedData={handleLoadedData}
        onLoadedMetadata={controls ? handleDurationChange : undefined}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onPlay={() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          scheduleControlsHide();
          persistPlaybackState(true, true);
        }}
        onPause={() => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          if (controls) {
            syncTimelineState(true);
          }
          setShowControls(true);
          persistPlaybackState(true, false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          isPlayingRef.current = false;
          if (controls) {
            syncTimelineState(true);
          }
          setShowControls(true);
          persistPlaybackState(true, false);
        }}
        onSeeked={() => {
          if (controls) {
            syncTimelineState(true);
          }
          persistPlaybackState(true);
        }}
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
            "absolute bottom-0 left-0 right-0 p-1 transition-opacity duration-300 z-20 flex flex-col gap-1",
            showControls || !isPlaying
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none",
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
              onValueChange={handleSeekPreview}
              onValueCommit={handleSeekCommit}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";
