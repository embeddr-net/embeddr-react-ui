/**
 * URL / backend resolution utilities for the Embeddr plugin ecosystem.
 *
 * Import from "@embeddr/react-ui/lib/url" in plugin code.
 */

/**
 * Strip any trailing API suffix from a backend URL to get the root origin.
 *
 * Supported suffixes:
 * - `/api`
 * - `/api/vN`
 *
 * @example
 *   stripApiVersion("http://localhost:8080/api/v1") // "http://localhost:8080"
 *   stripApiVersion("http://localhost:8080/api") // "http://localhost:8080"
 */
export function stripApiVersion(backendUrl: string): string {
  return (backendUrl || "")
    .replace(/\/api(?:\/v\d+)?\/?$/, "")
    .replace(/\/$/, "");
}

/**
 * Resolve a backend API base URL.
 *
 * Rules:
 * - If `backendUrl` ends with `/api` or `/api/vN`, normalize to `/api`.
 * - Otherwise append `/api`.
 * - If no URL is provided, return relative `/api`.
 */
export function resolveApiBaseUrl(backendUrl?: string): string {
  const raw = (backendUrl || "").trim().replace(/\/$/, "");
  if (!raw) return "/api";
  if (/\/api(?:\/v\d+)?$/i.test(raw)) {
    const base = stripApiVersion(raw);
    return `${base}/api`;
  }
  return `${raw}/api`;
}

/**
 * Append `api_key` query param to a URL when an API key is available.
 * Returns the original URL on parse failures.
 */
export function appendApiKeyToUrl(url: string, apiKey?: string | null): string {
  if (!url || !apiKey) return url;
  try {
    const urlObj = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    urlObj.searchParams.set("api_key", apiKey);
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Derive the backend base (origin) from an `EmbeddrAPI` instance,
 * stripping the `/api/vN` suffix.
 *
 * Falls back to window.location.origin when no backendUrl is set.
 */
export function getBackendBase(api: {
  utils?: { backendUrl?: string };
}): string {
  const raw = api.utils?.backendUrl ?? "";
  if (!raw && typeof window !== "undefined") return window.location.origin;
  return stripApiVersion(raw);
}

/**
 * Build an artifact content URL.
 */
export function artifactContentUrl(
  artifactId: string,
  backendUrl?: string,
): string {
  const apiBase = resolveApiBaseUrl(backendUrl);
  return `${apiBase}/artifacts/${artifactId}/content`;
}

/**
 * Build an artifact preview/thumbnail URL.
 */
export function artifactPreviewUrl(
  artifactId: string,
  backendUrl?: string,
): string {
  const apiBase = resolveApiBaseUrl(backendUrl);
  return `${apiBase}/artifacts/${artifactId}/preview`;
}
