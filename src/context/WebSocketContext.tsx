import { createContext, useContext } from "react";

export interface WebSocketContextState {
  clients: string[];
  myClientId: string | null;
  isConnected: boolean;
  refreshClients: () => Promise<void>;
}

export const WebSocketContext = createContext<WebSocketContextState | null>(
  null
);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }
  return context;
};
