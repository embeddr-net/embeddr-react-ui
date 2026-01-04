import React, { createContext, useContext } from "react";
import type { EmbeddrAPI } from "../types/plugin";

const EmbeddrContext = createContext<EmbeddrAPI | null>(null);

export const EmbeddrProvider: React.FC<{
  api: EmbeddrAPI;
  children: React.ReactNode;
}> = ({ api, children }) => {
  return (
    <EmbeddrContext.Provider value={api}>{children}</EmbeddrContext.Provider>
  );
};

export const useEmbeddrAPI = (): EmbeddrAPI => {
  const context = useContext(EmbeddrContext);
  if (!context) {
    throw new Error("useEmbeddrAPI must be used within an EmbeddrProvider");
  }
  return context;
};
