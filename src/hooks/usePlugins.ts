import { usePluginContext } from "../context/PluginContext";

/**
 * Access the plugin system state and methods.
 * Provides access to registered plugins, active state, and management functions.
 */
export const usePlugins = () => {
  return usePluginContext();
};
