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

type ReactiveArtifactState = {
  artifactId: string | null;
  updatedAt: string;
};

const REACTIVE_STATE_EVENT = "embeddr:reactive:state";
const REACTIVE_STATE_STORAGE_PREFIX = "embeddr:reactive:artifact:";

const normalizeScope = (scope?: string) => {
  const value = String(scope || "global").trim();
  return value
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9:/._-]/g, "_")
    .toLowerCase();
};

const normalizeUri = (uri: string) => String(uri || "").trim();

const reactiveStateStorageKey = (uri: string, scope?: string) => {
  const normalizedUri = normalizeUri(uri);
  const normalizedScope = normalizeScope(scope);
  return `${REACTIVE_STATE_STORAGE_PREFIX}${normalizedScope}:${normalizedUri}`;
};

const toArray = (value?: string | Array<string>) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getPathValue = (obj: any, path: string) => {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur = obj;
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
    const match = entry.match;
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

export const readReactiveArtifactState = (params: {
  uri: string;
  scope?: string;
}): ReactiveArtifactState | null => {
  const uri = normalizeUri(params.uri);
  if (!uri) return null;
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(
      reactiveStateStorageKey(uri, params.scope),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      artifactId: parsed.artifactId ? String(parsed.artifactId) : null,
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
};

export const publishReactiveArtifactState = (params: {
  uri: string;
  artifactId?: string | null;
  scope?: string;
}) => {
  const uri = normalizeUri(params.uri);
  if (!uri) return null;

  const payload: ReactiveArtifactState = {
    artifactId: params.artifactId ? String(params.artifactId) : null,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        reactiveStateStorageKey(uri, params.scope),
        JSON.stringify(payload),
      );
    }
  } catch {
    // no-op
  }

  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(REACTIVE_STATE_EVENT, {
          detail: {
            uri,
            scope: normalizeScope(params.scope),
            payload,
          },
        }),
      );
    }
  } catch {
    // no-op
  }

  return payload;
};

export const subscribeReactiveArtifactState = (
  params: { uri: string; scope?: string },
  onUpdate: (state: ReactiveArtifactState | null) => void,
) => {
  const uri = normalizeUri(params.uri);
  if (!uri || typeof window === "undefined") return () => undefined;

  const targetScope = normalizeScope(params.scope);
  const targetKey = reactiveStateStorageKey(uri, params.scope);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== targetKey) return;
    onUpdate(readReactiveArtifactState({ uri, scope: params.scope }));
  };

  const onCustom = (event: Event) => {
    const custom = event as CustomEvent;
    const detail = custom.detail || {};
    if (String(detail.uri || "") !== uri) return;
    if (String(detail.scope || "") !== targetScope) return;
    onUpdate(detail.payload as ReactiveArtifactState);
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(REACTIVE_STATE_EVENT, onCustom as EventListener);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(REACTIVE_STATE_EVENT, onCustom as EventListener);
  };
};
