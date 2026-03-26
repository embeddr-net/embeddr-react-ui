export type PreviewMatch = {
  type?: string;
  artifactType?: string;
  urlPrefix?: string;
  predicate?: (item: any) => boolean;
};

export type SourceBadgePosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type PreviewPresentation = {
  imageClassName?: string;
  cardClassName?: string;
  overlayClassName?: string;
  sourceBadgeLabel?: string;
  sourceBadgeIconUrl?: string;
  sourceBadgePosition?: SourceBadgePosition;
};

export type PreviewPresentationDescriptor = {
  id: string;
  priority?: number;
  match: PreviewMatch;
  presentation?: PreviewPresentation;
  resolve?: (item: any) => Partial<PreviewPresentation> | undefined;
};

const previewRegistry: Array<PreviewPresentationDescriptor> = [];

const normalizeType = (value?: string) => String(value || "").toLowerCase();

const matchesPreview = (
  descriptor: PreviewPresentationDescriptor,
  item: any,
) => {
  if (!item) return false;
const match = descriptor.match;
  const itemType = normalizeType(item.type || item.kind || item.artifactType);
  const artifactType = normalizeType(
    item.artifactType || item.type || item.kind,
  );
  const itemUrl = String(item.url || item.uri || "");

  if (match.type && normalizeType(match.type) !== itemType) return false;
  if (match.artifactType && normalizeType(match.artifactType) !== artifactType)
    return false;
  if (match.urlPrefix && !itemUrl.startsWith(match.urlPrefix)) return false;
  if (match.predicate && !match.predicate(item)) return false;
  return true;
};

export const registerPreviewPresentation = (
  descriptor: PreviewPresentationDescriptor,
) => {
  if (!descriptor.id) return () => undefined;
  if (!previewRegistry.find((d) => d.id === descriptor.id)) {
    previewRegistry.push(descriptor);
  }
  return () => {
    const idx = previewRegistry.findIndex((d) => d.id === descriptor.id);
    if (idx >= 0) previewRegistry.splice(idx, 1);
  };
};

export const resolvePreviewPresentation = (
  item: any,
): PreviewPresentation | undefined => {
  if (!item) return undefined;
  const sorted = [...previewRegistry].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
  for (const descriptor of sorted) {
    if (!matchesPreview(descriptor, item)) continue;
    const resolved = descriptor.resolve?.(item);
    return {
      ...(descriptor.presentation || {}),
      ...(resolved || {}),
    };
  }
  return undefined;
};

export const listPreviewPresentations = () => {
  return [...previewRegistry].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
};
