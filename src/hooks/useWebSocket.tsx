import { useEffect, useRef } from "react";
import { useEmbeddrAPI } from "../context/EmbeddrContext";
import type { EmbeddrMessage } from "../types/websocket";
import type { EmbeddrEventMap } from "../types/plugin";

type WebSocketCallback<T> = (data: T) => void;

/**
 * Subscribe to a specific WebSocket event type.
 * The callback receives the `data` payload of the message.
 *
 * Example:
 * ```ts
 * useWebSocketEvent('progress', (data) => {
 *   // data is typed as { value: number, max: number }
 *   console.log(data.value)
 * })
 * ```
 *
 * @param event - The event name to subscribe to.
 * @param callback - The callback to execute when the event occurs.
 */
export function useWebSocketEvent<TEvent extends keyof EmbeddrEventMap>(
  event: TEvent,
  callback: WebSocketCallback<EmbeddrEventMap[TEvent]>,
) {
  const api = useEmbeddrAPI();
  const savedCallback =
    useRef<WebSocketCallback<EmbeddrEventMap[TEvent]>>(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (data: EmbeddrEventMap[TEvent]) => {
      savedCallback.current(data);
    };

    // Subscribe
    // Note: The EmbeddrAPI event bus returns an unsubscribe function directly from `on`
    const unsubscribe = api.events.on(event, handler);

    return () => {
      // If the event bus implementation adheres to returning cleanup, use it.
      // Otherwise we might need to call api.events.off(event, handler)
      unsubscribe();
    };
  }, [api, event]);
}

/**
 * Subscribe to the full stream of all WebSocket messages.
 * The callback receives the full message envelope: `{ type, source, data }`.
 *
 * Use this for debugging or monitoring multiple event types.
 */
export function useWebSocketStream(
  callback: WebSocketCallback<EmbeddrMessage>,
) {
  const api = useEmbeddrAPI();
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (msg: EmbeddrMessage) => {
      savedCallback.current(msg);
    };

    const unsubscribe = api.events.on("websocket:message", handler);

    return () => {
      unsubscribe();
    };
  }, [api]);
}
