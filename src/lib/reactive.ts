export type ReactiveConfig = {
  source?: string | Array<string>;
  types?: Array<string>;
  artifactIdPaths?: Array<string>;
  previewPaths?: Array<string>;
  processingTypes?: Array<string>;
  doneTypes?: Array<string>;
  errorTypes?: Array<string>;
};

export type ReactiveMatch = {
  type?: string;
  urlPrefix?: string;
  artifactType?: string;
};

export type ReactiveRegistryEntry = {
  match: ReactiveMatch;
  config: ReactiveConfig;
};

const toArray = (value?: string | Array<string>) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getPathValue = (obj: any, path: string) => {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur = obj as any;
  for (const part of parts) {
    if (cur == null) return undefined;
    const key = part.trim();
    if (!key) return undefined;
    if (Array.isArray(cur) && /^\d+$/.test(key)) {
      cur = cur[Number(key)];
      continue;
    }
    cur = cur[key];
  }
  return cur;
};

const extractFirst = (obj: any, paths?: Array<string>) => {
  if (!paths || paths.length === 0) return undefined;
  for (const path of paths) {
    const value = getPathValue(obj, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

export const matchReactiveMessage = (msg: any, config?: ReactiveConfig) => {
  if (!msg || !config) return false;
  const sources = toArray(config.source);
  if (sources.length > 0 && !sources.includes(msg.source)) {
    return false;
  }
  if (
    config.types &&
    config.types.length > 0 &&
    !config.types.includes(msg.type)
  ) {
    return false;
  }
  return true;
};

export const extractReactiveArtifactId = (
  msg: any,
  config?: ReactiveConfig,
) => {
  if (!config) return undefined;
  return extractFirst(msg, config.artifactIdPaths);
};

export const extractReactivePreview = (msg: any, config?: ReactiveConfig) => {
  if (!config) return undefined;
  return extractFirst(msg, config.previewPaths);
};

const registry: Array<ReactiveRegistryEntry> = [];

const entryKey = (entry: ReactiveRegistryEntry) => JSON.stringify(entry);

export const registerReactiveContext = (entry: ReactiveRegistryEntry) => {
  const key = entryKey(entry);
  if (!registry.find((existing) => entryKey(existing) === key)) {
    registry.push(entry);
  }
  return () => {
    const idx = registry.findIndex((existing) => entryKey(existing) === key);
    if (idx >= 0) registry.splice(idx, 1);
  };
};

export const resolveReactiveConfig = (params: {
  type?: string;
  url?: string;
  artifactType?: string;
}): ReactiveConfig | undefined => {
  const type = (params.type || params.artifactType || "").toLowerCase();
  const url = params.url || "";

  for (const entry of registry) {
    const match = entry.match || {};
    if (match.type && match.type.toLowerCase() !== type) {
      continue;
    }
    if (match.artifactType && match.artifactType.toLowerCase() !== type) {
      continue;
    }
    if (match.urlPrefix && !url.startsWith(match.urlPrefix)) {
      continue;
    }
    return entry.config;
  }
  return undefined;
};
