import {
  Loader2Icon,
  LoaderCircleIcon,
  LoaderIcon,
  LoaderPinwheel,
  LoaderPinwheelIcon,
} from "lucide-react";

import { cn } from "../lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderCircleIcon
      role="status"
      aria-label="Loading"
      className={cn("size-5", className)}
      style={{
        animation: "spin 1.8s linear infinite",
      }}
      {...props}
    />
  );
}

export { Spinner };
