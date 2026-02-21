export interface PromptImage {
  id: string;
  url: string;
  image_url: string; // Added for compatibility
  thumb_url?: string; // Added for compatibility
  media_type?:
    | "image"
    | "video"
    | "audio"
    | "text"
    | "collection"
    | "document"
    | "web";
  duration?: number;
  fps?: number;
  frame_count?: number;
  file_size?: number;
  author_name?: string;
  author_username?: string;
  author_image?: string;
  prompt: string;
  negative_prompt?: string;
  width: number;
  height: number;
  seed?: number;
  steps?: number;
  cfg_scale?: number;
  sampler_name?: string;
  scheduler?: string;
  model_name?: string;
  model?: string;
  tags?: string;
  created_at: string;
  gallery_id?: string;
  is_favorite?: boolean;
  liked_by_me?: boolean;
  like_count?: number;
  embedding?: Array<number>;
  metadata?: Record<string, any>;
  origin?: string;
  local_path?: string;
  parents?: Array<PromptImage>;
  children?: Array<PromptImage>;
  phash?: string | null;
  sha256?: string | null;
  is_archived?: boolean;
  updated_at?: string;
}

export interface PipelineSpec {
  id: number;
  name: string;
  description?: string;
  data: Record<string, any>;
  meta?: {
    exposed_inputs?: Array<{
      node_id: string;
      field: string;
      label?: string;
      type?: string;
      order?: number;
      enabled: boolean;
    }>;
    [key: string]: any;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExecutionRecord {
  id: string;
  prompt_id?: string;
  status: "pending" | "queued" | "processing" | "completed" | "failed";
  prompt: string;
  images?: Array<string>;
  error_message?: string;
  created_at: string;
  workflow_id: number;
  inputs: Record<string, any>;
  outputs?: Array<any>;
  preview_url?: string;
}
