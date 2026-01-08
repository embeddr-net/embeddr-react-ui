export interface Point3D {
  x: number;
  y: number;
  z: number;
  id: string | number;
  [key: string]: any;
}

export interface Explorer3DProps {
  points: Array<Point3D>;
  isLoading?: boolean;
  error?: Error | null;
  onPointSelect?: (point: Point3D) => void;
  getImageUrl: (point: Point3D, type: "thumb" | "full") => string;
  className?: string;
  count?: number; // Total count if points is a subset
}
