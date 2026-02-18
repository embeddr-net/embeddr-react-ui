import React, { useMemo } from "react";
import { EmbeddrDnDTypes } from "../../lib/dnd";
import { cn } from "../../lib/utils";
import { useOptionalEmbeddrAPI } from "../../context/EmbeddrContext";

export interface EmbeddrImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  id?: string; // The Artifact ID (optional for external resources)
  backendUrl?: string; // Base URL of the backend (e.g. http://localhost:8080)
  artifactType?: string; // defaults to 'image'
  artifactPath?: string; // Optional local path if known
  contentUrl?: string; // Normalized content URL
  previewUrl?: string; // Normalized preview URL
  artifactPayload?: Record<string, any>; // Optional full payload for DnD
}

export const EmbeddrImage = React.forwardRef<
  HTMLImageElement,
  EmbeddrImageProps
>(
  (
    {
      id,
      src,
      backendUrl = "",
      artifactType = "image",
      artifactPath = "",
      contentUrl: contentUrlProp,
      previewUrl: previewUrlProp,
      artifactPayload,
      onDragStart,
      className,
      ...props
    },
    ref,
  ) => {
    const api = useOptionalEmbeddrAPI();
    const apiBackendUrl = api?.utils.backendUrl ?? "";
    const effectiveBackendUrl = backendUrl || apiBackendUrl;

    const signedSrc = useMemo(() => {
      if (!src) return src;
      const apiKey = api?.utils.getApiKey?.();
      if (!apiKey) return src;

      try {
        const urlObj = new URL(src, window.location.origin);
        // Simple heuristic: if it points to /api/, sign it.
        // This covers both relative /api/... and absolute http://.../api/...
        if (urlObj.pathname.includes("/api/")) {
          urlObj.searchParams.set("api_key", apiKey);
          // Also redundant check: confirm we aren't leaking to some random domain?
          // Assuming /api/ convention is internal for now or user trusted plugins.
          return urlObj.toString();
        }
      } catch (e) {}
      return src;
    }, [src, api]);

    // Default drag handler
    const handleDragStart = (e: React.DragEvent<HTMLImageElement>) => {
      // Construct V2 API URLs
      // We assume backendUrl is the root (e.g. http://localhost:8003) or api base.
      // Ensure we use v2
      let baseUrl = effectiveBackendUrl;

      // Strip any existing api version
      baseUrl = baseUrl.replace(/\/api\/v\d+\/?$/, "").replace(/\/$/, "");

      // Append /api/v2
      if (baseUrl) {
        // Even if empty (relative), we want /api/v2
        baseUrl = `${baseUrl}/api/v1`;
      } else {
        baseUrl = "/api/v1";
      }

      const apiKey = api?.utils.getApiKey?.();
      const appendAuth = (url: string) => {
        if (!url || !apiKey) return url;
        try {
          const u = new URL(url, window.location.origin);
          u.searchParams.set("api_key", apiKey);
          return u.toString();
        } catch {
          return url;
        }
      };

      let contentUrl = contentUrlProp || src || "";
      let previewUrl = previewUrlProp || "";

      if (!contentUrl && id && baseUrl) {
        contentUrl = `${baseUrl}/artifacts/${id}/content`;
      }
      if (!previewUrl && id && baseUrl) {
        previewUrl = `${baseUrl}/artifacts/${id}/preview`;
      }

      // Sign the URLs before dragging
      contentUrl = appendAuth(contentUrl);
      previewUrl = appendAuth(previewUrl);

      if (id) {
        e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT_ID, id);
        // Legacy compat
        e.dataTransfer.setData(EmbeddrDnDTypes.IMAGE_ID, id);
      }

      e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT_TYPE, artifactType);

      e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT_PATH, artifactPath);

      // Set URL in text/plain for general compatibility
      if (contentUrl) {
        e.dataTransfer.setData("text/plain", contentUrl);
      }

      // Set specific URL types
      if (previewUrl) {
        e.dataTransfer.setData(EmbeddrDnDTypes.PREVIEW_URL, previewUrl);
      }

      if (artifactType === "video") {
        e.dataTransfer.setData(EmbeddrDnDTypes.VIDEO_URL, contentUrl);
      } else {
        // Default to image if generic or specific image
        if (contentUrl) {
          e.dataTransfer.setData(EmbeddrDnDTypes.IMAGE_URL, contentUrl);
        }
      }

      const payload = {
        id: id ?? null,
        type: artifactType,
        content_url: contentUrl || null,
        preview_url: previewUrl || null,
        path: artifactPath || null,
        ...artifactPayload,
      };
      e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT, JSON.stringify(payload));

      e.dataTransfer.effectAllowed = "copy";

      console.log("[EmbeddrImage] DragStart", {
        id,
        type: artifactType,
        url: contentUrl,
        previewUrl,
      });

      // Call user provided handler if any to allow overrides
      if (onDragStart) onDragStart(e);
    };

    return (
      <img
        ref={ref}
        src={signedSrc}
        draggable
        onDragStart={handleDragStart}
        className={cn("hover:border-primary", className)}
        {...props}
      />
    );
  },
);

EmbeddrImage.displayName = "EmbeddrImage";
