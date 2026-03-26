import { useEffect, useState } from "react";
import { useEmbeddr } from "./useEmbeddr";

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
  const { resources } = useEmbeddr();
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
        const out = await resources.resolve({
          artifactId,
          url,
          hintType,
          adapterId,
        });
        if (alive) setResolved(out);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [input, resources]);

  return { resolved, loading };
}
