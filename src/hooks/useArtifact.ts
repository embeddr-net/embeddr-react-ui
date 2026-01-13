import { useEmbeddr } from "./useEmbeddr";

export interface ArtifactUrls {
  id: string;
  /** The full URL to the raw file (V1 API) */
  fileUrl: string;
  /** Alias for fileUrl */
  url: string;
  /** The full URL to the preview image (V2 API) */
  previewUrl: string;
  /** Alias for previewUrl */
  preview: string;
  /** The API URL for artifact metadata (V2 API) */
  artifactUrl: string;
  /** The API URL for image metadata (V1 API) */
  imageUrl: string;
}

/**
 * Helper to generate artifact URLs imperatively (outside of hooks).
 * @param backendUrl - The base backend URL (e.g. from api.utils.backendUrl)
 * @param id - The artifact ID
 */
export const getArtifactUrls = (
  backendUrl: string,
  id: string | number
): ArtifactUrls => {
  const strId = id.toString();

  // Helper to switch to V2 API base
  const getV2Base = (url: string) => {
    if (url.endsWith("/v1")) {
      return url.replace(/\/v1$/, "/v2");
    }
    if (url.endsWith("/v1/")) {
      return url.replace(/\/v1\/$/, "/v2/");
    }
    return `${url}/v2`;
  };

  const v2Base = getV2Base(backendUrl);

  const infoUrl = `${backendUrl}/images/${strId}`;

  const previewUrl = `${v2Base}/artifacts/${strId}/preview`;
  const fileUrl = `${v2Base}/artifacts/${strId}/content`;
  const artifactUrl = `${v2Base}/artifacts/${strId}`;

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
  id: string | number | null | undefined
): ArtifactUrls | null => {
  const { utils } = useEmbeddr();

  if (!id) return null;

  return getArtifactUrls(utils.backendUrl, id);
};

// Alias for users who prefer thinking in "Images"
export const useImage = useArtifact;
