import { useLocalStorage } from "./useLocalStorage";

/**
 * A hook for plugins to store state in localStorage, scoped to their plugin instance.
 * Automatically prefixes keys to prevent collisions.
 *
 * @param pluginId The unique ID of the plugin instance (passed via props)
 * @param key The local key for the state (e.g. 'position', 'items')
 * @param initialValue Default value
 */
export function usePluginStorage<T>(
  pluginId: string,
  key: string,
  initialValue: T,
) {
  if (!pluginId) {
    console.warn(
      "usePluginStorage called without pluginId, falling back to global key",
    );
  }
  const scopedKey = pluginId ? `plugin-storage:${pluginId}:${key}` : key;
  return useLocalStorage<T>(scopedKey, initialValue);
}
