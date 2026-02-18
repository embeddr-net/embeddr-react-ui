import { usePluginAPI } from "./usePluginAPI";

/**
 * Backward-compatible alias for `usePluginAPI`.
 *
 * Prefer `usePluginAPI` for new plugin code.
 */
export const useEmbeddr = () => {
  return usePluginAPI();
};
