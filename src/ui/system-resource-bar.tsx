import React, { useEffect, useState } from "react";
import { Progress } from "./progress";
import { Badge } from "./badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import {
  Cpu,
  Database,
  Info,
  Zap,
  XCircle,
  RotateCcw,
  HardDrive,
  Activity,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./context-menu";
import { useOptionalEmbeddrAPI } from "../context/EmbeddrContext";

interface ManagedResource {
  id: string;
  name: string;
  plugin_name: string;
  type: string;
  status: "idle" | "loading" | "loaded" | "error" | "unloading";
  memory_usage_bytes: number;
  device: string;
  metadata: Record<string, any>;
  last_updated: string;
}

interface ResourceState {
  resources: ManagedResource[];
  total_memory_bytes: number;
}

export const SystemResourceBar: React.FC<{
  className?: string;
  pollingInterval?: number;
  totalVRAM?: number; // in bytes, default e.g. 24GB
  variant?: "default" | "compact";
}> = ({
  className,
  pollingInterval = 30000,
  totalVRAM = 32 * 1024 * 1024 * 1024,
  variant = "default",
}) => {
  const api = useOptionalEmbeddrAPI();

  const [state, setState] = useState<ResourceState>({
    resources: [],
    total_memory_bytes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null,
  );

  const getBaseUrl = () => {
    // Attempt to resolve backend URL
    try {
      const stored = localStorage.getItem("embeddr-backend-url");
      if (stored) return stored.replace(/\/+$/, "");
    } catch (e) {}

    return "http://localhost:8003"; // Final fallback
  };

  const fetchResources = async () => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/v1/system/resources`);
      if (response.ok) {
        const data = await response.json();
        setState(data);
      }
    } catch (error) {
      console.error("Failed to fetch system resources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const unloadResource = async (id: string) => {
    try {
      const baseUrl = getBaseUrl();
      await fetch(
        `${baseUrl}/api/v1/system/resources/unload?resource_id=${encodeURIComponent(
          id,
        )}`,
        {
          method: "POST",
        },
      );
      fetchResources();
    } catch (error) {
      console.error("Failed to unload resource:", error);
    }
  };

  useEffect(() => {
    fetchResources();
    const interval = setInterval(fetchResources, pollingInterval);
    return () => clearInterval(interval);
  }, [pollingInterval]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const percentage = (state.total_memory_bytes / totalVRAM) * 100;

  // Sort resources so loaded ones stay together
  const sortedResources = [...state.resources].sort((a, b) => {
    if (a.status === "loaded" && b.status !== "loaded") return -1;
    if (a.status !== "loaded" && b.status === "loaded") return 1;
    return b.memory_usage_bytes - a.memory_usage_bytes;
  });

  const NUM_SQUARES = variant === "compact" ? 12 : 24;
  const bytesPerSquare = totalVRAM / NUM_SQUARES;

  // Assign squares to resources
  let currentByteOffset = 0;
  const squares = Array.from({ length: NUM_SQUARES }).map((_, i) => {
    // Basic assignment: if the resource usage covers more than half of this block's range, capture it
    const blockStart = i * bytesPerSquare;
    const blockMid = blockStart + bytesPerSquare / 2;

    let runningOffset = 0;
    for (const res of sortedResources) {
      if (res.memory_usage_bytes <= 0) continue;
      const resStart = runningOffset;
      const resEnd = runningOffset + res.memory_usage_bytes;

      if (blockMid >= resStart && blockMid < resEnd) {
        return res;
      }
      runningOffset += res.memory_usage_bytes;
    }
    return null;
  });

  const colors = [
    "bg-primary",
    "bg-blue-500",
    "bg-purple-500",
    "bg-emerald-500",
    "bg-orange-500",
    "bg-pink-500",
  ];

  return (
    <div
      className={cn(
        "flex text-xs",
        variant === "compact"
          ? "flex-row items-center gap-2 p-1"
          : "flex-col gap-2 p-2",
        className,
      )}
    >
      {variant === "default" && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">
              {"System Resources"}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span
              className={cn(
                "font-bold",
                percentage > 80
                  ? "text-destructive"
                  : percentage > 50
                    ? "text-warning"
                    : "text-primary",
              )}
            >
              {formatBytes(state.total_memory_bytes)}
            </span>
            <span className="text-muted-foreground">
              / {formatBytes(totalVRAM)}
            </span>
          </div>
        </div>
      )}

      <TooltipProvider>
        <div
          className={cn(
            "flex gap-0.5",
            variant === "compact"
              ? "h-3 items-center aspect-square"
              : "h-2.5 w-full",
          )}
        >
          {squares.map((resource, i) => {
            const isAssigned = !!resource;
            const resIdx = resource
              ? sortedResources.findIndex((r) => r.id === resource.id)
              : -1;
            const isSelected = resource && selectedResourceId === resource.id;

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <ContextMenu>
                    <ContextMenuTrigger
                      onClick={() =>
                        setSelectedResourceId(
                          resource?.id === selectedResourceId
                            ? null
                            : resource?.id || null,
                        )
                      }
                      className={cn(
                        "h-full transition-all cursor-pointer  shadow-sm",
                        variant === "compact" ? "w-3 h-3" : "flex-1 h-2.5",
                        isAssigned
                          ? colors[resIdx % colors.length]
                          : "bg-muted",
                        isAssigned && "hover:brightness-125",
                        isSelected && "border-1 border-foreground/50 z-10",
                        resource?.status === "loading" && "animate-pulse",
                      )}
                    />
                    {resource && (
                      <ContextMenuContent>
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          {resource.name}
                        </div>
                        <ContextMenuItem
                          onClick={() => unloadResource(resource.id)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Unload Model
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => fetchResources()}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Refresh Status
                        </ContextMenuItem>
                      </ContextMenuContent>
                    )}
                  </ContextMenu>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="flex flex-col gap-1 p-2 text-xs"
                >
                  {resource ? (
                    <>
                      <div className="flex items-center justify-between gap-4 font-bold">
                        <span>{resource.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4">
                          {resource.device.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        {resource.plugin_name} • {resource.status}
                      </div>
                      <div className="flex items-center gap-1 font-mono font-bold text-primary">
                        <Zap className="h-3 w-3" />
                        {formatBytes(resource.memory_usage_bytes)}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">
                      Free Memory block (approx {formatBytes(bytesPerSquare)})
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {variant === "default" && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {state.resources
            .filter((r) => r.status === "loaded" || r.status === "loading")
            .map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border-b border-border/50 py-0.5"
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <HardDrive
                    className={cn(
                      "h-3 w-3 shrink-0",
                      r.status === "loading"
                        ? "text-warning animate-pulse"
                        : "text-primary",
                    )}
                  />
                  <span className="truncate text-muted-foreground">
                    {r.name}
                  </span>
                </div>
                <span className="font-mono text-[10px] tabular-nums">
                  {formatBytes(r.memory_usage_bytes || 0)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
