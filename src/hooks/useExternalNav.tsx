import { createContext, useContext } from "react";

type ExternalNavContextType = {
  openExternal: (url: string) => void;
};

export const ExternalNavContext = createContext<
  ExternalNavContextType | undefined
>(undefined);

export function useExternalNav() {
  const ctx = useContext(ExternalNavContext);
  if (!ctx) throw new Error("useExternalNav must be used within provider");
  return ctx;
}
