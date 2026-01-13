import React from "react";
import { EmbeddrDnDTypes } from "../lib/dnd";
import { cn } from "../lib/utils";

export interface EmbeddrImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  id: string; // The Artifact ID
  backendUrl?: string; // Base URL of the backend (e.g. http://localhost:8080)
  artifactType?: string; // defaults to 'image'
  artifactPath?: string; // Optional local path if known
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
      onDragStart,
      className,
      ...props
    },
    ref
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

      let contentUrl = src || "";
      let previewUrl = "";

      if (baseUrl) {
        contentUrl = `${baseUrl}/artifacts/${id}/content`;
        previewUrl = `${baseUrl}/artifacts/${id}/preview`;
      }

      e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT_ID, id);
      // Legacy compat
      e.dataTransfer.setData(EmbeddrDnDTypes.IMAGE_ID, id);

      e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT_TYPE, artifactType);

      e.dataTransfer.setData(EmbeddrDnDTypes.ARTIFACT_PATH, artifactPath);

      // Set URL in text/plain for general compatibility
      e.dataTransfer.setData("text/plain", contentUrl);

      // Set specific URL types
      if (previewUrl) {
        e.dataTransfer.setData(EmbeddrDnDTypes.PREVIEW_URL, previewUrl);
      }

      if (artifactType === "video") {
        e.dataTransfer.setData(EmbeddrDnDTypes.VIDEO_URL, contentUrl);
      } else {
        // Default to image if generic or specific image
        e.dataTransfer.setData(EmbeddrDnDTypes.IMAGE_URL, contentUrl);
      }

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
        className={cn("hover:border-1 hover:border-primary", className)}
        {...props}
      />
    );
  }
);

EmbeddrImage.displayName = "EmbeddrImage";
