/**
 * URL / backend resolution utilities for the Embeddr plugin ecosystem.
 *
 * Import from "@embeddr/react-ui/lib/url" in plugin code.
 */

/**
 * Strip the `/api/vN` suffix from a backend URL to get the root origin.
 *
 * @example
 *   stripApiVersion("http://localhost:8080/api/v1") // "http://localhost:8080"
 *   stripApiVersion("http://localhost:8080/api/v2/") // "http://localhost:8080"
 */
export function stripApiVersion(backendUrl: string): string {
  return (backendUrl || "").replace(/\/api\/v\d+\/?$/, "").replace(/\/$/, "");
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
  const base = backendUrl ? stripApiVersion(backendUrl) : "";
  return `${base}/api/v1/artifacts/${artifactId}/content`;
}

/**
 * Build an artifact preview/thumbnail URL.
 */
export function artifactPreviewUrl(
  artifactId: string,
  backendUrl?: string,
): string {
  const base = backendUrl ? stripApiVersion(backendUrl) : "";
  return `${base}/api/v1/artifacts/${artifactId}/preview`;
}
