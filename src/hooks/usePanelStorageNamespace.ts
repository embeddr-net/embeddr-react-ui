export interface PanelStorageIdentity {
  storageId?: string;
  panelId?: string;
  windowId?: string;
  id?: string;
  pluginId?: string;
}

export function usePanelStorageNamespace(
  namespace: string,
  identity: PanelStorageIdentity = {},
): string {
  const resolvedId =
    identity.storageId ||
    identity.panelId ||
    identity.windowId ||
    identity.id ||
    identity.pluginId ||
    "default";

  return `${namespace}:${resolvedId}`;
}
