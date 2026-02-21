import React from "react";
import { Music } from "lucide-react";
import { cn } from "../../lib/utils";
import { EmbeddrDnDTypes } from "../../lib/dnd";
import { useOptionalEmbeddrAPI } from "../../context/EmbeddrContext";
import { EmbeddrImage } from "./EmbeddrImage";
import {
  ArtifactContextMenu,
  type ArtifactContextMenuAction,
  type ArtifactContextMenuContext,
} from "./ArtifactContextMenu";

export interface EmbeddrArtifactProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  id?: string;
  url?: string;
  backendUrl?: string;
  artifactType?: string;
  artifactPath?: string;
  variant?: "preview" | "content";
  resolver?: (input: {
    artifactId?: string;
    url?: string;
    hintType?: string;
  }) => Promise<{
    id?: string;
    type?: string;
    content_url?: string;
    preview_url?: string;
    title?: string;
    url?: string;
    payload?: Record<string, any>;
  }>;
  contextMenuDisabled?: boolean;
  contextMenuMode?: "merge" | "replace";
  contextMenuActions?: ArtifactContextMenuAction[];
  resolveContextMenuActions?: (input: {
    defaults: ArtifactContextMenuAction[];
    context: ArtifactContextMenuContext;
  }) => ArtifactContextMenuAction[];
}

function buildV1Base(backendUrl?: string, apiBackendUrl?: string) {
  let base = backendUrl || apiBackendUrl || "";
  base = base.replace(/\/api\/v\d+\/?$/, "").replace(/\/+$/, "");
  return base ? `${base}/api/v1` : "/api/v1";
}

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "aac", "m4a", "flac", "ogg"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);

function extensionFromUrl(value?: string) {
  if (!value) return "";
  const clean = value.split("?")[0]?.split("#")[0] || "";
  return clean.split(".").pop()?.toLowerCase() || "";
}

function isAudioType(value?: string) {
  if (!value) return false;
  return value.toLowerCase().startsWith("audio");
}

function isImageUrl(value?: string) {
  const ext = extensionFromUrl(value);
  return IMAGE_EXTENSIONS.has(ext);
}

export const EmbeddrArtifact = React.forwardRef<
  HTMLImageElement,
  EmbeddrArtifactProps
>(
  (
    {
      id,
      url,
      backendUrl,
      artifactType = "image",
      artifactPath = "",
      variant = "preview",
      resolver,
      contextMenuDisabled,
      contextMenuMode,
      contextMenuActions,
      resolveContextMenuActions,
      className,
      onDragStart,
      ...props
    },
    ref,
  ) => {
    const api = useOptionalEmbeddrAPI();
    const [resolved, setResolved] = React.useState<{
      id?: string;
      type?: string;
      content_url?: string;
      preview_url?: string;
      url?: string;
      payload?: Record<string, any>;
    } | null>(null);

    React.useEffect(() => {
      let alive = true;
      const artifactId = id;
      const run = async () => {
        if (resolver) {
          try {
            const out = await resolver({
              artifactId,
              url,
              hintType: artifactType,
            });
            if (alive) setResolved(out);
            return;
          } catch {
            if (alive) setResolved(null);
          }
        }

        const base = buildV1Base(backendUrl, api?.utils.backendUrl);
        if (artifactId) {
          const fallback = {
            id: artifactId,
            type: artifactType,
            content_url: `${base}/artifacts/${artifactId}/content`,
            preview_url: `${base}/artifacts/${artifactId}/preview`,
          };
          if (alive) setResolved(fallback);
          return;
        }

        if (url) {
          if (alive)
            setResolved({
              id: undefined,
              type: artifactType,
              content_url: url,
              preview_url: url,
              url,
            });
        }
      };

      run();
      return () => {
        alive = false;
      };
    }, [artifactType, backendUrl, id, resolver, url, api?.utils.backendUrl]);

    const src =
      variant === "content"
        ? resolved?.content_url
        : resolved?.preview_url || resolved?.content_url;

    const artifactHintIsAudio = isAudioType(artifactType);
    const resolvedType = artifactHintIsAudio
      ? artifactType
      : resolved?.type || artifactType;
    const hasImagePreview = isImageUrl(resolved?.preview_url);
    const isAudio =
      isAudioType(resolvedType) ||
      artifactHintIsAudio ||
      AUDIO_EXTENSIONS.has(extensionFromUrl(resolved?.content_url || url));

    if (isAudio && !hasImagePreview) {
      const audioSrc = resolved?.content_url || url || "";
      const apiKey = api?.utils.getApiKey?.();
      const appendAuth = (value: string) => {
        if (!value || !apiKey) return value;
        try {
          const urlObj = new URL(value, window.location.origin);
          urlObj.searchParams.set("api_key", apiKey);
          return urlObj.toString();
        } catch {
          return value;
        }
      };

      const handleAudioDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        let baseUrl = backendUrl || api?.utils.backendUrl || "";
        baseUrl = baseUrl.replace(/\/api\/v\d+\/?$/, "").replace(/\/$/, "");
        if (baseUrl) {
          baseUrl = `${baseUrl}/api/v1`;
        } else {
          baseUrl = "/api/v1";
        }

        let contentUrl = resolved?.content_url || url || "";
        let previewUrl = resolved?.preview_url || "";

        if (!contentUrl && id && baseUrl) {
          contentUrl = `${baseUrl}/artifacts/${id}/content`;
        }
        if (!previewUrl && id && baseUrl) {
          previewUrl = `${baseUrl}/artifacts/${id}/preview`;
        }

        contentUrl = appendAuth(contentUrl);
        previewUrl = appendAuth(previewUrl);

        if (id) {
          e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT_ID, id);
          e.dataTransfer.setData(EmbeddrDnDTypes.IMAGE_ID, id);
        }

        e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT_TYPE, resolvedType);
        e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT_PATH, artifactPath);

        if (contentUrl) {
          e.dataTransfer.setData("text/plain", contentUrl);
        }

        if (previewUrl) {
          e.dataTransfer.setData(EmbeddrDnDTypes.PREVIEW_URL, previewUrl);
        }

        const payload = {
          id: id ?? null,
          type: resolvedType,
          content_url: contentUrl || null,
          preview_url: previewUrl || null,
          path: artifactPath || null,
          ...(resolved?.payload ?? {}),
        };
        e.dataTransfer.setData(
          EmbeddrDnDTypes.ARTIFACT,
          JSON.stringify(payload),
        );

        e.dataTransfer.effectAllowed = "copy";

        if (onDragStart) {
          onDragStart(e as unknown as React.DragEvent<HTMLImageElement>);
        }
      };

      const audioNode = (
        <div
          className={cn(
            "flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/60 p-3 text-muted-foreground",
            className,
          )}
          draggable
          onDragStart={handleAudioDragStart}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Music className="h-5 w-5" />
            Audio
          </div>
          {variant === "content" && audioSrc ? (
            <audio controls src={audioSrc} className="w-full max-w-xs" />
          ) : (
            <div className="text-xs">No preview available</div>
          )}
        </div>
      );

      if (contextMenuDisabled) return audioNode;

      return (
        <ArtifactContextMenu
          context={{
            api,
            artifactId: resolved?.id ?? id,
            artifactType: resolvedType,
            artifactPath,
            src: audioSrc,
            contentUrl: resolved?.content_url,
            previewUrl: resolved?.preview_url,
            artifactPayload: resolved?.payload,
          }}
          mode={contextMenuMode}
          actions={contextMenuActions}
          resolveActions={resolveContextMenuActions}
        >
          {audioNode}
        </ArtifactContextMenu>
      );
    }

    return (
      <EmbeddrImage
        ref={ref}
        id={resolved?.id ?? id}
        src={src}
        backendUrl={backendUrl || api?.utils.backendUrl}
        artifactType={resolvedType}
        artifactPath={artifactPath}
        contentUrl={resolved?.content_url}
        previewUrl={resolved?.preview_url}
        artifactPayload={resolved?.payload}
        contextMenuDisabled={contextMenuDisabled}
        contextMenuMode={contextMenuMode}
        contextMenuActions={contextMenuActions}
        resolveContextMenuActions={resolveContextMenuActions}
        className={cn("h-full w-full object-cover", className)}
        {...props}
      />
    );
  },
);

EmbeddrArtifact.displayName = "EmbeddrArtifact";
