/**
 * ModelPicker — A generic model selector dropdown that fetches
 * available & loaded models via a Lotus capability and lets
 * users pick one. Shows loaded status indicators and optional branding.
 *
 * Usage:
 *   <ModelPicker
 *     api={api}
 *     capability="my-plugin.list_loaded_models"
 *     taskFilter="segmentation"
 *     value={selectedModel}
 *     onSelect={(modelId, model) => setModel(modelId)}
 *     fallbackOptions={[{ value: "yolov8n.pt", label: "YOLOv8n" }]}
 *   />
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Spinner } from "../ui/spinner";
import { cn } from "../../lib/utils";

// ── Types ───────────────────────────────────────────────────

export interface ModelInfo {
  model_id: string;
  repo_id: string;
  name: string;
  task?: string;
  loaded: boolean;
  device?: string;
  size_str?: string;
  size_bytes?: number;
  provider?: string;
  framework?: string;
  pipeline_tag?: string;
  library_name?: string;
  metadata?: Record<string, any>;
}

/** Simple fallback option when registry models aren't available */
export interface FallbackModelOption {
  value: string;
  label: string;
  /** Optional grouping hint, e.g. "sam2" / "sam3" */
  group?: string;
}

export interface ModelPickerProps {
  /** Plugin API object (must have `api.lotus.invoke`) */
  api: any;
  /** Lotus capability ID to invoke for listing models */
  capability: string;
  /** Filter models by task, e.g. "segmentation", "object-detection" */
  taskFilter?: string;
  /** Currently selected model id */
  value?: string;
  /** Called when user selects a model */
  onSelect?: (modelId: string, model?: ModelInfo) => void;
  /** Show these options as fallback when no registry models are available */
  fallbackOptions?: Array<FallbackModelOption>;
  /** Don't query the registry — only show fallbacks */
  disableQuery?: boolean;
  /** Label displayed above the selector */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names for the root wrapper */
  className?: string;
  /** Height of the trigger (default: "h-8") */
  triggerHeight?: string;
  /** Optional logo URL to show as a badge next to the label */
  logoUrl?: string;
  /** Alt text for the logo */
  logoAlt?: string;
  /** Provider ID to exclude from the provider badge display */
  ownProvider?: string;
  /** Provider filter — when set, only shows models from matching providers */
  providerFilter?: string | Array<string>;
  /** If true, fetches on mount; otherwise waits for explicit refresh */
  autoFetch?: boolean;
  /** Called after models are fetched, with the full list */
  onModelsFetched?: (models: Array<ModelInfo>) => void;
  /** Map of task names to tailwind color classes for the task indicator dot */
  taskColors?: Record<string, string>;
}

// ── Default task colors ─────────────────────────────────────

const DEFAULT_TASK_COLORS: Record<string, string> = {
  segmentation: "bg-blue-400",
  "object-detection": "bg-amber-400",
  "depth-estimation": "bg-purple-400",
  "image-classification": "bg-green-400",
  "feature-extraction": "bg-cyan-400",
  "face-analysis": "bg-rose-400",
  "face-detection": "bg-rose-400",
  "3d-reconstruction": "bg-violet-400",
  "human-mesh-recovery": "bg-violet-400",
  detect: "bg-amber-400",
  segment: "bg-blue-400",
  classify: "bg-green-400",
  pose: "bg-fuchsia-400",
};

// ── Component ───────────────────────────────────────────────

const ModelPicker = forwardRef<HTMLDivElement, ModelPickerProps>(
  (
    {
      api,
      capability,
      taskFilter,
      value,
      onSelect,
      fallbackOptions = [],
      disableQuery = false,
      label,
      placeholder = "Select model\u2026",
      className,
      triggerHeight = "h-8",
      logoUrl,
      logoAlt = "Model provider",
      ownProvider,
      providerFilter,
      autoFetch = true,
      onModelsFetched,
      taskColors,
    },
    ref,
  ) => {
    const [models, setModels] = useState<Array<ModelInfo>>([]);
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);

    const resolvedTaskColors = useMemo(
      () => ({ ...DEFAULT_TASK_COLORS, ...taskColors }),
      [taskColors],
    );

    // ── Fetch models ────────────────────────────────────

    const fetchModels = useCallback(async () => {
      if (disableQuery) return;
      setLoading(true);
      try {
        const res = await api.lotus.invoke(capability, {
          include_available: true,
          task_filter: taskFilter || undefined,
        });
        if (res?.ok && Array.isArray(res.models)) {
          let result: Array<ModelInfo> = res.models;

          if (providerFilter) {
            const providers = Array.isArray(providerFilter)
              ? providerFilter
              : [providerFilter];
            result = result.filter(
              (m) => !m.provider || providers.includes(m.provider),
            );
          }

          setModels(result);
          setFetched(true);
          onModelsFetched?.(result);
        }
      } catch (err) {
        console.warn("[ModelPicker] Failed to fetch models:", err);
        setFetched(true);
      } finally {
        setLoading(false);
      }
    }, [api, capability, taskFilter, providerFilter, disableQuery, onModelsFetched]);

    useEffect(() => {
      if (autoFetch) fetchModels();
    }, [autoFetch, fetchModels]);

    // ── Merge models with fallbacks ─────────────────────

    const options = useMemo(() => {
      type OptionItem = {
        value: string;
        label: string;
        loaded?: boolean;
        device?: string;
        provider?: string;
        sizeStr?: string;
        group?: string;
        isRegistry: boolean;
        task?: string;
      };

      const items: Array<OptionItem> = [];
      const seen = new Set<string>();

      const sorted = [...models].sort((a, b) => {
        if (a.loaded && !b.loaded) return -1;
        if (!a.loaded && b.loaded) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const m of sorted) {
        const id = m.model_id || m.repo_id;
        if (seen.has(id)) continue;
        seen.add(id);
        items.push({
          value: id,
          label: m.name,
          loaded: m.loaded,
          device: m.device,
          provider: m.provider,
          sizeStr: m.size_str,
          isRegistry: true,
          task: m.task,
        });
      }

      for (const fb of fallbackOptions) {
        if (seen.has(fb.value)) continue;
        seen.add(fb.value);
        items.push({
          value: fb.value,
          label: fb.label,
          group: fb.group,
          isRegistry: false,
        });
      }

      return items;
    }, [models, fallbackOptions]);

    // ── Auto-select first loaded model if value isn't in list ──

    useEffect(() => {
      if (!fetched) return;
      if (value && options.some((o) => o.value === value)) return;
      const firstLoaded = options.find((o) => o.loaded);
      const fallback = firstLoaded || options[0];
      if (fallback && fallback.value !== value) {
        onSelect?.(fallback.value);
      }
    }, [fetched, options, value, onSelect]);

    // ── Handler ────────────────────────────────────────

    const handleChange = useCallback(
      (newValue: string) => {
        const found = models.find(
          (m) => m.model_id === newValue || m.repo_id === newValue,
        );
        onSelect?.(newValue, found || undefined);
      },
      [onSelect, models],
    );

    // ── Render ─────────────────────────────────────────

    const selectedOption = options.find((o) => o.value === value);

    return (
      <div ref={ref} className={cn("space-y-1 min-w-0 max-w-full", className)}>
        {label && (
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-muted-foreground font-medium">
              {label}
            </label>
            {logoUrl && models.length > 0 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <img
                      src={logoUrl}
                      alt={logoAlt}
                      className="h-3.5 w-3.5 opacity-60"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-[10px]">
                    {logoAlt}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {loading && <Spinner className="h-3 w-3" />}
          </div>
        )}

        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className={cn(triggerHeight, "text-xs w-full min-w-0 max-w-full")}>
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden pr-1">
              {selectedOption?.loaded !== undefined && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    selectedOption.loaded
                      ? "bg-emerald-400"
                      : "bg-muted-foreground/40",
                  )}
                />
              )}
              <div
                className="block truncate min-w-0 flex-1 text-left"
                title={selectedOption?.label || placeholder}
              >
                <SelectValue
                  className="block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                  placeholder={placeholder}
                >
                  {selectedOption?.label || placeholder}
                </SelectValue>
              </div>
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {options.length === 0 && !loading ? (
              <div className="py-3 px-2 text-xs text-muted-foreground text-center">
                No models available
              </div>
            ) : (
              options.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  textValue={opt.label}
                  className="text-xs"
                >
                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    {opt.loaded !== undefined && (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          opt.loaded
                            ? "bg-emerald-400"
                            : "bg-muted-foreground/40",
                        )}
                      />
                    )}

                    {opt.task && (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          resolvedTaskColors[opt.task] || "bg-muted-foreground/30",
                        )}
                      />
                    )}

                    <span className="truncate min-w-0 flex-1">{opt.label}</span>

                    <span className="flex items-center gap-1 ml-auto shrink-0">
                      {opt.loaded && opt.device && (
                        <Badge
                          variant="outline"
                          className="text-[8px] h-3.5 px-1 py-0 border-emerald-500/30 text-emerald-400"
                        >
                          {opt.device}
                        </Badge>
                      )}

                      {opt.sizeStr && !opt.loaded && (
                        <span className="text-[9px] text-muted-foreground/60">
                          {opt.sizeStr}
                        </span>
                      )}

                      {opt.provider && opt.provider !== ownProvider && (
                        <Badge
                          variant="outline"
                          className="text-[8px] h-3.5 px-1 py-0"
                        >
                          {opt.provider.replace("embeddr-", "")}
                        </Badge>
                      )}

                      {opt.isRegistry && logoUrl && (
                        <img
                          src={logoUrl}
                          alt=""
                          className="h-3 w-3 opacity-40 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                    </span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    );
  },
);

ModelPicker.displayName = "ModelPicker";

export { ModelPicker };
export default ModelPicker;

// ── Backwards compatibility ─────────────────────────────────
// These aliases allow existing plugin code to migrate gradually.
/** @deprecated Use ModelInfo instead */
export type HfModelInfo = ModelInfo;
/** @deprecated Use ModelPickerProps instead */
export type HfModelPickerProps = ModelPickerProps;
/** @deprecated Use ModelPicker instead */
export const HfModelPicker = ModelPicker;
