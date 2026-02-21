import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ClassValue } from "clsx";

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs));
}

export const resolveBackendOrigin = (backendUrl?: string | null) => {
  const raw = String(backendUrl || "").trim();
  if (!raw) return "";
  const clean = raw.replace(/\/+$/, "");
  if (/\/api$/i.test(clean)) return clean.replace(/\/api$/i, "");
  if (/\/api\/v\d+$/i.test(clean)) {
    return clean.replace(/\/api\/v\d+$/i, "");
  }
  return clean;
};

export const resolveRelativeToBackend = (
  url?: string | null,
  backendUrl?: string | null,
) => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) {
    if (typeof window !== "undefined" && window.location.protocol) {
      return `${window.location.protocol}${value}`;
    }
    return `https:${value}`;
  }

  const origin = resolveBackendOrigin(backendUrl);
  if (value.startsWith("/")) {
    return origin ? `${origin}${value}` : value;
  }

  return origin ? `${origin}/${value}` : value;
};

export const pluginAssetPath = (pluginId: string, assetPath: string) => {
  const cleanPlugin = String(pluginId || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const cleanAsset = String(assetPath || "")
    .trim()
    .replace(/^\/+/, "");
  return `/plugins/${cleanPlugin}/assets/${cleanAsset}`;
};

export const resolvePluginAssetUrl = (
  pluginId: string,
  assetPath: string,
  backendUrl?: string | null,
) => resolveRelativeToBackend(pluginAssetPath(pluginId, assetPath), backendUrl);
