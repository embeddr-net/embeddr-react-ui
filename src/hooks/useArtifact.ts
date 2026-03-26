import { resolveApiBaseUrl } from "../lib/url";
import { useEmbeddr } from "./useEmbeddr";

export interface ArtifactUrls {
  id: string;
  /** The full URL to the raw file */
  fileUrl: string;
  /** Alias for fileUrl */
  url: string;
  /** The full URL to the preview image */
  previewUrl: string;
  /** Alias for previewUrl */
  preview: string;
  /** The API URL for artifact metadata */
  artifactUrl: string;
  /** Legacy alias to artifact content URL */
  imageUrl: string;
}

/**
 * Helper to generate artifact URLs imperatively (outside of hooks).
 * @param backendUrl - The base backend URL (e.g. from api.utils.backendUrl)
 * @param id - The artifact ID
 */
export const getArtifactUrls = (
  backendUrl: string,
  id: string | number,
): ArtifactUrls => {
  const strId = id.toString();
  const apiBase = resolveApiBaseUrl(backendUrl);

  const previewUrl = `${apiBase}/artifacts/${strId}/preview`;
  const fileUrl = `${apiBase}/artifacts/${strId}/content`;
  const artifactUrl = `${apiBase}/artifacts/${strId}`;

  return {
    id: strId,
    fileUrl,
    url: fileUrl,
    previewUrl,
    preview: previewUrl,
    imageUrl: fileUrl,
    artifactUrl,
  };
};

/**
 * Hook to get standardized URLs for an artifact/image.
 * Handles switching between V1 and V2 API endpoints.
 *
 * @param id - The ID of the artifact/image
 * @returns Object containing various URLs for the artifact
 */
export const useArtifact = (
  id: string | number | null | undefined,
): ArtifactUrls | null => {
  const { utils } = useEmbeddr();

  if (!id) return null;

  return getArtifactUrls(utils.backendUrl, id);
};

// Alias for users who prefer thinking in "Images"
export const useImage = useArtifact;
