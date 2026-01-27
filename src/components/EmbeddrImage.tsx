import React from "react";
import { EmbeddrDnDTypes } from "../lib/dnd";
import { cn } from "../lib/utils";

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
    // Default drag handler
    const handleDragStart = (e: React.DragEvent<HTMLImageElement>) => {
      // Construct V2 API URLs
      // We assume backendUrl is the root (e.g. http://localhost:8003) or api base.
      // Ensure we use v2
      let baseUrl = backendUrl || "";

      // Strip any existing api version
      baseUrl = baseUrl.replace(/\/api\/v\d+\/?$/, "").replace(/\/$/, "");

      // Append /api/v2
      if (baseUrl || backendUrl === "") {
        // Even if empty (relative), we want /api/v2
        baseUrl = `${baseUrl}/api/v2`;
      }

      let contentUrl = contentUrlProp || src || "";
      let previewUrl = previewUrlProp || "";

      if (!contentUrl && id && baseUrl) {
        contentUrl = `${baseUrl}/artifacts/${id}/content`;
      }
      if (!previewUrl && id && baseUrl) {
        previewUrl = `${baseUrl}/artifacts/${id}/preview`;
      }

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
        src={src}
        draggable
        onDragStart={handleDragStart}
        className={cn("hover:border-primary", className)}
        {...props}
      />
    );
  },
);

EmbeddrImage.displayName = "EmbeddrImage";
