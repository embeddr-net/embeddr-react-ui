/**
 * Shared types for 3D Gaussian Splat viewers.
 *
 * These live in @embeddr/react-ui so any plugin can consume splat data
 * without re-declaring interfaces.
 */

/** Parsed gaussian splat data — format-agnostic in-memory representation. */
export interface SplatData {
  /** Total number of gaussians */
  count: number;

  /** Flat Float32Array of positions [x0,y0,z0, x1,y1,z1, ...] */
  positions: Float32Array;

  /** Flat Float32Array of RGBA colours [r0,g0,b0,a0, ...] in 0-1 range */
  colors: Float32Array;

  /** Flat Float32Array of scales [sx0,sy0,sz0, ...] */
  scales: Float32Array;

  /** Flat Float32Array of quaternion rotations [qx0,qy0,qz0,qw0, ...] */
  rotations: Float32Array;

  /** Optional: spherical harmonics coefficients per gaussian */
  sphericalHarmonics?: Float32Array;

  /** SH degree (0 = just DC / base colour, 1-3 for higher order) */
  shDegree?: number;
}

/** Bounding box of the point cloud. */
export interface SplatBounds {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  radius: number;
}

/** Stats computed after parsing a splat file. */
export interface SplatStats {
  pointCount: number;
  bounds: SplatBounds;
  format: "ply" | "splat" | "unknown";
  hasAlpha: boolean;
  hasScales: boolean;
  hasRotations: boolean;
  hasSH: boolean;
}

/** Viewer configuration knobs. */
export interface SplatViewerConfig {
  /** Point rendering size multiplier */
  pointSize: number;
  /** Whether to use gaussian splatting shader vs simple points */
  useGaussianShader: boolean;
  /** Maximum points to render (for performance) */
  renderLimit: number;
  /** Background colour */
  backgroundColor: string;
  /** Show axes helper */
  showAxes: boolean;
  /** Show bounding box */
  showBounds: boolean;
  /** Camera fly speed */
  flySpeed: number;
  /** Opacity multiplier */
  opacity: number;
}

export const DEFAULT_SPLAT_VIEWER_CONFIG: SplatViewerConfig = {
  pointSize: 1.0,
  useGaussianShader: false,
  renderLimit: 2_000_000,
  backgroundColor: "#0a0a0a",
  showAxes: false,
  showBounds: false,
  flySpeed: 5.0,
  opacity: 1.0,
};
