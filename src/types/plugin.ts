import type React from "react";
import type { Generation, PromptImage, Workflow } from "./domain";

// --- API Interface ---
// This is what plugins receive to interact with the app
export interface EmbeddrAPI {
  // Store Access
  stores: {
    global: {
      selectedImage: PromptImage | null;
      selectImage: (image: PromptImage | null) => void;
    };
    generation: {
      workflows: Array<Workflow>;
      selectedWorkflow: Workflow | null;
      generations: Array<Generation>;
      isGenerating: boolean;
      generate: () => Promise<void>;
      setWorkflowInput: (nodeId: string, field: string, value: any) => void;
      selectWorkflow: (workflow: Workflow) => void;
    };
  };
  // UI Utilities
  ui: {
    activePanelId: string | null;
    isPanelActive: (panelId: string) => boolean;
  };
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
  // General Utilities
  utils: {
    backendUrl: string;
    uploadImage: (
      file: File,
      prompt?: string,
      parent_ids?: Array<string | number>
    ) => Promise<PromptImage>;
    getPluginUrl: (path: string) => string;
  };
  // Event System
  events: {
    on: (event: string, listener: (...args: Array<any>) => void) => () => void;
    off: (event: string, listener: (...args: Array<any>) => void) => void;
    emit: (event: string, ...args: Array<any>) => void;
  };
}

// --- Plugin Definition ---
export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;

  // Initialization logic
  initialize?: (api: EmbeddrAPI) => void | (() => void) | Promise<void>;

  // UI Components to register
  components?: Array<PluginComponentDef>;

  // Actions to register
  actions?: Array<PluginActionDef>;

  // Settings to expose in the Settings Dialog
  settings?: Array<PluginSettingDef>;
}

export interface PluginSettingDef {
  key: string;
  type: "string" | "boolean" | "select" | "action";
  label: string;
  description?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: string }>; // For select
  action?: (api: EmbeddrAPI) => void; // For action
}

export interface PluginComponentDef {
  id: string;
  location: "zen-toolbox-tab" | "zen-sidebar" | "zen-overlay"; // Expandable locations
  label: string; // Tab label if applicable
  component: React.ComponentType<{ api: EmbeddrAPI }>;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  options?: {
    hideHeader?: boolean;
    transparent?: boolean;
  };
}

export interface PluginActionDef {
  id: string;
  location: "zen-toolbox-action" | "image-context-menu";
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  // If provided, this component will be rendered in an accordion/expandable section
  component?: React.ComponentType<{ api: EmbeddrAPI }>;
  // Handler is optional if component is provided
  handler?: (api: EmbeddrAPI, context?: any) => void;
}
