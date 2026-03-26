// Embeddr Drag and Drop Constants
// These constants define the MIME types used for data transfer during drag and drop operations
// within the Embeddr ecosystem. Using these ensures compatibility between the core application
// and plugins.

export const EmbeddrDnDTypes = {
  // Primary Identifiers
  ARTIFACT: "application/embeddr-artifact-json", // Full JSON payload
  ARTIFACT_ID: "application/embeddr-artifact-id", // Replaces/Standardizes embeddr-image-id
  ARTIFACT_PATH: "application/embeddr-artifact-path",

  // Media Type Specific (Legacy/Compatibility)
  IMAGE_ID: "application/embeddr-image-id", // Deprecated, use ARTIFACT_ID
  IMAGE_URL: "application/external-image-url",
  VIDEO_URL: "application/external-video-url",
  PREVIEW_URL: "application/embeddr-preview-url",

  // Metadata
  ARTIFACT_TYPE: "application/embeddr-artifact-type", // 'image' | 'video' | 'audio' | 'model'
  PLUGIN_SOURCE: "application/embeddr-plugin-source",
} as const;

export type EmbeddrDnDTypeKey = keyof typeof EmbeddrDnDTypes;
export type EmbeddrDnDMimeType = (typeof EmbeddrDnDTypes)[EmbeddrDnDTypeKey];

// Helper for type-safe data transfer handling
export interface DragData {
  id: string;
  type: string;
  url?: string;
  path?: string;
}
