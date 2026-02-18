import React from "react";
import { cn } from "../../../lib/utils";

interface ResizeHandleProps {
  transparent?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  className?: string;
}

export function ResizeHandle({
  transparent,
  onMouseDown,
  onTouchStart,
  className,
}: ResizeHandleProps) {
  return (
    <div
      className={cn(
        "embeddr-panel-resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize resize-handle flex items-center justify-center z-50",
        transparent
          ? "opacity-0 hover:opacity-100"
          : "opacity-50 hover:opacity-100",
        className,
      )}
      style={{ touchAction: "none" }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div className="w-2 h-2 border-r-2 border-b-2 border-foreground/50" />
    </div>
  );
}
