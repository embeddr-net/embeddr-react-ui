import React, { useState, useEffect, useCallback } from "react";
import { WebSocketContext } from "../context/WebSocketContext";
import { useEmbeddrAPI } from "../context/EmbeddrContext";
import type {
  WelcomeMsg,
  ClientHelloMsg,
  ClientConnectedMsg,
  ClientDisconnectedMsg,
} from "../types/websocket";

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const api = useEmbeddrAPI();
  const [clients, setClients] = useState<string[]>([]);
  const [myClientId, setMyClientId] = useState<string | null>(null);

  // Ideally we would listen to socket connection events directly from the API layer
  // For now, we assume we are connected if the provider is active, as the socket connects on app load
  const [isConnected, setIsConnected] = useState(true);

  const fetchClients = useCallback(async () => {
    try {
      const baseUrl = api.utils.backendUrl;
      // Ensure no double slash if backendUrl ends with /
      const url = baseUrl.endsWith("/")
        ? `${baseUrl}system/debug/clients`
        : `${baseUrl}/system/debug/clients`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (e) {
      console.error("Failed to fetch clients", e);
    }
  }, [api.utils.backendUrl]);

  // Initial fetch
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    // Subscribe to events
    const onWelcome = (data: WelcomeMsg["data"]) => {
      setMyClientId(data.client_id);
      setIsConnected(true);
    };
    const onHello = (data: ClientHelloMsg["data"]) => {
      setMyClientId(data.client_id);
      setIsConnected(true);
    };
    const onConnect = (data: ClientConnectedMsg["data"]) => {
      setClients((prev) => {
        if (prev.includes(data.client_id)) return prev;
        return [...prev, data.client_id];
      });
    };
    const onDisconnect = (data: ClientDisconnectedMsg["data"]) => {
      setClients((prev) => prev.filter((id) => id !== data.client_id));
    };

    const unsubWelcome = api.events.on("welcome", onWelcome);
    const unsubHello = api.events.on("client_hello", onHello);
    const unsubConnect = api.events.on("client_connected", onConnect);
    const unsubDisconnect = api.events.on("client_disconnected", onDisconnect);

    return () => {
      if (typeof unsubWelcome === "function") unsubWelcome();
      else api.events.off("welcome", onWelcome);

      if (typeof unsubHello === "function") unsubHello();
      else api.events.off("client_hello", onHello);

      if (typeof unsubConnect === "function") unsubConnect();
      else api.events.off("client_connected", onConnect);

      if (typeof unsubDisconnect === "function") unsubDisconnect();
      else api.events.off("client_disconnected", onDisconnect);
    };
  }, [api]);

  return (
    <WebSocketContext.Provider
      value={{ clients, myClientId, isConnected, refreshClients: fetchClients }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
