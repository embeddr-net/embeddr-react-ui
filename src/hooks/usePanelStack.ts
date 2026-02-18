import * as React from "react";

type PanelStackOptions = {
  baseZIndex?: number;
  pinnedZIndex?: number;
};

type PanelZIndexOptions = {
  pinned?: boolean;
};

export function usePanelStack(
  ids: Array<string>,
  { baseZIndex = 20, pinnedZIndex = 1000 }: PanelStackOptions = {},
) {
  const [panelOrder, setPanelOrder] = React.useState<Array<string>>(() => ids);

  React.useEffect(() => {
    setPanelOrder((prev) => {
      const existing = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !existing.includes(id));
      return [...existing, ...missing];
    });
  }, [ids]);

  const bringToFront = React.useCallback((id: string) => {
    setPanelOrder((prev) => {
      if (!prev.includes(id)) return [...prev, id];
      return [...prev.filter((item) => item !== id), id];
    });
  }, []);

  const activeId = panelOrder[panelOrder.length - 1] ?? null;

  const getZIndex = React.useCallback(
    (id: string, options?: PanelZIndexOptions) => {
      const orderIndex = panelOrder.indexOf(id);
      const baseOrder = orderIndex === -1 ? 0 : orderIndex;
      return options?.pinned
        ? pinnedZIndex + baseOrder
        : baseZIndex + baseOrder;
    },
    [baseZIndex, panelOrder, pinnedZIndex],
  );

  const isActive = React.useCallback(
    (id: string) => activeId === id,
    [activeId],
  );

  return {
    panelOrder,
    activeId,
    bringToFront,
    getZIndex,
    isActive,
  };
}
