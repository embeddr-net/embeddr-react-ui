/**
 * TypePreviewRenderer — resolves and renders a plugin-defined type overlay.
 *
 * Looks up the artifact's type in the server's type registry, checks for a
 * `preview_component` and `registered_by` in the type's metadata, then loads
 * the owning plugin's UMD and renders the named component as an overlay.
 *
 * Children (typically EmbeddrArtifact) handle the actual image rendering, DnD,
 * and auth signing. The plugin's preview component provides type-specific
 * visual treatment: badges, play buttons, title bars, icons.
 *
 * If no custom preview is registered, children render alone (default behavior).
 */
import React from "react";

interface TypePreviewRendererProps {
  api: any;
  artifact: {
    id: string;
    type_name: string;
    base_type_name?: string;
    uri?: string;
    metadata_json?: Record<string, any>;
  };
  variant?: "thumbnail" | "card" | "detail";
  className?: string;
  children?: React.ReactNode;
}

interface TypeMeta {
  preview_component?: string;
  registered_by?: string;
  icon?: string;
}

function fetchJson(api: any, path: string) {
  const raw = (api.utils?.backendUrl || "").replace(/\/+$/, "");
  const base = raw.replace(/\/api(\/v\d+)?$/, "");
  const url = base ? `${base}/api/v1${path}` : `/api/v1${path}`;
  const headers: Record<string, string> = {};
  const key = api.utils?.getApiKey?.();
  if (key) headers["X-API-Key"] = key;
  return fetch(url, { headers, credentials: "include" }).then((r) => r.json());
}

// ── Hooks ────────────────────────────────────────────────────────

/**
 * Resolve type metadata for an artifact type from the server's type registry.
 */
export function useTypeMetadata(api: any, typeName: string): TypeMeta | null {
  const [types, setTypes] = React.useState<any[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetchJson(api, "/types").then((data) => {
      if (alive && Array.isArray(data)) setTypes(data);
    }).catch(() => {});
    return () => { alive = false; };
  }, [api]);

  return React.useMemo(() => {
    if (!types) return null;
    const typeDef = types.find((t: any) => t.name === typeName);
    if (!typeDef?.metadata?.preview_component) return null;
    return {
      preview_component: typeDef.metadata.preview_component,
      registered_by: typeDef.metadata.registered_by,
      icon: typeDef.metadata.icon,
    };
  }, [types, typeName]);
}

/**
 * Load a React component from a plugin UMD by plugin ID and component name.
 */
export function usePluginComponent(
  api: any,
  pluginId: string | undefined,
  componentName: string | undefined,
): React.ComponentType<any> | null {
  const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [manifests, setManifests] = React.useState<any[] | null>(null);

  React.useEffect(() => {
    if (!pluginId || !componentName) return;
    let alive = true;
    fetchJson(api, "/plugins").then((data) => {
      if (alive && Array.isArray(data)) setManifests(data);
    }).catch(() => {});
    return () => { alive = false; };
  }, [api, pluginId, componentName]);

  React.useEffect(() => {
    if (!pluginId || !componentName || !manifests) return;

    const manifest = manifests.find((p: any) => p.id === pluginId || p.name === pluginId);
    if (!manifest?.url) return;

    const raw = (api.utils?.backendUrl || "").replace(/\/+$/, "");
    const base = raw.replace(/\/api(\/v\d+)?$/, "");
    const scriptUrl = manifest.url.startsWith("http") ? manifest.url : `${base}${manifest.url}`;
    const libName = pluginId.replace(/[^a-zA-Z0-9]/g, "_") + "Plugin";

    const tryResolve = (): boolean => {
      const lib = (window as any)[libName];
      if (!lib) return false;
      const candidate = lib[componentName] || lib.default?.[componentName];
      if (candidate && (typeof candidate === "function" || candidate?.$$typeof)) {
        setComponent(() => candidate);
        return true;
      }
      return false;
    };

    if (tryResolve()) return;

    const existing = document.querySelector(`script[src="${scriptUrl}"]`);
    if (existing) {
      let attempts = 0;
      const interval = setInterval(() => {
        if (tryResolve() || ++attempts > 30) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      let attempts = 0;
      const interval = setInterval(() => {
        if (tryResolve() || ++attempts > 20) clearInterval(interval);
      }, 50);
    };
    document.body.appendChild(script);
  }, [pluginId, componentName, manifests, api]);

  return Component;
}

// ── Error Boundary ───────────────────────────────────────────────

class OverlayErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

// ── Component ────────────────────────────────────────────────────

export const TypePreviewRenderer: React.FC<TypePreviewRendererProps> = ({
  api,
  artifact,
  variant = "thumbnail",
  className,
  children,
}) => {
  const typeMeta = useTypeMetadata(api, artifact?.type_name);
  const OverlayComponent = usePluginComponent(
    api,
    typeMeta?.registered_by ?? undefined,
    typeMeta?.preview_component ?? undefined,
  );

  // No overlay — just render children as-is
  if (!OverlayComponent || typeof OverlayComponent !== "function") {
    return React.createElement(React.Fragment, null, children);
  }

  return React.createElement(React.Fragment, null,
    children,
    React.createElement("div", {
      className: "absolute inset-0 pointer-events-none z-10",
    },
      React.createElement(OverlayErrorBoundary, null,
        React.createElement(OverlayComponent, {
          api,
          artifact,
          variant,
          className,
        }),
      ),
    ),
  );
};
