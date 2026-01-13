import { useCallback, useState, type DragEvent } from "react";
import { EmbeddrDnDTypes } from "../lib/dnd";

export interface UsePluginDropOptions {
  /** Callback when an internal artifact is dropped */
  onArtifact?: (data: {
    id: string;
    type: string;
    previewUrl?: string;
    imageUrl?: string;
    videoUrl?: string;
  }) => void;
  /** Callback when external files are dropped */
  onFile?: (file: File) => void;
  /** Callback when a URL string is dropped */
  onUrl?: (url: string) => void;
  /** Callback when plain text is dropped */
  onText?: (text: string) => void;
  /** Whether to stop event propagation (default: true) */
  stopPropagation?: boolean;
}

export function usePluginDrop({
  onArtifact,
  onFile,
  onUrl,
  onText,
  stopPropagation = true,
}: UsePluginDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      setIsDragOver(true);
    },
    [stopPropagation]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      setIsDragOver(false);
    },
    [stopPropagation]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      setIsDragOver(false);

      const dt = e.dataTransfer;

      // 0. Check for ARTIFACT_ID (Granular fallback)
      const artifactId =
        dt.getData(EmbeddrDnDTypes.ARTIFACT_ID) ||
        dt.getData(EmbeddrDnDTypes.IMAGE_ID);
      if (artifactId && onArtifact) {
        const type = dt.getData(EmbeddrDnDTypes.ARTIFACT_TYPE) || "image";
        const previewUrl = dt.getData(EmbeddrDnDTypes.PREVIEW_URL);
        const imageUrl = dt.getData(EmbeddrDnDTypes.IMAGE_URL);
        const videoUrl = dt.getData(EmbeddrDnDTypes.VIDEO_URL);

        // Construct a minimal object
        onArtifact({
          id: artifactId,
          type,
          previewUrl,
          imageUrl,
          videoUrl,
        });
        return;
      }

      // 1. Check for Internal Artifact
      const artifactJson = dt.getData(EmbeddrDnDTypes.ARTIFACT);
      if (artifactJson && onArtifact) {
        try {
          const artifact = JSON.parse(artifactJson);
          onArtifact(artifact);
          return;
        } catch (err) {
          console.error("Failed to parse dropped artifact", err);
        }
      }

      // 2. Check for Files
      if (dt.files && dt.files.length > 0 && onFile) {
        Array.from(dt.files).forEach((file) => onFile(file));
        return;
      }

      // 3. Check for URL
      const url = dt.getData("text/uri-list");
      if (url && onUrl) {
        onUrl(url);
        return;
      }

      // 4. Check for Text (fallback)
      const text = dt.getData("text/plain");
      if (text) {
        if (text.startsWith("http") && onUrl) {
          onUrl(text);
        } else if (onText) {
          onText(text);
        }
      }
    },
    [onArtifact, onFile, onUrl, onText, stopPropagation]
  );

  return {
    handleDragOver,
    handleDragLeave,
    handleDrop,
    isDragOver,
  };
}
