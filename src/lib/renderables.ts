import React from "react";

export type RenderableContext = {
  api?: any;
};

export type RenderableMatch = {
  type?: string;
  urlPrefix?: string;
  predicate?: (item: any, context?: RenderableContext) => boolean;
};

export type RenderableProps<T = any> = {
  api: any;
  item: T;
  context?: RenderableContext;
};

export type RenderableDescriptor<T = any> = {
  id: string;
  label?: string;
  description?: string;
  priority?: number;
  match?: RenderableMatch;
  render: React.ComponentType<RenderableProps<T>>;
  renderThumbnail?: React.ComponentType<RenderableProps<T>>;
};

export type RenderableMeta = {
  id: string;
  label?: string;
  description?: string;
  match?: RenderableMatch;
  plugin?: string;
  ui?: Record<string, any>;
};

export type RenderableCatalogEntry = {
  id: string;
  label?: string;
  description?: string;
  match?: RenderableMatch;
  plugin?: string;
  ui?: Record<string, any>;
  hasRenderer: boolean;
};

const registry: RenderableDescriptor[] = [];
const metaRegistry = new Map<string, RenderableMeta>();

const matchesRenderable = (
  descriptor: RenderableDescriptor,
  item: any,
  context?: RenderableContext,
) => {
  const meta = metaRegistry.get(descriptor.id);
  const match = descriptor.match || meta?.match || {};
  if (!item) return false;
  if (match.type && String(item.type || "") !== match.type) return false;
  if (match.urlPrefix) {
    const url = String(item.url || "");
    if (!url.startsWith(match.urlPrefix)) return false;
  }
  if (match.predicate && !match.predicate(item, context)) return false;
  return true;
};

export const registerRenderable = (descriptor: RenderableDescriptor) => {
  if (!descriptor?.id) return () => undefined;
  if (!registry.find((r) => r.id === descriptor.id)) {
    registry.push(descriptor);
  }
  return () => {
    const idx = registry.findIndex((r) => r.id === descriptor.id);
    if (idx >= 0) registry.splice(idx, 1);
  };
};

export const registerRenderableMeta = (meta: RenderableMeta) => {
  if (!meta?.id) return () => undefined;
  metaRegistry.set(meta.id, meta);
  return () => metaRegistry.delete(meta.id);
};

export const listRenderables = () => {
  return registry.map((descriptor) => {
    const meta = metaRegistry.get(descriptor.id);
    return {
      ...descriptor,
      label: descriptor.label || meta?.label,
      description: descriptor.description || meta?.description,
      match: descriptor.match || meta?.match,
    };
  });
};

export const getRenderableById = (id: string) =>
  registry.find((descriptor) => descriptor.id === id);

export const listRenderableCatalog = (): RenderableCatalogEntry[] => {
  const out: RenderableCatalogEntry[] = [];
  const known = new Set<string>();

  for (const descriptor of registry) {
    const meta = metaRegistry.get(descriptor.id);
    out.push({
      id: descriptor.id,
      label: descriptor.label || meta?.label,
      description: descriptor.description || meta?.description,
      match: descriptor.match || meta?.match,
      plugin: meta?.plugin,
      ui: meta?.ui,
      hasRenderer: true,
    });
    known.add(descriptor.id);
  }

  for (const meta of metaRegistry.values()) {
    if (known.has(meta.id)) continue;
    out.push({
      id: meta.id,
      label: meta.label,
      description: meta.description,
      match: meta.match,
      plugin: meta.plugin,
      ui: meta.ui,
      hasRenderer: false,
    });
  }

  return out;
};

export const syncRenderablesFromLotus = async (
  api: any,
  options?: { limit?: number },
) => {
  if (!api?.lotus?.list) return [] as RenderableMeta[];
  const limit = options?.limit ?? 500;
  const res = await api.lotus.list({ limit });
  const items = (res?.items || []) as Array<any>;
  const metas: RenderableMeta[] = [];
  for (const cap of items) {
    const data = cap?.data || {};
    if (data?.type !== "zen.renderable") continue;
    const renderable = data?.renderable || {};
    const meta: RenderableMeta = {
      id: String(renderable.id || cap.id),
      label: renderable.label || cap.title,
      description: renderable.description || cap.description,
      match: renderable.match,
      plugin: cap.plugin,
      ui: cap.ui || data.ui,
    };
    registerRenderableMeta(meta);
    metas.push(meta);
  }
  return metas;
};

export const resolveRenderable = (
  item: any,
  context?: RenderableContext,
): RenderableDescriptor | undefined => {
  if (!item) return undefined;
  const sorted = [...registry].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
  return sorted.find((descriptor) =>
    matchesRenderable(descriptor, item, context),
  );
};
