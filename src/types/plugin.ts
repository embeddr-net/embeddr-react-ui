import type React from "react";
import type { Generation, PromptImage, Workflow } from "./domain";
import type { EmbeddrMessage } from "./websocket";

/**
 * Known plugin intents that can be registered.
 * Mirrors embeddr-core/src/embeddr_core/plugin_interface.py
 */
export const PluginIntents = {
  REGISTER_API: "register_api",
  REGISTER_CLI: "register_cli",
  REGISTER_CAPABILITY: "register_capability",
  REGISTER_ARTIFACT_TYPE: "register_artifact_type",
  ZEN_PANEL: "zen_panel",
  EVENT_LISTENER: "event_listener",
  DATABASE_ACCESS: "database_access",
  EXECUTION_HANDLER: "execution_handler",
  DRAG_DROP_TARGET: "drag_drop_target",
} as const;

export interface EmbeddrEventMap {
  // Global App Events
  "image:selected": PromptImage | null;
  "image:uploaded": PromptImage;

  // WebSocket Events (mapped from WS types)
  welcome: { client_id: string };
  client_connected: { client_id: string; total: number };
  client_disconnected: { client_id: string; total: number };
  status_response: {
    queue_status: { remaining: number };
    running_generations: Array<Generation>;
  };
  generation_submitted: { generation_id: string; prompt_id: string };
  "dataset:items_added": { dataset_id: number; count: number };
  "dataset:item_updated": { id: number; dataset_id: number; caption: string };

  // ComfyUI Events
  execution_start: { prompt_id: string };
  executing: { node: string | null; display_node?: string; prompt_id: string };
  progress: { value: number; max: number };
  executed: {
    node: string;
    output: Record<string, unknown>;
    prompt_id: string;
  };
  preview: string; // base64

  // Full raw message stream
  "websocket:message": EmbeddrMessage;

  // General fallback
  [key: string]: any;
}

// --- API Interface ---
/**
 * The main interface passed to all plugin components and initialization functions.
 * It provides access to the application state, UI utilities, and backend services.
 */
export interface EmbeddrAPI {
  /**
   * Access to global stores and state management.
   */
  stores: {
    /**
     * Global application state.
     */
    global: {
      /**
       * The currently selected image in the gallery or editor.
       */
      selectedImage: PromptImage | null;
      /**
       * Update the selected image.
       */
      selectImage: (image: PromptImage | null) => void;
    };
    /**
     * Generation workflow state and actions.
     */
    generation: {
      /**
       * List of available ComfyUI workflows.
       */
      workflows: Array<Workflow>;
      /**
       * The currently active workflow.
       */
      selectedWorkflow: Workflow | null;
      /**
       * History of generated images.
       */
      generations: Array<Generation>;
      /**
       * Whether a generation usage is currently in progress.
       */
      isGenerating: boolean;
      /**
       * Trigger a generation with the current workflow and inputs.
       */
      generate: () => Promise<void>;
      /**
       * Update a specific input field for a node in the workflow.
       * @param nodeId - The ID of the node in the ComfyUI workflow.
       * @param field - The field name to update.
       * @param value - The new value.
       */
      setWorkflowInput: (nodeId: string, field: string, value: any) => void;
      /**
       * Switch the active workflow.
       */
      selectWorkflow: (workflow: Workflow) => void;
    };
  };
  /**
   * UI utilities for managing panels and feedback.
   */
  ui: {
    /**
     * The ID of the currently active sidebar or overlay panel.
     */
    activePanelId: string | null;
    /**
     * Check if a specific panel is currently active.
     */
    isPanelActive: (panelId: string) => boolean;
  };
  /**
   * Application settings and preferences.
   */
  settings: {
    /**
     * Get a global setting value.
     */
    get: <T = any>(key: string, defaultValue?: T) => T;
    /**
     * Set a global setting value.
     */
    set: (key: string, value: any) => void;
    /**
     * Get a plugin-specific setting value.
     */
    getPlugin: <T = any>(pluginId: string, key: string, defaultValue?: T) => T;
    /**
     * Set a plugin-specific setting value.
     */
    setPlugin: (pluginId: string, key: string, value: any) => void;
  };
  /**
   * Toast notification system.
   */
  toast: {
    /** Show a success toast. */
    success: (message: string) => void;
    /** Show an error toast. */
    error: (message: string) => void;
    /** Show an informational toast. */
    info: (message: string) => void;
  };
  /**
   * General helper utilities.
   */
  utils: {
    /** The base URL of the usage backend. */
    backendUrl: string;
    /**
     * Upload an image to the backend.
     * @param file - The file object to upload.
     * @param prompt - Optional prompt metadata associated with the upload.
     * @param parent_ids - Optional IDs of parent images for history tracking.
     */
    uploadImage: (
      file: File,
      prompt?: string,
      parent_ids?: Array<string | number>
    ) => Promise<PromptImage>;
    /**
     * Get a full URL for a plugin asset or route.
     * @param path - Relative path within the plugin's namespace.
     */
    getPluginUrl: (path: string) => string;
  };
  client: {
    plugins: {
      call: <T = any>(
        pluginId: string,
        path: string,
        method: string,
        body?: any
      ) => Promise<T>;
    };
  };
  /**
   * Event bus for inter-plugin communication.
   */
  events: {
    /**
     * Subscribe to an event.
     * @returns A cleanup function to unsubscribe.
     */
    on<K extends keyof EmbeddrEventMap>(
      event: K,
      listener: (payload: EmbeddrEventMap[K]) => void
    ): () => void;
    /**
     * Unsubscribe from an event.
     */
    off<K extends keyof EmbeddrEventMap>(
      event: K,
      listener: (payload: EmbeddrEventMap[K]) => void
    ): void;
    /**
     * Emit a custom event.
     */
    emit<K extends keyof EmbeddrEventMap>(
      event: K,
      payload: EmbeddrEventMap[K]
    ): void;
  };
  /**
   * Integration with ComfyUI resources.
   */
  comfy: {
    /**
     * Fetch available LoRAs.
     */
    getLoras: (
      page?: number,
      limit?: number
    ) => Promise<{
      items: Array<string>;
      total: number;
      page: number;
      pages: number;
    }>;
    /**
     * Fetch available Checkpoint models.
     */
    getCheckpoints: (
      page?: number,
      limit?: number
    ) => Promise<{
      items: Array<string>;
      total: number;
      page: number;
      pages: number;
    }>;
    /**
     * Fetch available Embeddings/Textual Inversions.
     */
    getEmbeddings: (
      page?: number,
      limit?: number
    ) => Promise<{
      items: Array<string>;
      total: number;
      page: number;
      pages: number;
    }>;
    /**
     * Fetch available Samplers and Schedulers.
     */
    getSamplers: () => Promise<{
      samplers: Array<string>;
      schedulers: Array<string>;
    }>;
  };
  windows: {
    open: (id: string, title: string, componentId: string, props?: any) => void;
    spawn: (componentId: string, title: string, props?: any) => string;
    register: (id: string, component: React.ComponentType<any>) => void;
  };
}

// --- Plugin Definition ---
/**
 * The structure that every plugin must export as default.
 */
export interface PluginDefinition {
  /** Unique identifier for the plugin. Use kebab-case. */
  id: string;
  /** Display name of the plugin. */
  name: string;
  /** Brief description of what the plugin does. */
  description: string;
  /** Semver version string. */
  version: string;
  /** Author name or contact. */
  author?: string;

  /**
   * The API version this plugin expects.
   * Format: "major.minor" or "major".
   */
  apiVersion?: string;

  /**
   * Initialization logic called when the plugin is loaded.
   * Can return a cleanup function.
   */
  initialize?: (api: EmbeddrAPI) => void | (() => void) | Promise<void>;

  /**
   * UI Components to register in the application.
   */
  components?: Array<PluginComponentDef>;

  /**
   * Actions or commands to register.
   */
  actions?: Array<PluginActionDef>;

  /**
   * Configuration settings to expose in the Settings Dialog.
   */
  settings?: Array<PluginSettingDef>;

  /**
   * Backend intents (optional, populated by loader)
   */
  intents?: Array<string>;
}

/**
 * Definition for a configurable setting item.
 */
export interface PluginSettingDef {
  /** key used to store the setting value. */
  key: string;
  /** The UI control type for the setting. */
  type: "string" | "boolean" | "select" | "action";
  /** Label displayed to the user. */
  label: string;
  /** Tooltip or help text. */
  description?: string;
  /** Default value if not set. */
  defaultValue?: any;
  /** Options for 'select' type settings. */
  options?: Array<{ label: string; value: string }>; // For select
  /** Callback for 'action' type settings (e.g. buttons). */
  action?: (api: EmbeddrAPI) => void; // For action
}

/**
 * Definition for a UI component contribution.
 */
export interface PluginComponentDef {
  /** Unique ID for the component registration. */
  id: string;
  /**
   * Where to render the component.
   * - `zen-toolbox-tab`: A tab in the left toolbox sidepanel.
   * - `zen-sidebar`: A persistent sidebar item.
   * - `zen-overlay`: A floating overlay window.
   * - `header-nav`: An icon in the top header.
   */
  location:
    | "zen-toolbox-tab"
    | "zen-sidebar"
    | "zen-overlay"
    | "header-nav"
    | "page";
  /** Label used for tabs or tooltips. */
  label: string;
  /** Icon component to display. */
  icon?: React.ComponentType<{ className?: string }>;
  /** The React component to render. Receives `api` prop. */
  component: React.ComponentType<{ api: EmbeddrAPI }>;
  /** Initial position for overlay components. */
  defaultPosition?: { x: number; y: number };
  /** Initial size for overlay components. */
  defaultSize?: { width: number; height: number };
  /** Additional rendering options. */
  options?: {
    /** If true, the header bar is hidden. */
    hideHeader?: boolean;
    /** If true, the background is transparent. */
    transparent?: boolean;
  };
}

/**
 * Definition for an executable action.
 */
export interface PluginActionDef {
  /** Unique ID for the action. */
  id: string;
  /**
   * Where the action should be available.
   * - `zen-toolbox-action`: A button in the toolbox.
   * - `image-context-menu`: An item in the image right-click menu.
   */
  location: "zen-toolbox-action" | "image-context-menu";
  /** Label displayed to the user. */
  label: string;
  /** Icon to display. */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * If provided, this component will be rendered in an accordion/expandable section.
   */
  component?: React.ComponentType<{ api: EmbeddrAPI }>;
  /**
   * function to execute when the action is triggered.
   */
  handler?: (api: EmbeddrAPI, context?: any) => void;
}
