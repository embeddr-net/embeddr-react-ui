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

export const PanelContext = React.createContext<PanelState | null>(null);

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
  openRevision?: number;
  resetUiOnOpen?: boolean;
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

const PANEL_DEBUG_FLAG = "embeddr_debug_panels";
const PANEL_DEBUG_EVENT = "embeddr-panel-debug";

type PanelDebugPhase =
  | "panel-open"
  | "panel-close"
  | "drag-threshold-start"
  | "drag-commit"
  | "drag-end"
  | "drag-cancel"
  | "resize-start"
  | "resize-end"
  | "interaction-force-cancel"
  | "fold-toggle-request"
  | "fold-toggle-apply"
  | "fold-state-changed";

function isPanelDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PANEL_DEBUG_FLAG) === "1";
  } catch {
    return false;
  }
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
  openRevision,
  resetUiOnOpen = false,
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
  const isPositionControlled = controlledPosition !== undefined;

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

  const setShowTitle = useCallback(
    (show: boolean) => {
      setInternalShowTitle(show);
      onShowTitleChange?.(show);
    },
    [onShowTitleChange, setInternalShowTitle],
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });
  const initialSizeRef = useRef({ width: 0, height: 0 });
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingStartCleanupRef = useRef<(() => void) | null>(null);
  const cancelingInteractionRef = useRef(false);
  const isDraggingRef = useRef(isDragging);
  const isResizingRef = useRef(isResizing);
  const isFoldedRef = useRef(isFolded);
  const showTitleRef = useRef(showTitle);
  const titlePositionRef = useRef(titlePosition);

  // Refs for logic that needs current values without re-triggering effects
  const positionRef = useRef(position);
  const sizeRef = useRef(size);
  const anchorStateRef = useRef(anchorState);
  const isInteractingRef = useRef(false);
  const lastHandledOpenRevisionRef = useRef<number | null>(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(() => {
    anchorStateRef.current = anchorState;
  }, [anchorState]);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);
  useEffect(() => {
    isResizingRef.current = isResizing;
  }, [isResizing]);
  useEffect(() => {
    isFoldedRef.current = isFolded;
  }, [isFolded]);
  useEffect(() => {
    showTitleRef.current = showTitle;
  }, [showTitle]);
  useEffect(() => {
    titlePositionRef.current = titlePosition;
  }, [titlePosition]);

  const emitPanelDebug = useCallback(
    (phase: PanelDebugPhase, extra?: Record<string, unknown>) => {
      if (!isPanelDebugEnabled()) return;

      const detail = {
        ts: Date.now(),
        phase,
        id: id ?? "temp-panel",
        title,
        isOpen,
        isDragging: isDraggingRef.current,
        isResizing: isResizingRef.current,
        isFolded: isFoldedRef.current,
        showTitle: showTitleRef.current,
        titlePosition: titlePositionRef.current,
        pendingStart: pendingStartCleanupRef.current !== null,
        position: positionRef.current,
        size: sizeRef.current,
        anchor: anchorStateRef.current,
        ...extra,
      };

      window.dispatchEvent(new CustomEvent(PANEL_DEBUG_EVENT, { detail }));
      console.debug(`[PanelDebug:${detail.id}] ${phase}`, detail);
    },
    [id, isOpen, title],
  );

  const clearPendingStartListeners = useCallback(() => {
    pendingStartCleanupRef.current?.();
    pendingStartCleanupRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearPendingStartListeners();
    };
  }, [clearPendingStartListeners]);

  useEffect(() => {
    if (!resetUiOnOpen || openRevision == null) return;

    if (lastHandledOpenRevisionRef.current == null) {
      lastHandledOpenRevisionRef.current = openRevision;
      return;
    }

    if (lastHandledOpenRevisionRef.current === openRevision) {
      return;
    }

    lastHandledOpenRevisionRef.current = openRevision;
    setIsFolded(false);
    if (!hideHeader) {
      setShowTitle(true);
    }
  }, [hideHeader, openRevision, resetUiOnOpen, setIsFolded, setShowTitle]);

  useEffect(() => {
    emitPanelDebug(isOpen ? "panel-open" : "panel-close", {
      openRevision,
      resetUiOnOpen,
    });
  }, [emitPanelDebug, isOpen, openRevision, resetUiOnOpen]);

  useEffect(() => {
    emitPanelDebug("fold-state-changed");
  }, [emitPanelDebug, isFolded]);

  // Sync offsets when position changes externally
  // NOTE: Logic assumes position refers to the Header Top-Left
  useEffect(() => {
    if (isPositionControlled) return;
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
  }, [isPositionControlled, position, size.width, size.height, setAnchorState]);

  // Handle Window Resize - Anchor Logic
  useEffect(() => {
    if (isPositionControlled) return;
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
  }, [headerHeight, isPositionControlled, onPositionChange]);

  useEffect(() => {
    if (isPositionControlled) return;
    if (isOpen) {
      // Ensure panel header is within viewport when opened
      const { innerWidth, innerHeight } = window;
      onPositionChange({
        x: Math.min(Math.max(0, position.x), innerWidth - size.width),
        y: Math.min(Math.max(0, position.y), innerHeight - headerHeight),
      });
    }
  }, [
    headerHeight,
    isOpen,
    isPositionControlled,
    onPositionChange,
    position,
    size,
  ]);

  // ── helpers to start drag / resize from either mouse or touch ──
  const beginDrag = useCallback(
    (clientX: number, clientY: number, isTouch: boolean) => {
      onFocus?.();
      if (pinned) return;
      const DRAG_COMMIT_DISTANCE = 3;
      emitPanelDebug("drag-threshold-start", {
        pointerType: isTouch ? "touch" : "mouse",
        start: { x: clientX, y: clientY },
      });

      clearPendingStartListeners();
      dragStartRef.current = { x: clientX, y: clientY };
      initialPosRef.current = { ...positionRef.current };
      let didCommitDrag = false;

      const syncDragPosition = (nextX: number, nextY: number) => {
        onPositionChange({
          x: initialPosRef.current.x + (nextX - dragStartRef.current.x),
          y: initialPosRef.current.y + (nextY - dragStartRef.current.y),
        });
      };

      const finishCommittedDrag = () => {
        window.dispatchEvent(
          new CustomEvent("zen-panel-drag-end", {
            detail: { windowId: id },
          }),
        );
        emitPanelDebug("drag-end", {
          pointerType: isTouch ? "touch" : "mouse",
          position: positionRef.current,
        });
        onDragEnd?.();
        handleInteractionEnd();
        setIsDragging(false);
      };

      const commitDrag = () => {
        if (didCommitDrag) return;
        didCommitDrag = true;
        setIsDragging(true);
        isInteractingRef.current = true;
        window.dispatchEvent(
          new CustomEvent("zen-panel-drag-start", {
            detail: { windowId: id },
          }),
        );
        emitPanelDebug("drag-commit", {
          pointerType: isTouch ? "touch" : "mouse",
        });
      };

      if (isTouch) {
        // For touch we need a small threshold before committing to the drag
        const handleTouchMove = (ev: TouchEvent) => {
          const t = ev.touches[0];
          if (!t) return;
          const dx = Math.abs(t.clientX - dragStartRef.current.x);
          const dy = Math.abs(t.clientY - dragStartRef.current.y);
          if (dx > DRAG_COMMIT_DISTANCE || dy > DRAG_COMMIT_DISTANCE) {
            ev.preventDefault(); // prevent scroll once we commit to drag
            commitDrag();
          }
          if (didCommitDrag) {
            ev.preventDefault();
            syncDragPosition(t.clientX, t.clientY);
          }
        };
        const handleTouchEnd = (ev: TouchEvent) => {
          if (!didCommitDrag) {
            const t = ev.changedTouches[0];
            if (t) {
              const dx = Math.abs(t.clientX - dragStartRef.current.x);
              const dy = Math.abs(t.clientY - dragStartRef.current.y);
              if (dx > DRAG_COMMIT_DISTANCE || dy > DRAG_COMMIT_DISTANCE) {
                commitDrag();
                syncDragPosition(t.clientX, t.clientY);
              }
            }
          }
          clearPendingStartListeners();
          if (didCommitDrag) {
            finishCommittedDrag();
          } else {
            emitPanelDebug("drag-cancel", {
              pointerType: "touch",
              reason: "below-threshold",
            });
          }
        };
        pendingStartCleanupRef.current = () => {
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
          if (dx > DRAG_COMMIT_DISTANCE || dy > DRAG_COMMIT_DISTANCE) {
            commitDrag();
          }
          if (didCommitDrag) {
            syncDragPosition(moveEvent.clientX, moveEvent.clientY);
          }
        };
        const handleInitialUp = (upEvent: MouseEvent) => {
          if (!didCommitDrag) {
            const dx = Math.abs(upEvent.clientX - dragStartRef.current.x);
            const dy = Math.abs(upEvent.clientY - dragStartRef.current.y);
            if (dx > DRAG_COMMIT_DISTANCE || dy > DRAG_COMMIT_DISTANCE) {
              commitDrag();
              syncDragPosition(upEvent.clientX, upEvent.clientY);
            }
          }
          clearPendingStartListeners();
          if (didCommitDrag) {
            finishCommittedDrag();
          } else {
            emitPanelDebug("drag-cancel", {
              pointerType: "mouse",
              reason: "below-threshold",
            });
          }
        };
        pendingStartCleanupRef.current = () => {
          window.removeEventListener("mousemove", handleInitialMove);
          window.removeEventListener("mouseup", handleInitialUp);
        };
        window.addEventListener("mousemove", handleInitialMove);
        window.addEventListener("mouseup", handleInitialUp);
      }
    },
    [
      clearPendingStartListeners,
      pinned,
      onFocus,
      onPositionChange,
      id,
      emitPanelDebug,
      onDragEnd,
    ],
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
      emitPanelDebug("resize-start", {
        start: { x: clientX, y: clientY },
      });
      setIsResizing(true);
      isInteractingRef.current = true;
      dragStartRef.current = { x: clientX, y: clientY };
      initialSizeRef.current = { ...sizeRef.current };
    },
    [emitPanelDebug, pinned, onFocus],
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

  const handleInteractionEnd = useCallback(() => {
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

    if (!isPositionControlled) {
      setAnchorState({ anchorX, anchorY, offsetX, offsetY });
    }
    isInteractingRef.current = false;
  }, [headerHeight, isPositionControlled, setAnchorState]);

  const forceCancelInteraction = useCallback(() => {
    if (cancelingInteractionRef.current) return;
    const hadInteraction =
      isInteractingRef.current ||
      isDragging ||
      isResizing ||
      pendingStartCleanupRef.current !== null;
    if (!hadInteraction) return;

    cancelingInteractionRef.current = true;

    clearPendingStartListeners();

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingPointerRef.current = null;

    const wasDragging = isDragging;
    const wasResizing = isResizing;

    if (wasDragging) {
      window.dispatchEvent(
        new CustomEvent("zen-panel-drag-end", {
          detail: { windowId: id },
        }),
      );
      onDragEnd?.();
    }
    if (wasResizing) {
      onResizeEnd?.();
    }

    if (wasDragging || wasResizing) {
      emitPanelDebug("interaction-force-cancel", {
        wasDragging,
        wasResizing,
      });
      handleInteractionEnd();
    }

    setIsDragging(false);
    setIsResizing(false);
    document.body.classList.remove("embeddr-panel-interacting");

    cancelingInteractionRef.current = false;
  }, [
    clearPendingStartListeners,
    handleInteractionEnd,
    id,
    isDragging,
    isResizing,
    onDragEnd,
    emitPanelDebug,
    onResizeEnd,
  ]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleBlur = () => forceCancelInteraction();
    const handleVisibility = () => {
      if (document.hidden) {
        forceCancelInteraction();
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [forceCancelInteraction, isDragging, isResizing]);

  const handleFoldToggle = useCallback(
    (nextFolded?: boolean) => {
      emitPanelDebug("fold-toggle-request", {
        requested: nextFolded,
        isDragging,
        isResizing,
        hasPendingStart: pendingStartCleanupRef.current !== null,
      });
      if (
        isDragging ||
        isResizing ||
        pendingStartCleanupRef.current !== null
      ) {
        forceCancelInteraction();
      } else {
        clearPendingStartListeners();
      }

      const previous = isFoldedRef.current;
      const next = nextFolded ?? !previous;
      emitPanelDebug("fold-toggle-apply", {
        previous,
        next,
      });
      setIsFolded(next);
    },
    [
      clearPendingStartListeners,
      emitPanelDebug,
      forceCancelInteraction,
      isDragging,
      isResizing,
      setIsFolded,
    ],
  );

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

    const flushPendingMove = () => {
      if (!pendingPointerRef.current) return;
      const next = pendingPointerRef.current;
      pendingPointerRef.current = null;
      applyMove(next.x, next.y);
    };

    const scheduleMove = (clientX: number, clientY: number) => {
      pendingPointerRef.current = { x: clientX, y: clientY };
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        flushPendingMove();
      });
    };

    let ended = false;
    const endInteraction = () => {
      if (ended) return;
      ended = true;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      flushPendingMove();
      if (isDragging) {
        window.dispatchEvent(
          new CustomEvent("zen-panel-drag-end", {
            detail: { windowId: id },
          }),
        );
        emitPanelDebug("drag-end", {
          pointerType: "deferred",
          position: positionRef.current,
        });
        onDragEnd?.();
        handleInteractionEnd();
      }
      if (isResizing) {
        emitPanelDebug("resize-end", {
          size: sizeRef.current,
        });
        onResizeEnd?.();
        handleInteractionEnd();
      }
      setIsDragging(false);
      setIsResizing(false);
    };

    const handleMouseMove = (e: MouseEvent) =>
      scheduleMove(e.clientX, e.clientY);
    const handleMouseUp = () => endInteraction();
    const handlePointerUp = () => endInteraction();
    const handlePointerCancel = () => endInteraction();
    const handleWindowLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        endInteraction();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // prevent scroll while dragging/resizing
      const t = e.touches[0];
      if (!t) return;
      scheduleMove(t.clientX, t.clientY);
    };
    const handleTouchEnd = () => endInteraction();
    const handleTouchCancel = () => endInteraction();

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp, true);
      window.addEventListener("pointerup", handlePointerUp, true);
      window.addEventListener("pointercancel", handlePointerCancel, true);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd, true);
      window.addEventListener("touchcancel", handleTouchCancel, true);
      window.addEventListener("mouseleave", handleWindowLeave, true);
      clearPendingStartListeners();
      document.body.classList.add("embeddr-panel-interacting");
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd, true);
      window.removeEventListener("touchcancel", handleTouchCancel, true);
      window.removeEventListener("mouseleave", handleWindowLeave, true);
      document.body.classList.remove("embeddr-panel-interacting");
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      pendingPointerRef.current = null;
    };
  }, [
    isDragging,
    isResizing,
    minWidth,
    minHeight,
    onPositionChange,
    onSizeChange,
    onDragEnd,
    emitPanelDebug,
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
    collapse: (v) => handleFoldToggle(v),
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
        handleFoldToggle();
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

  const forceUnfold = useCallback(() => {
    if (!hideHeader) {
      setShowTitle(true);
    }
    handleFoldToggle(false);
  }, [handleFoldToggle, hideHeader, setShowTitle]);

  const foldedRecoveryHandle = isFolded && (!showTitle || hideHeader) && (
    <button
      type="button"
      className={cn(
        "absolute top-0.5 right-0.5 z-60 h-5 rounded border border-border/60 bg-background/90 px-1.5 text-[10px] font-medium text-foreground hover:bg-muted/80",
        "no-drag",
      )}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        forceUnfold();
      }}
      title="Expand panel"
    >
      Open
    </button>
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
        (isDragging || isResizing) && "transition-none",
        transparent &&
          "bg-transparent border-none shadow-none backdrop-blur-none",
        titlePosition === "bottom" ? "flex-col-reverse" : "flex-col",
        className,
      )}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${position.x}px, ${visualY}px, 0)`,
        width: size.width,
        height: isFolded ? "auto" : size.height,
        zIndex: zIndex ?? 50,
        minHeight: isFolded && (!showTitle || hideHeader) ? "1rem" : undefined,
        willChange:
          isDragging || isResizing ? "transform,width,height" : "auto",
        contain: "layout paint style",
        backfaceVisibility: "hidden",
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
      onDoubleClick={(event) => {
        if (!isFolded) return;
        const target = event.target as HTMLElement;
        if (
          target.closest(
            "button, input, textarea, select, [role='menuitem'], [data-slot='button']",
          )
        ) {
          return;
        }
        forceUnfold();
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
      {foldedRecoveryHandle}

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
          onFoldToggle={handleFoldToggle}
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
            onMouseUp={() => forceCancelInteraction()}
            onPointerUp={() => forceCancelInteraction()}
            onPointerCancel={() => forceCancelInteraction()}
            onTouchEnd={() => forceCancelInteraction()}
            onTouchCancel={() => forceCancelInteraction()}
            onContextMenu={(event) => {
              event.preventDefault();
            }}
          />,
          document.body,
        )}
    </div>
  );
}
