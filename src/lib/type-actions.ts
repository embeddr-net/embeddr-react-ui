/**
 * Type action registry — plugins register context menu actions per artifact type.
 *
 * Usage (in plugin UMD init):
 *   registerTypeAction({
 *     id: "stash:open-in-browser",
 *     type: "stash:performer",
 *     label: "Open in Stash Browser",
 *     onSelect: (ctx) => { ... },
 *   });
 *
 * Usage (in ArtifactBrowser):
 *   const typeActions = getTypeActions(artifact.type_name);
 */

export interface TypeAction {
  id: string;
  type: string; // artifact type_name to match (exact or prefix with *)
  label: string;
  icon?: any;
  order?: number;
  separatorBefore?: boolean;
  onSelect: (context: {
    api: any;
    artifact: any;
    artifactId?: string;
  }) => void | Promise<void>;
}

// Shared global registry — works across UMD boundaries
function getRegistry(): TypeAction[] {
  const w = globalThis as any;
  if (!w.__embeddrTypeActions) w.__embeddrTypeActions = [];
  return w.__embeddrTypeActions;
}

export function registerTypeAction(action: TypeAction): () => void {
  const registry = getRegistry();
  const existing = registry.findIndex((a: TypeAction) => a.id === action.id);
  if (existing >= 0) {
    registry[existing] = action;
  } else {
    registry.push(action);
  }
  return () => {
    const reg = getRegistry();
    const idx = reg.findIndex((a: TypeAction) => a.id === action.id);
    if (idx >= 0) reg.splice(idx, 1);
  };
}

export function getTypeActions(typeName: string): TypeAction[] {
  return getRegistry().filter((a: TypeAction) => {
    if (a.type === typeName) return true;
    if (a.type.endsWith(":*")) {
      const prefix = a.type.slice(0, -1);
      return typeName.startsWith(prefix);
    }
    return false;
  });
}

export function listTypeActions(): TypeAction[] {
  return [...getRegistry()];
}
