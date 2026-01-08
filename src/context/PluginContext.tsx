import { createContext, useContext } from "react";
import type { PluginDefinition } from "../types/plugin";

export interface PluginContextState {
  /** Map of all registered plugins by ID */
  plugins: Record<string, PluginDefinition>;
  /** List of IDs of currently active plugins */
  activePlugins: string[];
  /** Register a new plugin definition */
  registerPlugin: (plugin: PluginDefinition) => void;
  /** Activate a plugin by ID */
  activatePlugin: (pluginId: string) => void;
  /** Deactivate a plugin by ID */
  deactivatePlugin: (pluginId: string) => void;
}

export const PluginContext = createContext<PluginContextState | null>(null);

export const usePluginContext = () => {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error(
      "usePluginContext must be used within a PluginProvider (imported from @embeddr/react-ui/context or implemented in frontend)"
    );
  }
  return context;
};
