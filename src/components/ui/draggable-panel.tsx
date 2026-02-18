import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { useLocalStorage } from "../../hooks/useLocalStorage";
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
  hideHeader: boolean;
  showTitle: boolean;
  isHeaderHidden: boolean;
  headerHeight: number;
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
  titleIcon?: React.ReactNode;
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
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  showTitle?: boolean;
  onShowTitleChange?: (show: boolean) => void;
  hideHeader?: boolean;
  transparent?: boolean;
  isActive?: boolean;
  onMinimize?: () => void;
  additionalSettingsItems?: React.ReactNode;
  mergeActive?: boolean;
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
  titleIcon,
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
  onMouseEnter,
  onMouseLeave,
  onMinimize,
  showTitle: controlledShowTitle,
  onShowTitleChange,
  hideHeader = false,
  transparent = false,
  isActive = false,
  headerEndContent,
  additionalSettingsItems,
  mergeActive,
  onResizeEnd,
}: DraggablePanelProps) {
  // Internal state for uncontrolled mode
  const [internalPosition, setInternalPosition] = useLocalStorage(
    id ? `panel-${id}-position` : "temp-panel-position",
    defaultPosition,
  );
  const [internalSize, setInternalSize] = useLocalStorage(
    id ? `panel-${id}-size` : "temp-panel-size",
    defaultSize,
  );

  // NOTE: 'position' now physically represents the Title Header's Top-Left coordinate.
  // This simplifies folding logic (no position jumping needed) but requires
  // visual correction during render for bottom-title panels.

  // Persistent Anchor State
  const [anchorState, setAnchorState] = useLocalStorage<AnchorState>(
    id ? `panel-${id}-anchor` : "temp-panel-anchor",
    {
      anchorX: "left",
      anchorY: "top",
      offsetX: defaultPosition.x,
      offsetY: defaultPosition.y,
    },
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
    [controlledOnPositionChange, setInternalPosition],
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
  const [isFolded, setIsFolded] = useLocalStorage(
    id ? `panel-${id}-folded` : "temp-panel-folded",
    false,
  );
  const [titlePosition, setTitlePosition] = useLocalStorage<"top" | "bottom">(
    id ? `panel-${id}-title-position` : "temp-panel-title-position",
    "top",
  );
  const [internalShowTitle, setInternalShowTitle] = useLocalStorage(
    id ? `panel-${id}-show-title` : "temp-panel-show-title",
    true,
  );

  const showTitle = hideHeader
    ? false
    : (controlledShowTitle ?? internalShowTitle);

  // Forced height in PanelHeader is h-[42px]
  const headerHeight = hideHeader || !showTitle ? 16 : 42;

  const setShowTitle = (show: boolean) => {
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
  // NOTE: Logic assumes position refers to the Header Top-Left
  useEffect(() => {
    if (isInteractingRef.current) return;
    const { x, y } = positionRef.current;
    // We update anchor offsets based on current position
    // To avoid loops, you might want to check delta, but typically safe if consistent.
    const { innerWidth, innerHeight } = window;
    const { anchorX, anchorY } = anchorStateRef.current;
    const { width } = sizeRef.current;

    let newOffsetX = x;
    let newOffsetY = y;

    if (anchorX === "right") newOffsetX = innerWidth - width - x;
    else if (anchorX === "center") newOffsetX = x - (innerWidth - width) / 2;

    if (anchorY === "bottom") newOffsetY = innerHeight - y;
    else if (anchorY === "center") newOffsetY = y - innerHeight / 2;

    // Only update if changed effectively to reduce render cycles
    const prev = anchorStateRef.current;
    if (
      Math.abs(prev.offsetX - newOffsetX) > 2 ||
      Math.abs(prev.offsetY - newOffsetY) > 2
    ) {
      setAnchorState((p) => ({
        ...p,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      }));
    }
  }, [position, size.width, size.height, setAnchorState]);

  // Handle Window Resize - Anchor Logic
  useEffect(() => {
    const handleResize = () => {
      if (isInteractingRef.current) return;

      const { innerWidth, innerHeight } = window;
      const { anchorX, anchorY, offsetX, offsetY } = anchorStateRef.current;
      const { width } = sizeRef.current;

      let x = 0;
      let y = 0;

      if (anchorX === "left") x = offsetX;
      else if (anchorX === "right") x = innerWidth - width - offsetX;
      else x = (innerWidth - width) / 2 + offsetX;

      if (anchorY === "top") y = offsetY;
      else if (anchorY === "bottom") y = innerHeight - offsetY;
      else y = innerHeight / 2 + offsetY;

      // Ensure basic bounds (header stays on screen)
      x = Math.max(0, Math.min(x, innerWidth - width));
      y = Math.max(0, Math.min(y, innerHeight - headerHeight));

      onPositionChange({ x, y });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [onPositionChange, headerHeight]);

  useEffect(() => {
    if (isOpen) {
      // Ensure panel header is within viewport when opened
      const { innerWidth, innerHeight } = window;
      onPositionChange({
        x: Math.min(Math.max(0, position.x), innerWidth - size.width),
        y: Math.min(Math.max(0, position.y), innerHeight - headerHeight),
      });
    }
  }, [isOpen]);

  // ── helpers to start drag / resize from either mouse or touch ──
  const beginDrag = useCallback(
    (clientX: number, clientY: number, isTouch: boolean) => {
      onFocus?.();
      if (pinned) return;

      dragStartRef.current = { x: clientX, y: clientY };
      initialPosRef.current = { ...positionRef.current };

      const commitDrag = () => {
        setIsDragging(true);
        isInteractingRef.current = true;
        window.dispatchEvent(
          new CustomEvent("zen-panel-drag-start", {
            detail: { windowId: id },
          }),
        );
      };

      if (isTouch) {
        // For touch we need a small threshold before committing to the drag
        const handleTouchMove = (ev: TouchEvent) => {
          const t = ev.touches[0];
          if (!t) return;
          const dx = Math.abs(t.clientX - dragStartRef.current.x);
          const dy = Math.abs(t.clientY - dragStartRef.current.y);
          if (dx > 3 || dy > 3) {
            ev.preventDefault(); // prevent scroll once we commit to drag
            commitDrag();
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleTouchEnd);
          }
        };
        const handleTouchEnd = () => {
          window.removeEventListener("touchmove", handleTouchMove);
          window.removeEventListener("touchend", handleTouchEnd);
        };
        window.addEventListener("touchmove", handleTouchMove, {
          passive: false,
        });
        window.addEventListener("touchend", handleTouchEnd);
      } else {
        const handleInitialMove = (moveEvent: MouseEvent) => {
          const dx = Math.abs(moveEvent.clientX - dragStartRef.current.x);
          const dy = Math.abs(moveEvent.clientY - dragStartRef.current.y);
          if (dx > 3 || dy > 3) {
            commitDrag();
            window.removeEventListener("mousemove", handleInitialMove);
            window.removeEventListener("mouseup", handleInitialUp);
          }
        };
        const handleInitialUp = () => {
          window.removeEventListener("mousemove", handleInitialMove);
          window.removeEventListener("mouseup", handleInitialUp);
        };
        window.addEventListener("mousemove", handleInitialMove);
        window.addEventListener("mouseup", handleInitialUp);
      }
    },
    [pinned, onFocus, id],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(
          "button, input, textarea, select, .resize-handle, .no-drag",
        )
      ) {
        return;
      }
      beginDrag(e.clientX, e.clientY, false);
    },
    [beginDrag],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          "button, input, textarea, select, .resize-handle, .no-drag",
        )
      ) {
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      beginDrag(t.clientX, t.clientY, true);
    },
    [beginDrag],
  );

  const beginResize = useCallback(
    (clientX: number, clientY: number) => {
      onFocus?.();
      if (pinned) return;
      setIsResizing(true);
      isInteractingRef.current = true;
      dragStartRef.current = { x: clientX, y: clientY };
      initialSizeRef.current = { ...sizeRef.current };
    },
    [pinned, onFocus],
  );

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    beginResize(e.clientX, e.clientY);
  };

  const handleResizeTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      const t = e.touches[0];
      if (!t) return;
      beginResize(t.clientX, t.clientY);
    },
    [beginResize],
  );

  const handleInteractionEnd = () => {
    const { innerWidth, innerHeight } = window;
    const { x, y } = positionRef.current;

    // Auto-Anchor Logic
    let anchorX: AnchorState["anchorX"] = "left";
    let offsetX = x;
    const SNAP = 50;

    if (x < SNAP) {
      anchorX = "left";
      offsetX = x;
    } else if (x > innerWidth - sizeRef.current.width - SNAP) {
      anchorX = "right";
      offsetX = innerWidth - sizeRef.current.width - x;
    } else if (x > innerWidth / 2) {
      anchorX = "right";
      offsetX = innerWidth - sizeRef.current.width - x;
    } else {
      anchorX = "left";
      offsetX = x;
    }

    let anchorY: AnchorState["anchorY"] = "top";
    let offsetY = y;

    if (y < SNAP) {
      anchorY = "top";
      offsetY = y;
    } else if (y > innerHeight - headerHeight - SNAP) {
      // Near bottom edge
      anchorY = "bottom";
      offsetY = innerHeight - y;
    } else {
      // Just split screen vertically
      if (y > innerHeight / 2) {
        anchorY = "bottom";
        offsetY = innerHeight - y;
      } else {
        anchorY = "top";
        offsetY = y;
      }
    }

    setAnchorState({ anchorX, anchorY, offsetX, offsetY });
    isInteractingRef.current = false;
  };

  useEffect(() => {
    // Shared move handler for mouse & touch
    const applyMove = (clientX: number, clientY: number) => {
      if (isDragging) {
        const dx = clientX - dragStartRef.current.x;
        const dy = clientY - dragStartRef.current.y;
        onPositionChange({
          x: initialPosRef.current.x + dx,
          y: initialPosRef.current.y + dy,
        });
      } else if (isResizing) {
        const dx = clientX - dragStartRef.current.x;
        const dy = clientY - dragStartRef.current.y;
        onSizeChange({
          width: Math.max(minWidth, initialSizeRef.current.width + dx),
          height: Math.max(minHeight, initialSizeRef.current.height + dy),
        });
      }
    };

    const endInteraction = () => {
      if (isDragging) {
        window.dispatchEvent(
          new CustomEvent("zen-panel-drag-end", {
            detail: { windowId: id },
          }),
        );
        onDragEnd?.();
        handleInteractionEnd();
      }
      if (isResizing) {
        onResizeEnd?.();
        handleInteractionEnd();
      }
      setIsDragging(false);
      setIsResizing(false);
    };

    const handleMouseMove = (e: MouseEvent) => applyMove(e.clientX, e.clientY);
    const handleMouseUp = () => endInteraction();

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // prevent scroll while dragging/resizing
      const t = e.touches[0];
      if (!t) return;
      applyMove(t.clientX, t.clientY);
    };
    const handleTouchEnd = () => endInteraction();

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
      document.body.classList.add("embeddr-panel-interacting");
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
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

  // KEY FIX: Calculate visual top.
  // If title is bottom AND we are NOT folded (so content is visible),
  // we shift the DIV up so the header lands at `position.y`.
  // We add +2 to account for the top and bottom borders of the container (1px each).
  const visualY =
    !isFolded && titlePosition === "bottom"
      ? position.y - (size.height - headerHeight) + 2
      : position.y;

  const contextValue: PanelState = {
    id,
    isActive,
    isCollapsed: isFolded,
    isPinned: !!pinned,
    isFullscreen: false,
    title,
    hideHeader,
    showTitle,
    isHeaderHidden: hideHeader || !showTitle,
    headerHeight,
    close: onClose,
    collapse: (v) => setIsFolded(v ?? !isFolded),
    pin: (v) => onPinChange?.(v ?? !pinned),
    focus: () => onFocus?.(),
  };

  const hiddenTitleHandle = (!showTitle || hideHeader) && (
    <div
      className={cn(
        "embeddr-panel-hidden-title-handle absolute top-0 left-0 right-0 h-3 z-50 cursor-move transition-colors",
        !transparent && "hover:bg-primary/20",
        isFolded && "h-4 bg-primary/10",
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={() => {
        if (!hideHeader) setShowTitle(true);
        setIsFolded(!isFolded);
      }}
      onContextMenu={(e) => {
        // Always allow showing context menu if header is missing but not legally disabled
        if (!hideHeader) {
          e.preventDefault();
          // Directly show title on right-click
          setShowTitle(true);
        }
      }}
      title="Drag to move | Double-click to fold | Right-click to show Header"
    />
  );

  return (
    <div
      ref={panelRef}
      data-panel-role="panel"
      data-panel-id={id}
      data-panel-title={title}
      data-panel-header-hidden={hideHeader || !showTitle}
      data-panel-active={isActive ? "true" : "false"}
      data-panel-interacting={isDragging || isResizing ? "true" : "false"}
      className={cn(
        "embeddr-panel-shell select-none fixed flex shadow-xl border bg-background/95  supports-backdrop-filter:bg-background/60 transition-colors duration-200 rounded-lg overflow-hidden",
        "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border focus-visible:border-primary/30",
        isActive ? "embeddr-panel-active" : "embeddr-panel-inactive",
        (isDragging || isResizing) && "embeddr-panel-interacting",
        transparent &&
          "bg-transparent border-none shadow-none backdrop-blur-none",
        titlePosition === "bottom" ? "flex-col-reverse" : "flex-col",
        className,
      )}
      style={{
        left: position.x,
        top: visualY,
        width: size.width,
        height: isFolded ? "auto" : size.height,
        zIndex: zIndex ?? 50,
        minHeight: isFolded && (!showTitle || hideHeader) ? "1rem" : undefined,
      }}
      onMouseDown={(e) => {
        onFocus?.();
        onMouseDown?.(e);

        const target = e.target as HTMLElement;
        const isInteractive = target.closest(
          'input, textarea, select, button, [contenteditable="true"]',
        );
        if (!isInteractive) {
          panelRef.current?.focus();
        }

        if (hideHeader && target === e.currentTarget) {
          handleMouseDown(e);
        }
      }}
      onTouchStart={(e) => {
        onFocus?.();
        const target = e.target as HTMLElement;
        if (hideHeader && target === e.currentTarget) {
          handleTouchStart(e);
        }
      }}
      onMouseEnter={(e) => {
        e.stopPropagation();
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        onMouseLeave?.(e);
      }}
      tabIndex={-1}
    >
      {hiddenTitleHandle}

      {showTitle && !hideHeader && (
        <PanelHeader
          title={title}
          titleIcon={titleIcon}
          panelId={id}
          mergeActive={mergeActive}
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
          onFoldToggle={() => setIsFolded(!isFolded)}
          onClose={onClose}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
      )}

      {/* Content */}
      {!isFolded && (
        <div
          className="embeddr-panel-body flex-1 min-h-0 overflow-auto overscroll-contain relative flex flex-col pointer-events-auto touch-pan-y"
          onWheel={(event) => {
            event.stopPropagation();
          }}
        >
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
          onTouchStart={handleResizeTouchStart}
        />
      )}

      {/* Global Interaction Shield */}
      {(isDragging || isResizing) &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-99999 pointer-events-auto select-none overflow-hidden"
            style={{
              cursor: isDragging ? "move" : "nwse-resize",
              backgroundColor: "transparent",
              touchAction: "none",
            }}
          />,
          document.body,
        )}
    </div>
  );
}
