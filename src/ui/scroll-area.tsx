"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "../lib/utils";

function ScrollArea({
  className,
  children,
  viewportRef,
  viewportClassName,
  variant = "default",
  orientation = "vertical",
  hideScrollbars = false,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportRef?: React.RefObject<HTMLDivElement | null>;
  viewportClassName?: string;
  variant?: "default" | "left-border";
  orientation?: "vertical" | "horizontal" | "both";
  hideScrollbars?: boolean;
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <div className="size-full overflow-hidden rounded-md">
        <ScrollAreaPrimitive.Viewport
          data-slot="scroll-area-viewport"
          ref={viewportRef}
          className={cn(
            "size-full overflow-auto focus-visible:ring-ring/50 transition-[color,box-shadow]",
            viewportClassName,
          )}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
      </div>

      {!hideScrollbars &&
        (orientation === "vertical" || orientation === "both") && (
          <ScrollBar variant={variant} orientation="vertical" />
        )}
      {!hideScrollbars &&
        (orientation === "horizontal" || orientation === "both") && (
          <ScrollBar variant={variant} orientation="horizontal" />
        )}
      {!hideScrollbars && <ScrollAreaPrimitive.Corner />}
    </ScrollAreaPrimitive.Root>
  );
}

interface ScrollBarProps extends React.ComponentProps<
  typeof ScrollAreaPrimitive.ScrollAreaScrollbar
> {
  variant?: "default" | "left-border";
}

function ScrollBar({
  className,
  orientation = "vertical",
  variant = "default",
  ...props
}: ScrollBarProps) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none  transition-colors select-none border   bg-card  border-foreground/10 rounded-md",
        orientation === "vertical" && "h-full w-2.5 ",
        orientation === "horizontal" && "h-2.5 flex-col ",
        variant === "left-border" &&
          orientation === "vertical" &&
          "border-r-0! border-t-0! border-b-0!",
        variant === "left-border" &&
          orientation === "horizontal" &&
          "border-0! border-t-1! border-l-0!",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="cursor-pointer hover:bg-primary/20 bg-border relative flex-1  hover:ring-foreground/40 rounded-md border border-transparent bg-clip-padding"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
