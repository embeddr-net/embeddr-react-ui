import React, { useEffect, useRef, useState } from "react";

export interface ComparisonSliderProps {
  before: string;
  after: string;
  className?: string;
}

export function ComparisonSlider({
  before,
  after,
  className,
}: ComparisonSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const topImageRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(50);

  const updatePosition = (clientX: number) => {
    if (containerRef.current && handleRef.current && topImageRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));

      positionRef.current = percent;
      handleRef.current.style.left = `${percent}%`;
      topImageRef.current.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updatePosition(e.clientX);
  };
  const onTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    if (e.touches && e.touches[0]) {
      updatePosition(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    const onMouseUp = () => setIsDragging(false);
    const onTouchEnd = () => setIsDragging(false);

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        requestAnimationFrame(() => updatePosition(e.clientX));
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        if (e.touches && e.touches[0]) {
          const clientX = e.touches[0].clientX;
          requestAnimationFrame(() => updatePosition(clientX));
        }
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full select-none overflow-hidden bg-black/5 touch-none cursor-ew-resize ${
        className || ""
      }`}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <img
        src={after}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
        alt="After"
      />
      <div
        ref={topImageRef}
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ clipPath: `inset(0 50% 0 0)` }}
      >
        <img
          src={before}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
          alt="Before"
        />
      </div>
      <div
        ref={handleRef}
        className="absolute top-0 bottom-0 w-0.5 bg-background/40 cursor-ew-resize z-10 hover:bg-primary transition-colors"
        style={{ left: `50%` }}
      ></div>
    </div>
  );
}
