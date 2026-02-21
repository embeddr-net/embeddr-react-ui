import type { ExecutionRecord } from "./domain";

export type WebSocketMessageSource = "embeddr" | "comfyui";

export interface WSBaseMessage<T = unknown> {
  type: string;
  source: WebSocketMessageSource;
  data: T;
}

// --- Embeddr System Messages ---

/**
 * Initial message sent upon successful connection.
 */
export interface WelcomeMsg extends WSBaseMessage<{
  client_id: string;
}> {
  type: "welcome";
  source: "embeddr";
}

/**
 * Initial message sent upon successful connection with user context.
 */
export interface ClientHelloMsg extends WSBaseMessage<{
  client_id: string;
  user_id: string | null;
  username: string | null;
}> {
  type: "client_hello";
  source: "embeddr";
}

/**
 * Broadcast when a client connects.
 */
export interface ClientConnectedMsg extends WSBaseMessage<{
  client_id: string;
  total: number;
}> {
  type: "client_connected";
  source: "embeddr";
}

/**
 * Broadcast when a client disconnects.
 */
export interface ClientDisconnectedMsg extends WSBaseMessage<{
  client_id: string;
  total: number;
}> {
  type: "client_disconnected";
  source: "embeddr";
}

/**
 * Response to an initial connection or status request.
 * Contains the current queue size and list of actively running executions.
 */
export interface StatusResponseMsg extends WSBaseMessage<{
  queue_status: {
    remaining: number;
  };
  running_executions: Array<ExecutionRecord>;
  running_generations?: Array<ExecutionRecord>;
}> {
  type: "status_response";
  source: "embeddr";
}

/**
 * Broadcast when a new execution request is successfully submitted to the queue.
 */
export interface ExecutionSubmittedMsg extends WSBaseMessage<{
  execution_id?: string;
  generation_id?: string;
  prompt_id: string;
}> {
  type: "execution_submitted" | "generation_submitted";
  source: "embeddr";
}

export type GenerationSubmittedMsg = ExecutionSubmittedMsg;

/**
 * Backward-compatible legacy message variant used by older backends.
 */
export interface LegacyGenerationSubmittedMsg extends WSBaseMessage<{
  generation_id: string;
  prompt_id: string;
}> {
  type: "generation_submitted";
  source: "embeddr";
}

/**
 * Broadcast when items are added to a dataset.
 */
export interface DatasetItemsAddedMsg extends WSBaseMessage<{
  dataset_id: number;
  count: number;
}> {
  type: "dataset:items_added";
  source: "embeddr";
}

/**
 * Broadcast when a dataset item is updated (e.g. caption generated).
 */
export interface DatasetItemUpdatedMsg extends WSBaseMessage<{
  id: number;
  dataset_id: number;
  caption: string;
}> {
  type: "dataset:item_updated";
  source: "embeddr";
}

/**
 * Union of all Embeddr system messages.
 */
export type EmbeddrSystemMessage =
  | WelcomeMsg
  | ClientHelloMsg
  | ClientConnectedMsg
  | ClientDisconnectedMsg
  | StatusResponseMsg
  | ExecutionSubmittedMsg
  | LegacyGenerationSubmittedMsg
  | DatasetItemsAddedMsg
  | DatasetItemUpdatedMsg;

// --- ComfyUI Relay Messages ---

/**
 * ComfyUI started executing a node graph.
 */
export interface ComfyExecutionStartMsg extends WSBaseMessage<{
  prompt_id: string;
}> {
  type: "execution_start";
  source: "comfyui";
}

/**
 * ComfyUI finished executing a specific node.
 */
export interface ComfyExecutingMsg extends WSBaseMessage<{
  node: string | null;
  display_node?: string;
  prompt_id: string;
}> {
  type: "executing";
  source: "comfyui";
}

/**
 * ComfyUI execution progress update.
 */
export interface ComfyProgressMsg extends WSBaseMessage<{
  value: number;
  max: number;
}> {
  type: "progress";
  source: "comfyui";
}

/**
 * Complete execution of a workflow.
 */
export interface ComfyExecutedMsg extends WSBaseMessage<{
  node: string;
  output: Record<string, unknown>;
  prompt_id: string;
}> {
  type: "executed";
  source: "comfyui";
}

/**
 * ComfyUI generated a preview image (binary/blob converted to base64).
 */
export interface ComfyPreviewMsg extends WSBaseMessage<string> {
  type: "preview";
  source: "comfyui";
  // data is base64 string
}

/**
 * Union of all ComfyUI messages.
 */
export type ComfyMessage =
  | ComfyExecutionStartMsg
  | ComfyExecutingMsg
  | ComfyProgressMsg
  | ComfyExecutedMsg
  | ComfyPreviewMsg;

/**
 * Union of all WebSocket messages supported by the application.
 */
export type EmbeddrMessage = EmbeddrSystemMessage | ComfyMessage;
