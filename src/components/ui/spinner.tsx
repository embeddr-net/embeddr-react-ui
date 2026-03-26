import { LoaderCircleIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import type { ComponentPropsWithoutRef } from "react";

function Spinner({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof LoaderCircleIcon>) {
  return (
    <LoaderCircleIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}
export { Spinner };
