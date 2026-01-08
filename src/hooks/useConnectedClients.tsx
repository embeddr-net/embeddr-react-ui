import { useWebSocket } from "./useWebSocketState";

/**
 * @deprecated Use useWebSocket() instead.
 */
export function useConnectedClients() {
  const { clients, myClientId, refreshClients } = useWebSocket();

  return {
    clients,
    myClientId,
    loading: false,
    error: null,
    refresh: refreshClients,
  };
}
