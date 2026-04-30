import { createContext, useContext } from "react";

export type ExternalNavContextType = {
  openExternal: (url: string, skipConfirmation?: boolean, newTab?: boolean) => void;
};

export const ExternalNavContext = createContext<ExternalNavContextType | undefined>(undefined);

const defaultNav: ExternalNavContextType = {
  openExternal: (url, _skipConfirmation, newTab = true) => {
    if (typeof window !== "undefined") {
      window.open(url, newTab ? "_blank" : "_self");
    }
  },
};

export function useExternalNav() {
  const ctx = useContext(ExternalNavContext);
  return ctx ?? defaultNav;
}
