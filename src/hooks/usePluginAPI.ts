import { useEmbeddrAPI } from "../context/EmbeddrContext";

/**
 * Canonical plugin API hook.
 *
 * The API instance is provided by the active shell via `EmbeddrProvider`
 * when a plugin panel/app is mounted.
 */
export const usePluginAPI = () => {
  return useEmbeddrAPI();
};
