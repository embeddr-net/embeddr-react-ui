import { useEmbeddrAPI } from "../context/EmbeddrContext";

/**
 * Access the core Embeddr API, including utilities, stores, and event bus.
 */
export const useEmbeddr = () => {
  return useEmbeddrAPI();
};
