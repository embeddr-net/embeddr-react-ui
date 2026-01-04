import React, { useCallback, useEffect, useRef, useState } from "react";

interface PannableVideoProps {
  src: string;
  className?: string;
  isOpen?: boolean; // To reset state when reopened
}

export const PannableVideo: React.FC<PannableVideoProps> = ({
  src,
  className,
  isOpen = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Refs for event handlers to access current state without dependencies
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // Reset when src or isOpen changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };
    }
  }, [src, isOpen]);

  // Sync refs
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Center of container
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    // Mouse position relative to center (before zoom)
    // The content is at (cx + pan.x, cy + pan.y)
    // So vector from content center to mouse is:
    // v = (mouseX - (cx + pan.x), mouseY - (cy + pan.y))
    const rx = mouseX - cx - panRef.current.x;
    const ry = mouseY - cy - panRef.current.y;

    const delta = -Math.sign(e.deltaY) * 0.1;
    const newZoom = Math.max(0.1, Math.min(10, zoomRef.current + delta));
    const zoomFactor = newZoom / zoomRef.current;

    // We want the point under the mouse to stay under the mouse.
    // The vector from content center to that point scales by zoomFactor.
    // new_v = v * zoomFactor
    // The new content center (cx + newPan.x, cy + newPan.y) must satisfy:
    // mouse = newCenter + new_v
    // mouse = (cx + newPan) + (mouse - (cx + oldPan)) * zoomFactor
    // ... math ...
    // newPan = mouse - cx - (mouse - cx - oldPan) * zoomFactor

    const newPanX = mouseX - cx - (mouseX - cx - panRef.current.x) * zoomFactor;
    const newPanY = mouseY - cy - (mouseY - cy - panRef.current.y) * zoomFactor;

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
      } else if (e.touches.length === 1 && isDragging) {
        // Only prevent default if we are zoomed in or moved, to allow swipe-to-close if implemented later?
        // For now, prevent default to stop page scroll
        e.preventDefault();
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
    // Only drag if left click
    if (e.button !== 0) return;
    e.preventDefault();
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
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

  // Attach non-React event listeners for wheel/touch to support { passive: false }
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Double click to reset
  const handleDoubleClick = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-black/90 flex items-center justify-center select-none ${
        className || ""
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center",
          transition: isDragging ? "none" : "transform 0.1s ease-out",
          willChange: "transform",
          maxWidth: "100%",
          maxHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          loop
          playsInline
          className="max-w-full max-h-full object-contain pointer-events-auto"
          style={
            {
              // Ensure controls are clickable?
              // If we drag on the video, we might pause it if we click.
              // But we are handling mousedown on the container.
              // The video element is a child.
              // If the user clicks controls, event propagation might be an issue.
              // But native controls are usually in Shadow DOM.
            }
          }
        />
      </div>

      {/* Optional: Overlay controls if we wanted custom ones */}
    </div>
  );
};
