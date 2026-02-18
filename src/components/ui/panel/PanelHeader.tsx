import React from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Minus,
  Pin,
  PinOff,
  Settings,
  X,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";

export interface PanelHeaderProps {
  title: string;
  titleIcon?: React.ReactNode;
  panelId?: string;
  mergeActive?: boolean;
  pinned: boolean;
  titlePosition: "top" | "bottom";
  showTitle: boolean;
  isFolded: boolean;
  transparent?: boolean;
  additionalSettingsItems?: React.ReactNode;

  // Handlers
  onPinChange?: (pinned: boolean) => void;
  onTitlePositionChange: (pos: "top" | "bottom") => void;
  onShowTitleChange: (show: boolean) => void;
  onMinimize?: () => void;
  onFoldToggle: () => void;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
}

export function PanelHeader({
  title,
  titleIcon,
  panelId,
  mergeActive,
  pinned,
  titlePosition,
  showTitle,
  isFolded,
  transparent,
  additionalSettingsItems,
  onPinChange,
  onTitlePositionChange,
  onShowTitleChange,
  onMinimize,
  onFoldToggle,
  onClose,
  onMouseDown,
  onTouchStart,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "embeddr-panel-header flex items-center justify-between px-1 h-[40px] border-b select-none shrink-0 bg-muted/50",
        pinned ? "cursor-default" : "cursor-move",
        titlePosition === "bottom" && "border-t border-b-0",
        isFolded && "border-b-0 border-t-0",
      )}
      data-panel-id={panelId}
      data-panel-title={title}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onContextMenu={(e) => {
        e.preventDefault();
        onShowTitleChange(true);
        if (isFolded) onFoldToggle();
      }}
      onDoubleClick={onFoldToggle}
    >
      <div
        className={cn(
          "embeddr-panel-title font-medium text-sm px-1 pr-2 py-1 flex items-center gap-2 rounded-md transition-colors",
          mergeActive && "bg-primary/15 ring-1 ring-primary/50",
        )}
        data-panel-drop-zone="tab"
        data-panel-id={panelId}
        title={mergeActive ? "Release to merge" : undefined}
      >
        {titleIcon ? (
          <span className="embeddr-panel-title-icon flex h-4 w-4 items-center justify-center">
            {titleIcon}
          </span>
        ) : null}
        <span className="embeddr-panel-title-text truncate max-w-40">
          {title}
        </span>
      </div>
      <div className="embeddr-panel-controls flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="embeddr-panel-button embeddr-panel-button-settings h-6 w-6"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="embeddr-panel-menu z-1000000"
          >
            <DropdownMenuLabel>Panel Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {additionalSettingsItems && (
              <>
                {additionalSettingsItems}
                <DropdownMenuSeparator />
              </>
            )}

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
                onTitlePositionChange(
                  titlePosition === "top" ? "bottom" : "top",
                )
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
            <DropdownMenuItem onClick={() => onShowTitleChange(false)}>
              <EyeOff className="mr-2 h-4 w-4" /> Hide Title
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onMinimize && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="embeddr-panel-button embeddr-panel-button-minimize h-6 w-6"
            onClick={onMinimize}
          >
            <Minus className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className="embeddr-panel-button embeddr-panel-button-fold h-6 w-6"
          onClick={onFoldToggle}
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
          className="embeddr-panel-button embeddr-panel-button-close h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
