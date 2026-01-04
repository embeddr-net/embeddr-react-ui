import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  Settings,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { Card } from "./card";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

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
  zIndex?: number;
  onFocus?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  showTitle?: boolean;
  onShowTitleChange?: (show: boolean) => void;
  hideHeader?: boolean;
  transparent?: boolean;
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
  showTitle: controlledShowTitle,
  onShowTitleChange,
  hideHeader = false,
  transparent = false,
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

  const position = controlledPosition || internalPosition;
  const size = controlledSize || internalSize;

  const onPositionChange = (pos: { x: number; y: number }) => {
    if (controlledOnPositionChange) {
      controlledOnPositionChange(pos);
    } else {
      setInternalPosition(pos);
    }
  };

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
    setInternalShowTitle(show);
    onShowTitleChange?.(show);
  };

  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });
  const initialSizeRef = useRef({ width: 0, height: 0 });

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
    setIsResizing(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialSizeRef.current = { ...size };
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
          width: Math.max(minWidth, initialSizeRef.current.width + dx),
          height: Math.max(minHeight, initialSizeRef.current.height + dy),
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        onDragEnd?.();
      }
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    minWidth,
    minHeight,
    onPositionChange,
    onSizeChange,
    onDragEnd,
  ]);

  if (!isOpen) return null;

  const headerContent = (
    <div
      className={cn(
        "flex items-center justify-between p-2 border-b select-none shrink-0 bg-muted/50",
        pinned ? "cursor-default" : "cursor-move",
        titlePosition === "bottom" && "border-t border-b-0"
      )}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowTitle(true);
      }}
    >
      <div className="font-medium text-sm px-2 flex items-center gap-2">
        {title}
      </div>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="h-6 w-6">
              <Settings className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[100]">
            <DropdownMenuLabel>Panel Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {onPinChange && (
              <DropdownMenuItem onClick={() => onPinChange(!pinned)}>
                {pinned ? (
                  <>
                    <PinOff className="mr-2 h-4 w-4" /> Unpin
                  </>
                ) : (
                  <>
                    <Pin className="mr-2 h-4 w-4" /> Pin
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                setTitlePosition(titlePosition === "top" ? "bottom" : "top")
              }
            >
              {titlePosition === "top" ? (
                <>
                  <ArrowDown className="mr-2 h-4 w-4" /> Title Bottom
                </>
              ) : (
                <>
                  <ArrowUp className="mr-2 h-4 w-4" /> Title Top
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowTitle(false)}>
              <EyeOff className="mr-2 h-4 w-4" /> Hide Title
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          onClick={toggleFold}
        >
          {isFolded ? (
            titlePosition === "top" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )
          ) : titlePosition === "top" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // If title is hidden, we show a small drag handle on hover or right click area
  // If hideHeader is true, we still want this handle if the user needs a way to drag without clicking the content
  // But if the content is fully interactive (like a button), this top strip is the ONLY way to drag.
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
        "fixed flex shadow-xl border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-colors  duration-200",
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
        if (hideHeader) {
          handleMouseDown(e);
        }
      }}
    >
      {hiddenTitleHandle}
      {showTitle && headerContent}

      {/* Content */}
      {!isFolded && (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {children}
        </div>
      )}

      {/* Resize Handle */}
      {!isFolded && (
        <div
          className={cn(
            "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize resize-handle flex items-center justify-center z-50",
            transparent
              ? "opacity-0 hover:opacity-100"
              : "opacity-50 hover:opacity-100"
          )}
          onMouseDown={handleResizeStart}
        >
          <div className="w-2 h-2 border-r-2 border-b-2 border-foreground/50" />
        </div>
      )}
    </Card>
  );
}
