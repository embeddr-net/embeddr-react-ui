import { useEffect, useState } from "react";
import { useEmbeddr } from "./useEmbeddr";
import { getArtifactUrls } from "./useArtifact";

export interface ResolvedArtifact {
  id?: string;
  type?: string;
  content_url?: string;
  preview_url?: string;
  title?: string;
  url?: string;
  payload?: Record<string, any>;
}

export function useResolvedArtifact(input: {
  artifactId?: string;
  url?: string;
  hintType?: string;
  adapterId?: string;
}) {
  const { utils, resources } = useEmbeddr();
  const [resolved, setResolved] = useState<ResolvedArtifact | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const { artifactId, url, hintType, adapterId } = input;
      if (!artifactId && !url) {
        setResolved(null);
        return;
      }

      setLoading(true);
      try {
        if (resources?.resolve) {
          const out = await resources.resolve({
            artifactId,
            url,
            hintType,
            adapterId,
          });
          if (alive) setResolved(out ?? null);
          return;
        }

        if (artifactId) {
          const fallback = getArtifactUrls(utils.backendUrl, artifactId);
          if (alive)
            setResolved({
              id: fallback.id,
              type: hintType,
              content_url: fallback.fileUrl,
              preview_url: fallback.previewUrl,
            });
          return;
        }

        if (url && alive) {
          setResolved({
            id: artifactId,
            type: hintType,
            content_url: url,
            preview_url: url,
            url,
          });
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [input, resources, utils.backendUrl]);

  return { resolved, loading };
}
