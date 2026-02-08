import type { EmbeddrAPI, EmbeddrEventMap } from "../types";

type Listener = (state: any) => void;

type PanelSnapshot = {
  id: string;
  title?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isPinned: boolean;
  isMinimized: boolean;
  isBackdrop: boolean;
  isActive: boolean;
  isHovered: boolean;
};

type GuestClientOptions = {
  publicUrl: string;
  apiUrl?: string;
  apiKey?: string | null;
  getApiKey?: () => string | null;
  pluginId?: string;
  panelSelector?: string;
  panelPollIntervalMs?: number;
  panelMapper?: (el: HTMLElement) => PanelSnapshot | null;
};

type EventListener<T = any> = (payload: T) => void;

type EventBus = {
  on: <TEvent extends keyof EmbeddrEventMap>(
    event: TEvent,
    listener: (payload: EmbeddrEventMap[TEvent]) => void,
  ) => () => void;
  off: <TEvent extends keyof EmbeddrEventMap>(
    event: TEvent,
    listener: (payload: EmbeddrEventMap[TEvent]) => void,
  ) => void;
  emit: <TEvent extends keyof EmbeddrEventMap>(
    event: TEvent,
    payload: EmbeddrEventMap[TEvent],
  ) => void;
};

const normalizeBase = (url: string) => url.replace(/\/$/, "");

const joinPath = (base: string, path: string) => {
  if (!path) return base;
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${path}`;
};

const createEventBus = (): EventBus => {
  const listeners = new Map<string, Set<EventListener>>();

  return {
    on: (event, listener) => {
      const key = String(event);
      const set = listeners.get(key) ?? new Set();
      set.add(listener as EventListener);
      listeners.set(key, set);
      return () => {
        set.delete(listener as EventListener);
      };
    },
    off: (event, listener) => {
      const key = String(event);
      const set = listeners.get(key);
      if (set) set.delete(listener as EventListener);
    },
    emit: (event, payload) => {
      const key = String(event);
      const set = listeners.get(key);
      if (!set) return;
      set.forEach((listener) => listener(payload));
    },
  };
};

const defaultPanelMapper = (el: HTMLElement): PanelSnapshot | null => {
  const rect = el.getBoundingClientRect();
  const id = el.dataset.panelId;
  if (!id) return null;
  return {
    id,
    title: el.dataset.panelTitle || undefined,
    position: { x: rect.left, y: rect.top },
    size: { width: rect.width, height: rect.height },
    isPinned: false,
    isMinimized: rect.height < 40,
    isBackdrop: false,
    isActive: el.matches(":focus-within") || el.matches(":focus"),
    isHovered: el.matches(":hover"),
  };
};

export function createEmbeddrGuestClient(
  options: GuestClientOptions,
): EmbeddrAPI {
  const publicUrl = normalizeBase(options.publicUrl);
  const apiUrl = normalizeBase(options.apiUrl || `${publicUrl}/api/v1`);
  const getApiKey = options.getApiKey ?? (() => options.apiKey ?? null);
  const pluginId = options.pluginId ?? null;
  const panelSelector = options.panelSelector ?? "[data-panel-role='panel']";
  const panelPollIntervalMs = options.panelPollIntervalMs ?? 200;
  const panelMapper = options.panelMapper ?? defaultPanelMapper;

  const eventBus = createEventBus();

  const withApiKey = (headers: HeadersInit = {}) => {
    const next = new Headers(headers);
    const apiKey = getApiKey();
    if (apiKey) next.set("X-API-Key", apiKey);
    return next;
  };

  const fetchJson = async <T = any>(
    url: string,
    init: RequestInit = {},
  ): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      headers: withApiKey(init.headers),
      credentials: init.credentials ?? "include",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Request failed: ${response.status} ${response.statusText} ${detail}`,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  };

  const pluginBaseUrl = pluginId
    ? `${publicUrl}/api/v2/plugins/${pluginId}`
    : null;

  const readPanelsFromDom = () => {
    if (typeof document === "undefined") return [] as Array<PanelSnapshot>;
    const panels = Array.from(
      document.querySelectorAll<HTMLElement>(panelSelector),
    );

    return panels
      .map((el) => panelMapper(el))
      .filter((panel): panel is PanelSnapshot => Boolean(panel));
  };

  const workspaceState = {
    workspaces: {},
    activeWorkspaceId: null,
  };
  const workspaceListeners = new Set<Listener>();

  const notifyWorkspace = () => {
    workspaceListeners.forEach((listener) => listener(workspaceState));
  };

  return {
    stores: {
      global: {
        selectedImage: null,
        selectImage: () => undefined,
      },
      generation: {
        workflows: [],
        selectedWorkflow: null,
        generations: [],
        isGenerating: false,
        generate: () => Promise.resolve(undefined),
        setWorkflowInput: () => undefined,
        selectWorkflow: () => undefined,
      },
    },
    ui: {
      activePanelId: null,
      isPanelActive: () => false,
    },
    workspaces: {
      getState: () => workspaceState,
      subscribe: (listener: Listener) => {
        workspaceListeners.add(listener);
        return () => workspaceListeners.delete(listener);
      },
      list: () => [],
      getActiveId: () => null,
      ensureDefault: () => undefined,
      create: () => {
        notifyWorkspace();
        return "workspace";
      },
      save: () => undefined,
      saveActive: () => undefined,
      apply: () => undefined,
      rename: () => undefined,
      clone: () => null,
      remove: () => undefined,
      setTemplate: () => undefined,
    },
    settings: {
      get: (_key, defaultValue) => defaultValue as any,
      set: () => undefined,
      getPlugin: (_pluginId, _key, defaultValue) => defaultValue as any,
      setPlugin: () => undefined,
    },
    toast: {
      success: (message) => console.info(message),
      error: (message) => console.error(message),
      info: (message) => console.info(message),
    },
    events: eventBus,
    windows: {
      open: (_id, _title, _componentId, _props) => undefined,
      spawn: (_componentId, _title, _props) => "",
      register: (_id, _component) => undefined,
      close: () => undefined,
      minimize: () => undefined,
      restore: () => undefined,
      list: () => [],
    },
    lotus: {
      invoke: (_capId, _input) =>
        Promise.resolve({ ok: false, error: "Lotus unavailable" }),
      query: (_query, _limit) => Promise.resolve({ results: [] }),
      list: (_input) =>
        Promise.resolve({ items: [], total: 0, limit: 0, offset: 0 }),
    },
    artifacts: {
      list: async (input) =>
        fetchJson(
          `${apiUrl}/artifacts/?${new URLSearchParams({
            limit: String(input.limit ?? 50),
            offset: String(input.offset ?? 0),
            ...(input.type_name ? { type_name: input.type_name } : {}),
            ...(input.sort ? { sort: input.sort } : {}),
          }).toString()}`,
        ),
      get: async (id) => fetchJson(`${apiUrl}/artifacts/${id}`),
      getRelations: async (id) =>
        fetchJson(`${apiUrl}/artifacts/${id}/relations`),
      addRelation: (_input) => Promise.resolve(undefined),
      getContentUrl: (id) => `${apiUrl}/artifacts/${id}/content`,
      resolve: async ({ id, variant }) =>
        fetchJson(`${apiUrl}/artifacts/${id}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variant }),
        }),
      create: (_input) =>
        Promise.reject(
          new Error("Artifact creation is disabled in guest mode"),
        ),
      update: (_id, _input) =>
        Promise.reject(
          new Error("Artifact updates are disabled in guest mode"),
        ),
      delete: (_id) =>
        Promise.reject(
          new Error("Artifact deletes are disabled in guest mode"),
        ),
      uploadInit: (_input) =>
        Promise.reject(new Error("Uploads are disabled in guest mode")),
      uploadComplete: (_input) =>
        Promise.reject(new Error("Uploads are disabled in guest mode")),
      uploadFile: (_input) =>
        Promise.reject(new Error("Uploads are disabled in guest mode")),
    },
    resources: {
      resolve: async (input) =>
        fetchJson(`${apiUrl}/resources/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifact_id: input.artifactId,
            url: input.url,
            hint_type: input.hintType,
            adapter_id: input.adapterId,
            artifact_payload: input.artifactPayload,
          }),
        }),
    },
    utils: {
      backendUrl: apiUrl,
      getApiKey: () => getApiKey(),
      getPanels: () => readPanelsFromDom(),
      subscribePanelState: (
        listener: (panels: Array<PanelSnapshot>) => void,
      ) => {
        let active = true;
        let lastKey = "";
        const emitIfChanged = () => {
          if (!active) return;
          const panels = readPanelsFromDom();
          const key = panels
            .map(
              (panel) =>
                `${panel.id}:${panel.position.x.toFixed(1)},${panel.position.y.toFixed(1)},${panel.size.width.toFixed(1)},${panel.size.height.toFixed(1)}`,
            )
            .join("|");
          if (key !== lastKey) {
            lastKey = key;
            listener(panels);
          }
        };

        emitIfChanged();
        const interval = window.setInterval(emitIfChanged, panelPollIntervalMs);
        const onResize = () => emitIfChanged();
        window.addEventListener("resize", onResize);

        return () => {
          active = false;
          window.clearInterval(interval);
          window.removeEventListener("resize", onResize);
        };
      },
      uploadImage: (_input) =>
        Promise.reject(new Error("Upload disabled in guest mode")),
      getPluginUrl: (path: string) => {
        if (!pluginId) {
          return joinPath(publicUrl, path);
        }
        return joinPath(`${publicUrl}/api/v2/plugins/${pluginId}`, path);
      },
    },
    client: {
      plugins: {
        call: async (targetPluginId, path, method, body) => {
          const url = joinPath(
            `${publicUrl}/api/v2/plugins/${targetPluginId}`,
            path,
          );
          const init: RequestInit = {
            method,
            headers: { "Content-Type": "application/json" },
          };
          if (body !== undefined) {
            init.body = JSON.stringify(body);
          }
          return fetchJson(url, init);
        },
      },
    },
    plugin: {
      fetch: async (path, init = {}) => {
        if (!pluginBaseUrl) {
          throw new Error("Plugin API unavailable without pluginId");
        }
        const url = joinPath(pluginBaseUrl, path);
        return fetch(url, {
          ...init,
          headers: withApiKey(init.headers),
          credentials: init.credentials ?? "include",
        });
      },
      request: async (path, init = {}) => {
        if (!pluginBaseUrl) {
          throw new Error("Plugin API unavailable without pluginId");
        }
        const url = joinPath(pluginBaseUrl, path);
        return fetchJson(url, init);
      },
    },
    plugins: {
      list: async () => fetchJson(`${publicUrl}/api/v2/plugins`),
    },
    executions: {
      create: (_input) =>
        Promise.resolve({ ok: false, error: "Executions disabled" }),
      get: (_executionId) =>
        Promise.resolve({ ok: false, error: "Executions disabled" }),
      list: (_input) => Promise.resolve([]),
    },
    comfy: {
      getLoras: (_page?: number, _limit?: number) =>
        Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pages: 1,
        }),
      getCheckpoints: (_page?: number, _limit?: number) =>
        Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pages: 1,
        }),
      getEmbeddings: (_page?: number, _limit?: number) =>
        Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pages: 1,
        }),
      getSamplers: () =>
        Promise.resolve({
          samplers: [],
          schedulers: [],
        }),
    },
  } as EmbeddrAPI;
}

export type { GuestClientOptions, PanelSnapshot };
