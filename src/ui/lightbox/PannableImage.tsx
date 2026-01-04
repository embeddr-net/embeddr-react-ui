import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { Button } from "../button";
import type { ReactNode } from "react";

export interface PannableImageAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface PannableImageProps {
  src: string;
  mediaType?: "image" | "video";
  className?: string;
  isOpen?: boolean;
  actions?: Array<PannableImageAction>;
  controlsBottomOffset?: number;
}

export const PannableImage = ({
  src,
  mediaType = "image",
  className,
  isOpen,
  actions = [],
  controlsBottomOffset = 16,
}: PannableImageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Draw image on canvas
  const drawImage = useCallback(() => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width === 0 || canvas.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const img = imageRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate fit dimensions
    const r = rotationRef.current;
    const isRotated = (r / 90) % 2 !== 0;

    // Handle video dimensions
    const naturalWidth =
      img instanceof HTMLVideoElement ? img.videoWidth : img.width;
    const naturalHeight =
      img instanceof HTMLVideoElement ? img.videoHeight : img.height;

    if (!naturalWidth || !naturalHeight) return;

    const canvasAspect = canvas.width / canvas.height;
    const imageAspect = isRotated
      ? naturalHeight / naturalWidth
      : naturalWidth / naturalHeight;

    let fitWidth = canvas.width;
    let fitHeight = canvas.height;

    if (imageAspect > canvasAspect) {
      // Image is wider than canvas (relative to aspect)
      fitHeight = canvas.width / imageAspect;
    } else {
      // Image is taller than canvas
      fitWidth = canvas.height * imageAspect;
    }

    // Apply zoom
    const z = zoomRef.current;
    const p = panRef.current;

    // The dimensions of the image as it will be drawn (unrotated)
    const drawWidth = (isRotated ? fitHeight : fitWidth) * z;
    const drawHeight = (isRotated ? fitWidth : fitHeight) * z;

    ctx.save();
    // Move to center of canvas + pan
    ctx.translate(canvas.width / 2 + p.x * dpr, canvas.height / 2 + p.y * dpr);
    ctx.rotate((r * Math.PI) / 180);

    // Draw image centered at 0,0
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }, []);

  // Ensure canvas gets sized correctly once layout stabilizes.
  const ensureCanvasSize = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const dpr = window.devicePixelRatio || 1;
    let attempts = 0;
    const maxAttempts = 60;

    const trySet = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        canvasRef.current.width = rect.width * dpr;
        canvasRef.current.height = rect.height * dpr;
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
        drawImage();
      } else if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(trySet);
      }
    };

    requestAnimationFrame(trySet);
  }, [drawImage]);

  // Resize handler
  const handleResize = useCallback(() => {
    ensureCanvasSize();
  }, [ensureCanvasSize]);

  // Trigger ensureCanvasSize when dialog is opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow dialog animation/layout to settle
      setTimeout(ensureCanvasSize, 50);
      setTimeout(ensureCanvasSize, 200);
    }
  }, [isOpen, ensureCanvasSize]);

  // Load image or video
  useEffect(() => {
    setIsImageLoaded(false);

    // Cleanup previous media
    if (imageRef.current instanceof HTMLVideoElement) {
      imageRef.current.pause();
      imageRef.current.src = "";
      imageRef.current.load();
    }
    imageRef.current = null;

    if (mediaType === "video") {
      const vid = document.createElement("video");
      vid.src = src;
      vid.loop = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.autoplay = true;
      vid.onloadedmetadata = () => {
        imageRef.current = vid;
        setIsImageLoaded(true);
        // Reset zoom/pan on new media
        zoomRef.current = 1;
        setZoom(1);
        panRef.current = { x: 0, y: 0 };
        setPan({ x: 0, y: 0 });
        rotationRef.current = 0;
        setRotation(0);
        handleResize();
        vid.play().catch((e) => console.error("Auto-play failed", e));
      };
    } else {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        imageRef.current = img;
        setIsImageLoaded(true);
        // Reset zoom/pan on new image
        zoomRef.current = 1;
        setZoom(1);
        panRef.current = { x: 0, y: 0 };
        setPan({ x: 0, y: 0 });
        rotationRef.current = 0;
        setRotation(0);
        handleResize();
      };
    }
  }, [src, mediaType, handleResize]);

  // Animation loop for video
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      if (mediaType === "video" && isImageLoaded) {
        drawImage();
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (mediaType === "video" && isImageLoaded) {
      render();
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [mediaType, isImageLoaded, drawImage]);

  // Setup resize observer and window listener
  useEffect(() => {
    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  // Redraw when zoom or pan changes
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
    rotationRef.current = rotation;
    requestAnimationFrame(drawImage);
  }, [zoom, pan, rotation, drawImage]);

  // Mouse wheel zoom (with pivot at cursor)
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    // Center of canvas
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Mouse position relative to center (before zoom)
    const rx = mouseX - cx - panRef.current.x * dpr;
    const ry = mouseY - cy - panRef.current.y * dpr;

    const delta = -Math.sign(e.deltaY) * 0.1;
    const newZoom = Math.max(0.1, Math.min(10, zoomRef.current + delta));
    const zoomFactor = newZoom / zoomRef.current;

    // Adjust pan to keep mouse over same point
    // newRx = rx * zoomFactor
    // newRx = mouseX - cx - newPanX
    // => newPanX = mouseX - cx - rx * zoomFactor
    const newPanX = (mouseX - cx - rx * zoomFactor) / dpr;
    const newPanY = (mouseY - cy - ry * zoomFactor) / dpr;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  // Touch handling
  const [touchState, setTouchState] = useState<{
    isPinching: boolean;
    initialDistance: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    midPoint: { x: number; y: number };
  } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (!t1 || !t2) return;
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      setTouchState({
        isPinching: true,
        initialDistance: dist,
        initialZoom: zoomRef.current,
        initialPan: { ...panRef.current },
        midPoint: { x: midX, y: midY },
      });
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      if (!t) return;
      setDragStart({ x: t.clientX, y: t.clientY });
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 2 && touchState?.isPinching) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        if (!t1 || !t2) return;
        const dist = Math.hypot(
          t1.clientX - t2.clientX,
          t1.clientY - t2.clientY
        );

        const scale = dist / touchState.initialDistance;
        setZoom(Math.max(0.1, Math.min(10, touchState.initialZoom * scale)));

        // Optional: Handle pan during pinch (using midpoint delta)
        // const midX = (t1.clientX + t2.clientX) / 2;
        // const midY = (t1.clientY + t2.clientY) / 2;
        // const dx = midX - touchState.midPoint.x;
        // const dy = midY - touchState.midPoint.y;
        // setPan({
        //   x: touchState.initialPan.x + dx,
        //   y: touchState.initialPan.y + dy
        // });
      } else if (e.touches.length === 1 && isDragging) {
        e.preventDefault(); // Prevent scrolling
        const t = e.touches[0];
        if (!t) return;
        const dx = t.clientX - dragStart.x;
        const dy = t.clientY - dragStart.y;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        setDragStart({ x: t.clientX, y: t.clientY });
      }
    },
    [touchState, isDragging, dragStart]
  );

  const handleTouchEnd = useCallback(() => {
    setTouchState(null);
    setIsDragging(false);
  }, []);

  // Mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Reset view on double click
  const handleDoubleClick = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Passive: false is important for preventing default scroll on touch
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className={`${className} relative h-full w-full overflow-hidden`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className={`w-[100dvw] h-[100dvh] transition-opacity duration-500 ${
          isImageLoaded ? "opacity-100" : "opacity-0"
        } ${isDragging ? "cursor-grabbing" : "cursor-grab"} touch-none`}
      />

      {/* Rotation Controls */}
      <div
        className="absolute left-2 flex items-center gap-2 opacity-0 hover:opacity-100 transition-opacity duration-200 transition-all duration-300 ease-in-out"
        style={{ bottom: `${controlsBottomOffset}px` }}
      >
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setRotation((prev) => (prev - 90) % 360);
          }}
          className="h-8 w-8 bg-background/90 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-primary/20 transition-all duration-200"
          title="Rotate Counter-clockwise"
        >
          <RotateCcw className="w-4 h-4 text-muted-foreground" />
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setRotation((prev) => (prev + 90) % 360);
          }}
          className="h-8 w-8 bg-background/90 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-primary/20 transition-all duration-200"
          title="Rotate Clockwise"
        >
          <RotateCw className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Zoom indicator and Help */}
      <div
        className="absolute right-2 flex items-center gap-2 transition-all duration-300 ease-in-out"
        style={{ bottom: `${controlsBottomOffset}px` }}
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

        <div className="h-8 ring-1 ring-foreground/10 bg-background/90 backdrop-blur-sm px-3 py-1.5  text-xs text-muted-foreground pointer-events-none border border-border/50 transition-opacity duration-0 items-center justify-center flex">
          {Math.round(zoom * 100)}%
        </div>

        {/* Help icon */}
        <div className="relative">
          <div
            onMouseEnter={() => setShowHelp(true)}
            onMouseLeave={() => setShowHelp(false)}
            className="w-8 h-8 ring-1 ring-foreground/10 bg-background/90 backdrop-blur-sm  border border-border/50 flex items-center justify-center cursor-help transition-all duration-0 hover:bg-primary/20"
          >
            <span className="text-xs text-muted-foreground font-medium">?</span>
          </div>

          {/* Help tooltip */}
          {showHelp && (
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-background/95 backdrop-blur-sm border border-border  p-3 text-xs text-muted-foreground shadow-lg">
              <div className="space-y-1">
                <div>
                  <span className="text-foreground">Scroll/Pinch:</span> Zoom
                  in/out
                </div>
                <div>
                  <span className="text-foreground">Drag:</span> Pan around
                  image
                </div>
                <div>
                  <span className="text-foreground">Double-click:</span> Reset
                  view
                </div>
                <div>
                  <span className="text-foreground">Escape:</span> Close dialog
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
