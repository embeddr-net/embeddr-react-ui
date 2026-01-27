import React from "react";
import { cn } from "../lib/utils";
import { EmbeddrImage } from "./EmbeddrImage";

export interface EmbeddrArtifactProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
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
}

function buildV2Base(backendUrl?: string) {
  let base = backendUrl ?? "";
  base = base.replace(/\/api\/v\d+\/?$/, "").replace(/\/+$/, "");
  return `${base}/api/v2`;
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
      className,
      ...props
    },
    ref
  ) => {
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

        const base = buildV2Base(backendUrl);
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
    }, [artifactType, backendUrl, id, resolver, url]);

    const src =
      variant === "content"
        ? resolved?.content_url
        : resolved?.preview_url || resolved?.content_url;

    return (
      <EmbeddrImage
        ref={ref}
        id={resolved?.id ?? id}
        src={src}
        backendUrl={backendUrl}
        artifactType={resolved?.type || artifactType}
        artifactPath={artifactPath}
        contentUrl={resolved?.content_url}
        previewUrl={resolved?.preview_url}
        artifactPayload={resolved?.payload}
        className={cn("h-full w-full object-cover", className)}
        {...props}
      />
    );
  }
);

EmbeddrArtifact.displayName = "EmbeddrArtifact";
