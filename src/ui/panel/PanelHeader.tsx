import React from "react";
import {
  Settings,
  Pin,
  PinOff,
  ArrowDown,
  ArrowUp,
  EyeOff,
  Minus,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
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
}

export function PanelHeader({
  title,
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
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 border-b select-none shrink-0 bg-muted/50",
        pinned ? "cursor-default" : "cursor-move",
        titlePosition === "bottom" && "border-t border-b-0"
      )}
      onMouseDown={onMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onShowTitleChange(true);
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
          <DropdownMenuContent align="end" className="z-[1000000]">
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
                  titlePosition === "top" ? "bottom" : "top"
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
            className="h-6 w-6"
            onClick={onMinimize}
          >
            <Minus className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
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
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
