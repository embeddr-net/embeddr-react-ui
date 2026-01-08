import { useWebSocketContext } from "../context/WebSocketContext";

/**
 * Access the WebSocket state, including connected clients and current connection status.
 */
export const useWebSocket = () => {
  return useWebSocketContext();
};
