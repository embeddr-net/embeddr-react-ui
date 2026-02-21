import React from "react";
import { Copy, ExternalLink, Eye, Image as ImageIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@embeddr/react-ui/components/ui";
import type { EmbeddrAPI } from "../../types";

export type ArtifactContextSource = "core" | "plugin" | "custom";

export interface ArtifactContextMenuContext {
  api: EmbeddrAPI | null;
  artifactId?: string;
  artifactType?: string;
  artifactPath?: string;
  src?: string;
  contentUrl?: string;
  previewUrl?: string;
  artifactPayload?: Record<string, any>;
}

export interface ArtifactContextMenuAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  source?: ArtifactContextSource;
  disabled?: boolean;
  hidden?: boolean;
  order?: number;
  separatorBefore?: boolean;
  onSelect: (context: ArtifactContextMenuContext) => void | Promise<void>;
}

export interface ArtifactContextMenuSettings {
  hiddenActionIds?: Array<string>;
  disabledActionIds?: Array<string>;
  actionOrder?: Array<string>;
  includePluginActions?: boolean;
}

export interface ArtifactContextMenuProps {
  children: React.ReactElement;
  context: ArtifactContextMenuContext;
  disabled?: boolean;
  mode?: "merge" | "replace";
  actions?: Array<ArtifactContextMenuAction>;
  resolveActions?: (input: {
    defaults: Array<ArtifactContextMenuAction>;
    context: ArtifactContextMenuContext;
  }) => Array<ArtifactContextMenuAction>;
  menuClassName?: string;
}

const DEFAULT_SETTINGS: ArtifactContextMenuSettings = {
  hiddenActionIds: [],
  disabledActionIds: [],
  actionOrder: [],
  includePluginActions: true,
};

const toIdSet = (value: unknown) => {
  if (!Array.isArray(value)) return new Set<string>();
  return new Set(value.filter((v): v is string => typeof v === "string"));
};

function getMenuSettings(api: EmbeddrAPI | null): ArtifactContextMenuSettings {
  if (!api?.settings.get) return DEFAULT_SETTINGS;
  const value = api.settings.get<ArtifactContextMenuSettings>(
    "ui.artifactContextMenu",
    DEFAULT_SETTINGS,
  );
  return {
    ...DEFAULT_SETTINGS,
    ...value,
  };
}

function buildDefaultActions(
  context: ArtifactContextMenuContext,
): Array<ArtifactContextMenuAction> {
  const { api, artifactId, contentUrl, src } = context;
  const hasArtifactId = typeof artifactId === "string" && artifactId.length > 0;
  const resolvedUrl = contentUrl || src || "";

  return [
    {
      id: "core:view-artifact",
      label: "View details",
      icon: Eye,
      source: "core",
      disabled: !hasArtifactId,
      onSelect: ({ api: actionApi, artifactId: actionArtifactId }) => {
        if (!actionApi || !actionArtifactId) return;
        actionApi.events.emit("llm:display_artifact" as any, {
          artifact_id: actionArtifactId,
        });
      },
    },
    {
      id: "core:open-lightbox",
      label: "Open in lightbox",
      icon: ImageIcon,
      source: "core",
      disabled: !hasArtifactId,
      onSelect: ({ api: actionApi, artifactId: actionArtifactId }) => {
        if (!actionApi || !actionArtifactId) return;
        actionApi.events.emit("ui:display_lightbox" as any, {
          artifact_ids: [actionArtifactId],
        });
      },
    },
    {
      id: "core:open-media-frame",
      label: "Open media frame",
      icon: ExternalLink,
      source: "core",
      disabled: !hasArtifactId,
      onSelect: ({ api: actionApi, artifactId: actionArtifactId }) => {
        if (!actionApi || !actionArtifactId) return;
        actionApi.events.emit("ui:display_media" as any, {
          artifact_ids: [actionArtifactId],
          windowStrategy: "spawn",
          panelId: `core-media-frame-${actionArtifactId}-${Date.now().toString(36)}`,
        });
      },
    },
    {
      id: "core:copy-artifact-id",
      label: "Copy artifact ID",
      icon: Copy,
      source: "core",
      disabled: !hasArtifactId,
      separatorBefore: true,
      onSelect: async ({ api: actionApi, artifactId: actionArtifactId }) => {
        if (!actionArtifactId) return;
        await navigator.clipboard.writeText(actionArtifactId);
        actionApi?.toast.info("Artifact ID copied");
      },
    },
    {
      id: "core:copy-content-url",
      label: "Copy content URL",
      icon: Copy,
      source: "core",
      disabled: !resolvedUrl,
      onSelect: async ({
        api: actionApi,
        contentUrl: actionContentUrl,
        src: actionSrc,
      }) => {
        const copyValue = actionContentUrl || actionSrc;
        if (!copyValue) return;
        await navigator.clipboard.writeText(copyValue);
        actionApi?.toast.info("Content URL copied");
      },
    },
  ];
}

function buildPluginActions(
  context: ArtifactContextMenuContext,
): Array<ArtifactContextMenuAction> {
  const { api } = context;
  const pluginActions = api?.plugins.getActions?.("image-context-menu") || [];

  return pluginActions
    .map(({ pluginId, def }) => {
      const actionId = String(def?.id || "");
      const label = String(def?.label || actionId || "Action");
      if (!actionId || !label) return null;

      return {
        id: `plugin:${pluginId}:${actionId}`,
        label,
        source: "plugin" as const,
        icon: def?.icon,
        onSelect: (actionContext: ArtifactContextMenuContext) => {
          const pluginApi =
            actionContext.api?.plugins.getApi?.(pluginId) || actionContext.api;
          const handler = def?.handler;
          if (typeof handler === "function") {
            handler(pluginApi, {
              pluginId,
              artifactId: actionContext.artifactId,
              artifactType: actionContext.artifactType,
              artifactPath: actionContext.artifactPath,
              contentUrl: actionContext.contentUrl,
              previewUrl: actionContext.previewUrl,
              src: actionContext.src,
              artifact: actionContext.artifactPayload,
            });
          }
        },
      } as ArtifactContextMenuAction;
    })
    .filter(Boolean) as Array<ArtifactContextMenuAction>;
}

function orderActions(
  actions: Array<ArtifactContextMenuAction>,
  order: Array<string>,
): Array<ArtifactContextMenuAction> {
  if (!order.length) {
    return [...actions].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  const orderMap = new Map(order.map((id, idx) => [id, idx]));
  return [...actions].sort((a, b) => {
    const aIndex = orderMap.get(a.id);
    const bIndex = orderMap.get(b.id);
    if (aIndex !== undefined || bIndex !== undefined) {
      if (aIndex === undefined) return 1;
      if (bIndex === undefined) return -1;
      return aIndex - bIndex;
    }
    return (a.order || 0) - (b.order || 0);
  });
}

function resolveMenuActions({
  context,
  mode = "merge",
  actions,
  resolveActions,
}: {
  context: ArtifactContextMenuContext;
  mode?: "merge" | "replace";
  actions?: Array<ArtifactContextMenuAction>;
  resolveActions?: ArtifactContextMenuProps["resolveActions"];
}): Array<ArtifactContextMenuAction> {
  const settings = getMenuSettings(context.api);

  const defaults = mode === "replace" ? [] : buildDefaultActions(context);
  const withPlugins =
    mode === "replace" || settings.includePluginActions === false
      ? defaults
      : [...defaults, ...buildPluginActions(context)];

  const merged = [...withPlugins, ...(actions || [])];
  const resolved = resolveActions
    ? resolveActions({ defaults: merged, context })
    : merged;

  const hidden = toIdSet(settings.hiddenActionIds);
  const forcedDisabled = toIdSet(settings.disabledActionIds);

  const filtered = resolved
    .filter((action) => !action.hidden)
    .filter((action) => !hidden.has(action.id))
    .map((action) => ({
      ...action,
      disabled: action.disabled || forcedDisabled.has(action.id),
    }));

  return orderActions(filtered, settings.actionOrder || []);
}

export function ArtifactContextMenu({
  children,
  context,
  disabled,
  actions,
  resolveActions,
  mode,
  menuClassName,
}: ArtifactContextMenuProps) {
  const resolvedActions = React.useMemo(
    () =>
      resolveMenuActions({
        context,
        actions,
        mode,
        resolveActions,
      }),
    [actions, context, mode, resolveActions],
  );

  if (disabled || resolvedActions.length === 0) {
    return children;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className={menuClassName || "w-56"}>
        {resolvedActions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <React.Fragment key={action.id}>
              {action.separatorBefore && idx > 0 ? (
                <ContextMenuSeparator />
              ) : null}
              <ContextMenuItem
                disabled={action.disabled}
                onClick={async () => {
                  try {
                    await action.onSelect(context);
                  } catch (error) {
                    context.api?.toast.error("Action failed");
                    console.error(
                      `[ArtifactContextMenu] action failed: ${action.id}`,
                      error,
                    );
                  }
                }}
              >
                {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                {action.label}
              </ContextMenuItem>
            </React.Fragment>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}
