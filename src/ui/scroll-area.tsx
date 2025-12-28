"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "../lib/utils";
function ScrollArea({
  className,
  children,
  viewportRef,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportRef?: React.RefObject<HTMLDivElement | null>;
  variant?: "default" | "left-border";
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        ref={viewportRef}
        className="size-full focus-visible:ring-ring/50 transition-[color,box-shadow]"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      <ScrollBar variant={variant} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

interface ScrollBarProps
  extends React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> {
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
        "flex touch-none  transition-colors select-none   bg-card border  border-foreground/10",
        orientation === "vertical" && "h-full w-2.5 ",
        orientation === "horizontal" && "h-2.5 flex-col ",
        variant === "left-border" && "border-r-0! border-t-0! border-b-0!",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="cursor-pointer hover:bg-primary/20 bg-border relative flex-1  hover:ring-foreground/40 rounded-none border border-transparent bg-clip-padding"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
