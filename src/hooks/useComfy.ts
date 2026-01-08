import { useEmbeddrAPI } from "../context/EmbeddrContext";

/**
 * Access ComfyUI specific functionality.
 */
export const useComfy = () => {
  const api = useEmbeddrAPI();
  return api.comfy;
};
