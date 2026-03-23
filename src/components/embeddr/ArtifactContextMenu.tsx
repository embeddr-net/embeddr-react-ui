import React from "react";
import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import { resolveApiBaseUrl } from "../../lib/url";
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
  if (!api?.settings?.get) return DEFAULT_SETTINGS;
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
  const { artifactId, contentUrl, src } = context;
  const hasArtifactId = typeof artifactId === "string" && artifactId.length > 0;
  const resolvedUrl = contentUrl || src || "";

  const getDownloadUrl = ({
    api: actionApi,
    artifactId: actionArtifactId,
    contentUrl: actionContentUrl,
    src: actionSrc,
  }: ArtifactContextMenuContext) => {
    if (actionContentUrl) return actionContentUrl;
    if (actionSrc) return actionSrc;
    if (actionArtifactId && actionApi?.artifacts?.getContentUrl) {
      return actionApi.artifacts.getContentUrl(actionArtifactId);
    }
    if (actionArtifactId) {
      const apiBase = resolveApiBaseUrl(actionApi?.utils?.backendUrl || "");
      return `${apiBase}/artifacts/${actionArtifactId}/content`;
    }
    return "";
  };

  const extensionFromName = (value?: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const withoutQuery = raw.split("?")[0] ?? "";
    const withoutHash = withoutQuery.split("#")[0] ?? "";
    const lastSegment = withoutHash.split("/").pop() ?? withoutHash;
    const dotIndex = lastSegment.lastIndexOf(".");
    if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) return "";

    const ext = lastSegment.slice(dotIndex + 1).toLowerCase();
    const clean = ext.replace(/[^a-z0-9]+/g, "");
    return clean;
  };

  const extensionFromContentType = (contentType?: string | null) => {
    const ct = String(contentType || "").toLowerCase();
    if (!ct) return "";
    if (ct.startsWith("image/jpeg")) return "jpg";
    if (ct.startsWith("image/png")) return "png";
    if (ct.startsWith("image/webp")) return "webp";
    if (ct.startsWith("image/gif")) return "gif";
    if (ct.startsWith("image/svg")) return "svg";
    if (ct.startsWith("video/mp4")) return "mp4";
    if (ct.startsWith("video/webm")) return "webm";
    if (ct.startsWith("audio/mpeg")) return "mp3";
    if (ct.startsWith("audio/wav")) return "wav";
    if (ct.startsWith("audio/ogg")) return "ogg";
    if (ct.startsWith("application/pdf")) return "pdf";
    const slash = ct.indexOf("/");
    if (slash >= 0) {
      const inferred = ct.slice(slash + 1).split(";")[0] ?? "";
      return inferred.trim();
    }
    return "";
  };

  const parseFilenameFromContentDisposition = (value: string | null) => {
    if (!value) return "";
    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]).replace(/\"/g, "").trim();
      } catch {}
    }

    const basicMatch = value.match(/filename=\"?([^\";]+)\"?/i);
    return basicMatch?.[1]?.trim() || "";
  };

  const inferExtension = async ({
    api: actionApi,
    artifactId: actionArtifactId,
    contentUrl: actionContentUrl,
    src: actionSrc,
    artifactPayload,
  }: ArtifactContextMenuContext) => {
    const fromPayload =
      extensionFromName(
        String(artifactPayload?.metadata_json?.filename || ""),
      ) ||
      extensionFromName(String(artifactPayload?.metadata_json?.name || "")) ||
      extensionFromName(String(artifactPayload?.filename || "")) ||
      extensionFromName(String(artifactPayload?.name || ""));

    if (fromPayload) return fromPayload;

    const fromUrl =
      extensionFromName(String(actionContentUrl || "")) ||
      extensionFromName(String(actionSrc || ""));
    if (fromUrl) return fromUrl;

    if (actionArtifactId && actionApi?.artifacts?.get) {
      try {
        const meta = await actionApi.artifacts.get(actionArtifactId);
        const fromMeta =
          extensionFromName(String(meta?.metadata_json?.filename || "")) ||
          extensionFromName(String(meta?.metadata_json?.name || "")) ||
          extensionFromName(String(meta?.uri || "")) ||
          extensionFromContentType(
            String(meta?.mime_type || meta?.content_type || ""),
          );
        if (fromMeta) return fromMeta;
      } catch {}
    }

    return "";
  };

  const triggerBrowserDownload = (url: string, fileName: string) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const appendApiKeyQuery = (url: string, apiKey?: string | null) => {
    if (!url || !apiKey) return url;
    try {
      const parsed = new URL(url, window.location.origin);
      parsed.searchParams.set("api_key", apiKey);
      return parsed.toString();
    } catch {
      return url;
    }
  };

  const downloadViaBlob = async (
    url: string,
    fallbackName: string,
    apiKey?: string | null,
    forceArtifactId?: string,
  ) => {
    const headers = new Headers();
    if (apiKey) headers.set("X-API-Key", apiKey);

    const doFetch = async (targetUrl: string) =>
      fetch(targetUrl, {
        method: "GET",
        headers,
        credentials: "include",
      });

    let response = await doFetch(url);
    if (!response.ok && apiKey) {
      response = await doFetch(appendApiKeyQuery(url, apiKey));
    }
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const headerName = parseFilenameFromContentDisposition(
      response.headers.get("content-disposition"),
    );
    const headerExt = extensionFromName(headerName);
    const typeExt = extensionFromContentType(
      response.headers.get("content-type"),
    );
    const fallbackExt = extensionFromName(fallbackName);
    const ext = headerExt || typeExt || fallbackExt;

    const baseName =
      forceArtifactId && String(forceArtifactId).trim()
        ? String(forceArtifactId).trim()
        : fallbackName.replace(/\.[^.]+$/, "");

    const finalName = ext ? `${baseName}.${ext}` : baseName;

    const objectUrl = URL.createObjectURL(blob);
    try {
      triggerBrowserDownload(objectUrl, finalName);
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }
  };

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
          windowStrategy: "spawn",
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
      id: "core:download-artifact",
      label: "Download",
      icon: Download,
      source: "core",
      disabled: !hasArtifactId && !resolvedUrl,
      onSelect: async (actionContext) => {
        const downloadUrl = getDownloadUrl(actionContext);
        if (!downloadUrl) {
          actionContext.api?.toast.error("No downloadable URL available");
          return;
        }

        const inferredExt = await inferExtension(actionContext);
        const fallbackName = actionContext.artifactId
          ? inferredExt
            ? `${actionContext.artifactId}.${inferredExt}`
            : String(actionContext.artifactId)
          : inferredExt
            ? `download.${inferredExt}`
            : "download";

        const apiKey = actionContext.api?.utils?.getApiKey?.() || null;

        try {
          await downloadViaBlob(
            downloadUrl,
            fallbackName,
            apiKey,
            actionContext.artifactId,
          );
          actionContext.api?.toast.info("Download started");
        } catch {
          triggerBrowserDownload(downloadUrl, fallbackName);
          actionContext.api?.toast.info("Opening download URL");
        }
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
  const pluginActions = api?.plugins?.getActions?.("image-context-menu") || [];

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
            actionContext.api?.plugins?.getApi?.(pluginId) || actionContext.api;
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
