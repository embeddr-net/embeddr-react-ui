import { useCallback, useEffect, useRef } from "react";

export interface PanelItem {
  id: string;
  artifactId?: string;
  url?: string;
  type?: string;
  title?: string;
}

export interface PanelLifecycleConfig {
  panelId: string;
  panelType: string;
  title: string;
  windowId?: string | null;
  meta?: Record<string, unknown>;
}

export interface PanelUpdatePayload {
  items?: Array<PanelItem>;
  lastActive?: boolean;
  meta?: Record<string, unknown>;
}

type PluginRequestFn = <T = unknown>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

/**
 * Manages the lifecycle of a Lotus UI panel — registers on mount,
 * unregisters on unmount, and returns an `updatePanel` callback.
 *
 * Replaces direct `/execute/ui.panel_register|update|unregister` calls
 * in plugin panel components.
 */
export function usePanelLifecycle(
  request: PluginRequestFn,
  config: PanelLifecycleConfig,
) {
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const { panelId, panelType, title, windowId, meta } = configRef.current;
    request("/execute/ui.panel_register", {
      method: "POST",
      body: JSON.stringify({ panel_id: panelId, panel_type: panelType, title, window_id: windowId ?? null, meta }),
    }).catch(() => undefined);

    return () => {
      request("/execute/ui.panel_unregister", {
        method: "POST",
        body: JSON.stringify({ panel_id: configRef.current.panelId }),
      }).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePanel = useCallback(
    (payload: PanelUpdatePayload) => {
      const body: Record<string, unknown> = {
        panel_id: configRef.current.panelId,
      };
      if (payload.items !== undefined) body["items"] = payload.items;
      if (payload.lastActive) body["last_active"] = new Date().toISOString();
      if (payload.meta !== undefined) body["meta"] = payload.meta;

      request("/execute/ui.panel_update", {
        method: "POST",
        body: JSON.stringify(body),
      }).catch(() => undefined);
    },
    [request],
  );

  return { updatePanel };
}
