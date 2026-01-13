import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { Card } from "./card";
import { PanelHeader } from "./panel/PanelHeader";
import { ResizeHandle } from "./panel/ResizeHandle";

// --- Context & Hook for Panel State ---

export interface PanelState {
  id?: string;
  isActive: boolean;
  isCollapsed: boolean;
  isPinned: boolean;
  isFullscreen: boolean; // Reserved for future
  title: string;
  close: () => void;
  collapse: (collapsed?: boolean) => void;
  pin: (pinned?: boolean) => void;
  focus: () => void;
}

const PanelContext = React.createContext<PanelState | null>(null);

export function usePanel() {
  const context = React.useContext(PanelContext);
  if (!context) {
    throw new Error("usePanel must be used within a DraggablePanel");
  }
  return context;
}

export interface DraggablePanelProps {
  id?: string;
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
  onPositionChange?: (pos: { x: number; y: number }) => void;
  size?: { width: number; height: number };
  onSizeChange?: (size: { width: number; height: number }) => void;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  className?: string;
  minWidth?: number;
  minHeight?: number;
  pinned?: boolean;
  onPinChange?: (pinned: boolean) => void;
  onDragEnd?: () => void;
  onResizeEnd?: () => void;
  zIndex?: number;
  onFocus?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  showTitle?: boolean;
  onShowTitleChange?: (show: boolean) => void;
  hideHeader?: boolean;
  transparent?: boolean;
  isActive?: boolean;
  onMinimize?: () => void;
  /**
   * Additional items to be rendered in the settings menu.
   * Can be used to inject custom actions like "Set as Backdrop".
   */
  additionalSettingsItems?: React.ReactNode;
  /**
   * @deprecated use additionalSettingsItems
   */
  headerEndContent?: React.ReactNode;
}

interface AnchorState {
  anchorX: "left" | "right" | "center";
  anchorY: "top" | "bottom" | "center";
  offsetX: number;
  offsetY: number;
}

export function DraggablePanel({
  id,
  title,
  children,
  isOpen,
  onClose,
  position: controlledPosition,
  onPositionChange: controlledOnPositionChange,
  size: controlledSize,
  onSizeChange: controlledOnSizeChange,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 300, height: 200 },
  className,
  minWidth = 200,
  minHeight = 150,
  pinned = false,
  onPinChange,
  onDragEnd,
  zIndex,
  onFocus,
  onMouseDown,
  onMinimize,
  showTitle: controlledShowTitle,
  onShowTitleChange,
  hideHeader = false,
  transparent = false,
  isActive = false,
  headerEndContent,
  additionalSettingsItems,
  onResizeEnd,
}: DraggablePanelProps) {
  // Internal state for uncontrolled mode
  const [internalPosition, setInternalPosition] = useLocalStorage(
    id ? `panel-${id}-position` : "temp-panel-position",
    defaultPosition
  );
  const [internalSize, setInternalSize] = useLocalStorage(
    id ? `panel-${id}-size` : "temp-panel-size",
    defaultSize
  );

  // Persistent Anchor State
  const [anchorState, setAnchorState] = useLocalStorage<AnchorState>(
    id ? `panel-${id}-anchor` : "temp-panel-anchor",
    {
      anchorX: "left",
      anchorY: "top",
      offsetX: defaultPosition.x,
      offsetY: defaultPosition.y,
    }
  );

  const position = controlledPosition || internalPosition;
  const size = controlledSize || internalSize;

  const onPositionChange = useCallback(
    (pos: { x: number; y: number }) => {
      if (controlledOnPositionChange) {
        controlledOnPositionChange(pos);
      } else {
        setInternalPosition(pos);
      }
    },
    [controlledOnPositionChange, setInternalPosition]
  );

  const onSizeChange = (s: { width: number; height: number }) => {
    if (controlledOnSizeChange) {
      controlledOnSizeChange(s);
    } else {
      setInternalSize(s);
    }
  };
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isFolded, setIsFolded] = useState(false);
  const [titlePosition, setTitlePosition] = useState<"top" | "bottom">("top");
  const [internalShowTitle, setInternalShowTitle] = useState(true);

  const showTitle = hideHeader
    ? false
    : controlledShowTitle ?? internalShowTitle;

  const setShowTitle = (show: boolean) => {
    // If we're toggling the title, we want the panel to grow/shrink
    // instead of the content container expanding/contracting to fill a fixed card height.
    if (show !== showTitle && !isFolded) {
      const HEADER_HEIGHT = 41;
      if (show) {
        onSizeChange({ ...size, height: size.height + HEADER_HEIGHT });
      } else {
        onSizeChange({
          ...size,
          height: Math.max(minHeight, size.height - HEADER_HEIGHT),
        });
      }
    }
    setInternalShowTitle(show);
    onShowTitleChange?.(show);
  };

  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });
  const initialSizeRef = useRef({ width: 0, height: 0 });

  // Refs for logic that needs current values without re-triggering effects
  const positionRef = useRef(position);
  const sizeRef = useRef(size);
  const anchorStateRef = useRef(anchorState);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(() => {
    anchorStateRef.current = anchorState;
  }, [anchorState]);

  // Sync offsets when position changes externally
  useEffect(() => {
    if (isInteractingRef.current) return;
    if (position) {
      const currentPos = positionRef.current;
      const currentSize = sizeRef.current;
      const currentAnchor = anchorStateRef.current;

      const deltaX = Math.abs(position.x - currentPos.x);
      const deltaY = Math.abs(position.y - currentPos.y);

      // Only update offsets if significant change (avoiding rounding loops)
      if (deltaX > 2 || deltaY > 2) {
        let newOffsetX = position.x;
        let newOffsetY = position.y;
        const { innerWidth, innerHeight } = window;

        // X Axis
        if (currentAnchor.anchorX === "right") {
          newOffsetX = innerWidth - currentSize.width - position.x;
        } else if (currentAnchor.anchorX === "center") {
          newOffsetX = position.x - (innerWidth - currentSize.width) / 2;
        }

        // Y Axis
        if (currentAnchor.anchorY === "bottom") {
          newOffsetY = innerHeight - currentSize.height - position.y;
        } else if (currentAnchor.anchorY === "center") {
          newOffsetY = position.y - (innerHeight - currentSize.height) / 2;
        }

        setAnchorState((prev) => ({
          ...prev,
          offsetX: newOffsetX,
          offsetY: newOffsetY,
        }));
      }
    }
  }, [position, setAnchorState]); // Depend on position object identity

  // Handle Window Resize - Anchor Logic
  useEffect(() => {
    let resizeTimer: any;
    const handleResize = () => {
      if (isInteractingRef.current) return;

      const { innerWidth, innerHeight } = window;
      const { anchorX, anchorY, offsetX, offsetY } = anchorStateRef.current;
      const { width, height } = sizeRef.current;

      let x = 0;
      let y = 0;

      if (anchorX === "left") x = offsetX;
      else if (anchorX === "right") x = innerWidth - width - offsetX;
      else x = (innerWidth - width) / 2 + offsetX;

      if (anchorY === "top") y = offsetY;
      else if (anchorY === "bottom") y = innerHeight - height - offsetY;
      else y = (innerHeight - height) / 2 + offsetY;

      // Ensure basic bounds
      x = Math.max(0, Math.min(x, innerWidth - width));
      y = Math.max(0, Math.min(y, innerHeight - height));

      onPositionChange({ x, y });

      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Redundant safe update after resize stops
        onPositionChange({ x, y });
      }, 200);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [onPositionChange]);

  useEffect(() => {
    if (isOpen) {
      // Ensure panel is within viewport when opened
      const { innerWidth, innerHeight } = window;
      onPositionChange({
        x: Math.min(Math.max(0, position.x), innerWidth - size.width),
        y: Math.min(Math.max(0, position.y), innerHeight - size.height),
      });
    }
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    onFocus?.();
    if (pinned) return;
    const target = e.target as HTMLElement;
    if (
      target instanceof HTMLButtonElement ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest(".resize-handle") ||
      target.closest(".no-drag")
    ) {
      return;
    }
    e.preventDefault(); // Prevent text selection and other default behaviors
    setIsDragging(true);
    isInteractingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...position };
  };

  const toggleFold = () => {
    const newFolded = !isFolded;
    setIsFolded(newFolded);

    if (titlePosition === "bottom") {
      // Estimate header height (p-2 = 8px*2 + h-6 = 24px + border = ~41px)
      const HEADER_HEIGHT = 41;
      const delta = size.height - HEADER_HEIGHT;

      if (newFolded) {
        // Folding: Move top DOWN so bottom stays fixed
        onPositionChange({ ...position, y: position.y + delta });
      } else {
        // Unfolding: Move top UP so bottom stays fixed
        onPositionChange({ ...position, y: position.y - delta });
      }
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocus?.();
    if (pinned) return;
    setIsResizing(true);
    isInteractingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialSizeRef.current = { ...size };
  };

  const handleInteractionEnd = () => {
    const { innerWidth, innerHeight } = window;
    const { x, y } = positionRef.current;
    const { width, height } = sizeRef.current;

    let anchorX: AnchorState["anchorX"] = "left";
    let offsetX = x;
    const SNAP = 50;

    if (x < SNAP) {
      anchorX = "left";
      offsetX = x;
    } else if (x > innerWidth - width - SNAP) {
      anchorX = "right";
      offsetX = innerWidth - width - x;
    } else {
      if (x > innerWidth / 2) {
        anchorX = "right";
        offsetX = innerWidth - width - x;
      } else {
        anchorX = "left";
        offsetX = x;
      }
    }

    let anchorY: AnchorState["anchorY"] = "top";
    let offsetY = y;

    if (y < SNAP) {
      anchorY = "top";
      offsetY = y;
    } else if (y > innerHeight - height - SNAP) {
      anchorY = "bottom";
      offsetY = innerHeight - height - y;
    } else {
      // Middle of screen logic could be improved, but defaults to top/bottom
      if (y > innerHeight / 2) {
        anchorY = "bottom";
        offsetY = innerHeight - height - y;
      } else {
        anchorY = "top";
        offsetY = y;
      }
    }

    setAnchorState({
      anchorX,
      anchorY,
      offsetX,
      offsetY,
    });

    isInteractingRef.current = false;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        onPositionChange({
          x: initialPosRef.current.x + dx,
          y: initialPosRef.current.y + dy,
        });
      } else if (isResizing) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        onSizeChange({
          width: Math.max(minWidth, initialSizeRef.current.width + dx), // Keep minWidth
          height: Math.max(minHeight, initialSizeRef.current.height + dy),
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        onDragEnd?.();
        handleInteractionEnd();
      }
      if (isResizing) {
        onResizeEnd?.();
        handleInteractionEnd();
      }
      setIsDragging(false);
      setIsResizing(false);
      // isInteractingRef.current set to false in handleInteractionEnd
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.classList.add("embeddr-panel-interacting");
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("embeddr-panel-interacting");
    };
  }, [
    isDragging,
    isResizing,
    minWidth,
    minHeight,
    onPositionChange,
    onSizeChange,
    onDragEnd,
    onResizeEnd,
  ]);

  if (!isOpen) return null;

  const contextValue: PanelState = {
    id,
    isActive,
    isCollapsed: isFolded,
    isPinned: !!pinned,
    isFullscreen: false,
    title,
    close: onClose,
    collapse: (v) => setIsFolded(v ?? !isFolded),
    pin: (v) => onPinChange?.(v ?? !pinned),
    focus: () => onFocus?.(),
  };

  // If title is hidden, we show a small drag handle on hover or right click area
  const hiddenTitleHandle = (!showTitle || hideHeader) && (
    <div
      className={cn(
        "absolute top-0 left-0 right-0 h-3 z-50 cursor-move transition-colors",
        !transparent && "hover:bg-primary/20"
      )}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        if (!hideHeader) {
          e.preventDefault();
          setShowTitle(true);
        }
      }}
      title={hideHeader ? "Drag to move" : "Right click to show title"}
    />
  );

  return (
    <Card
      ref={panelRef}
      className={cn(
        "select-none fixed flex shadow-xl border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-colors duration-200 rounded-none!",
        "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-1 focus-visible:border-primary/30",
        transparent &&
          "bg-transparent border-none shadow-none backdrop-blur-none",
        titlePosition === "bottom" ? "flex-col-reverse" : "flex-col",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isFolded ? "auto" : size.height,
        zIndex: zIndex ?? 50,
      }}
      onMouseDown={(e) => {
        onFocus?.();
        onMouseDown?.(e);

        // Auto-focus panel on click to handle global focus management
        // (unless clicking an input/interactive element)
        const target = e.target as HTMLElement;
        const isInteractive = target.closest(
          'input, textarea, select, button, [contenteditable="true"]'
        );
        if (!isInteractive) {
          panelRef.current?.focus();
        }

        if (hideHeader) {
          handleMouseDown(e);
        }
      }}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
      tabIndex={-1}
    >
      {hiddenTitleHandle}

      {showTitle && !hideHeader && (
        <PanelHeader
          title={title}
          pinned={!!pinned}
          titlePosition={titlePosition}
          showTitle={showTitle}
          isFolded={isFolded}
          transparent={transparent}
          additionalSettingsItems={additionalSettingsItems || headerEndContent}
          onPinChange={onPinChange}
          onTitlePositionChange={setTitlePosition}
          onShowTitleChange={setShowTitle}
          onMinimize={onMinimize}
          onFoldToggle={toggleFold}
          onClose={onClose}
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Content */}
      {!isFolded && (
        <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
          <PanelContext.Provider value={contextValue}>
            {children}
          </PanelContext.Provider>
        </div>
      )}

      {/* Resize Handle */}
      {!isFolded && (
        <ResizeHandle
          transparent={transparent}
          onMouseDown={handleResizeStart}
        />
      )}

      {/* Global Interaction Shield - Prevents jitter from other elements reacting to mouse while dragging/resizing */}
      {(isDragging || isResizing) &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] pointer-events-auto select-none overflow-hidden"
            style={{
              cursor: isDragging ? "move" : "nwse-resize",
              backgroundColor: "transparent",
            }}
          />,
          document.body
        )}
    </Card>
  );
}
