export type ArtifactGraphBundle = {
  artifact: any | null;
  relations: Array<any>;
  annotations: Array<any>;
  embeddings: Array<any>;
  features: Array<any>;
  lineage: { parents?: Array<any>; children?: Array<any> } | null;
};

type EmbeddrApiLike = {
  artifacts?: {
    get?: (id: string) => Promise<any>;
    getRelations?: (id: string) => Promise<Array<any>>;
    getAnnotations?: (id: string) => Promise<Array<any>>;
    getEmbeddings?: (id: string) => Promise<Array<any>>;
    getFeatures?: (id: string) => Promise<Array<any>>;
    getLineage?: (
      id: string,
    ) => Promise<{ parents?: Array<any>; children?: Array<any> }>;
  };
};

const toArray = (value: unknown): Array<any> => {
  if (Array.isArray(value)) return value;
  return [];
};

async function maybeCall<T>(fn?: () => Promise<T>, fallback?: T): Promise<T> {
  if (!fn) return fallback as T;
  try {
    const value = await fn();
    return value;
  } catch {
    return fallback as T;
  }
}

export async function fetchArtifactGraphBundle(
  api: EmbeddrApiLike,
  artifactId: string,
): Promise<ArtifactGraphBundle> {
  const artifactsApi = api.artifacts;
  const getArtifact = artifactsApi?.get;
  const getRelations = artifactsApi?.getRelations;
  const getAnnotations = artifactsApi?.getAnnotations;
  const getEmbeddings = artifactsApi?.getEmbeddings;
  const getFeatures = artifactsApi?.getFeatures;
  const getLineage = artifactsApi?.getLineage;

  const [artifact, relations, annotations, embeddings, features, lineage] =
    await Promise.all([
      maybeCall(getArtifact ? () => getArtifact(artifactId) : undefined, null),
      maybeCall(getRelations ? () => getRelations(artifactId) : undefined, []),
      maybeCall(
        getAnnotations ? () => getAnnotations(artifactId) : undefined,
        [],
      ),
      maybeCall(
        getEmbeddings ? () => getEmbeddings(artifactId) : undefined,
        [],
      ),
      maybeCall(getFeatures ? () => getFeatures(artifactId) : undefined, []),
      maybeCall(getLineage ? () => getLineage(artifactId) : undefined, null),
    ]);

  return {
    artifact,
    relations: toArray(relations),
    annotations: toArray(annotations),
    embeddings: toArray(embeddings),
    features: toArray(features),
    lineage: lineage || null,
  };
}

export function getLatestAnnotation(
  annotations: Array<any>,
  annotationType: string,
): any | null {
  const matches = toArray(annotations)
    .filter((ann: any) => ann?.annotation_type === annotationType)
    .sort((a: any, b: any) => {
      const aTs = new Date(a?.created_at || 0).getTime();
      const bTs = new Date(b?.created_at || 0).getTime();
      return bTs - aTs;
    });
  return matches[0] || null;
}

export function parseComfyWorkflowInputs(annotations: Array<any>): {
  workflowArtifactId?: string;
  workflowName?: string;
  inputs?: Record<string, any>;
} | null {
  const latest = getLatestAnnotation(annotations, "comfyui:workflow_inputs");
  if (!latest?.text) return null;
  try {
    const parsed = JSON.parse(latest.text);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      workflowArtifactId: parsed.workflow_artifact_id || parsed.workflow_id,
      workflowName: parsed.workflow_name,
      inputs:
        parsed.inputs && typeof parsed.inputs === "object"
          ? parsed.inputs
          : undefined,
    };
  } catch {
    return null;
  }
}
