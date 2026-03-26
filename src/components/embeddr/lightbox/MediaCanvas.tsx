import React from "react";
import { cn } from "../../../lib/utils";
import { useOptionalEmbeddrAPI } from "../../../context/EmbeddrContext";
import { PannableImage } from "./PannableImage";
import { PannableVideo } from "./PannableVideo";
import { ComparisonSlider } from "./ComparisonSlider";
import type { PannableImageAction } from "./PannableImage";

export interface MediaCanvasProps {
  mode: "single" | "compare";
  primaryImage: string;
  secondaryImage?: string;
  className?: string;
  pannableActions?: Array<PannableImageAction>;
  children?: React.ReactNode;
  mediaType?: "image" | "video";
  apiKey?: string;
}

export function MediaCanvas({
  mode,
  primaryImage,
  secondaryImage,
  className,
  pannableActions,
  children,
  mediaType,
  apiKey: apiKeyProp,
}: MediaCanvasProps) {
  const embeddrApi = useOptionalEmbeddrAPI();
  const apiKey = apiKeyProp || embeddrApi?.utils.getApiKey?.() || undefined;

  const isVideo = (src?: string) => {
    if (mediaType === "video") return true;
    if (mediaType === "image") return false;
    return src && /\.(mp4|webm|mov|mkv)$/i.test(src);
  };

  return (
    <div
      className={cn(
        "w-full h-full relative overflow-hidden bg-muted/20",
        className,
      )}
    >
      {mode === "single" &&
        (isVideo(primaryImage) ? (
          <PannableVideo
            src={primaryImage}
            className="w-full h-full"
            isOpen={true}
            apiKey={apiKey}
          />
        ) : (
          <PannableImage
            src={primaryImage}
            className="w-full h-full"
            isOpen={true}
            actions={pannableActions}
            apiKey={apiKey}
          />
        ))}
      {mode === "compare" && secondaryImage && (
        <ComparisonSlider
          before={secondaryImage}
          after={primaryImage}
          className="w-full h-full"
          apiKey={apiKey}
        />
      )}
      {children}
    </div>
  );
}
