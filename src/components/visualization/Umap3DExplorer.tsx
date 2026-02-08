import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  ExternalLinkIcon,
  EyeIcon,
  ImageIcon,
  Loader2,
  ScatterChart,
  X,
  Grid,
  Focus,
} from "lucide-react";
import { Button } from "../../ui/button";
import type { Explorer3DProps, Point3D, SearchQueryMarker } from "./types";

// Helper to extract coordinates safely
const getCoordinates = (point: Point3D): [number, number, number] => {
  let x = 0,
    y = 0,
    z = 0;

  x = point.x || 0;
  y = point.y || 0;
  z = point.z || 0;

  if (isNaN(x)) x = 0;
  if (isNaN(y)) y = 0;
  if (isNaN(z)) z = 0;

  // Scale can be adjusted here if needed, but standardizing input is better
  return [x, y, z];
};

const PointCloud = ({
  points,
  onHover,
  onClick,
  size = 0.15,
  opacity = 0.8,
}: {
  points: Array<Point3D>;
  onHover: (index: number | null, point: Point3D | null) => void;
  onClick: (
    index: number,
    point: Point3D,
    event: ThreeEvent<MouseEvent>,
  ) => void;
  size?: number;
  opacity?: number;
}) => {
  const meshRef = useRef<THREE.Points>(null);
  const hoverRef = useRef<number | null>(null);

  // Convert points to Float32Array for BufferGeometry
  const positions = useMemo(() => {
    const pos = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p) continue;
      const [x, y, z] = getCoordinates(p);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    return pos;
  }, [points]);

  const colors = useMemo(() => {
    const cols = new Float32Array(points.length * 3);
    const color = new THREE.Color();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p) continue;

      // Use explicit color if available
      if (p.color) {
        color.set(p.color);
      } else {
        // Fallback: Map position to color
        const [x, y, z] = getCoordinates(p);
        const nx = x / 20 + 0.5;
        const ny = y / 20 + 0.5;
        const nz = z / 20 + 0.5;
        color.setRGB(
          Math.max(0, Math.min(1, nx)),
          Math.max(0, Math.min(1, ny)),
          Math.max(0, Math.min(1, nz)),
        );
      }

      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    }
    return cols;
  }, [points]);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const index = e.index;
    if (index !== undefined && index !== hoverRef.current) {
      hoverRef.current = index;
      if (index >= 0 && index < points.length) {
        const p = points[index];
        if (p) onHover(index, p);
      }
    }
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    hoverRef.current = null;
    onHover(null, null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const index = e.index;
    if (index !== undefined && index >= 0 && index < points.length) {
      const p = points[index];
      if (p) onClick(index, p, e);
    }
  };

  return (
    <points
      ref={meshRef}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        vertexColors
        sizeAttenuation
        transparent
        opacity={opacity}
      />
    </points>
  );
};

const ImageSprite = ({
  point,
  getImageUrl,
  onClick,
  size = 0.5,
}: {
  point: Point3D;
  getImageUrl: (p: Point3D, t: "thumb" | "full") => string;
  onClick?: (point: Point3D) => void;
  size?: number;
}) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const url = getImageUrl(point, "thumb");

  useEffect(() => {
    let active = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        if (active) {
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false; // Performance optimization for many small textures
          setTexture(tex);
        }
      },
      undefined,
      (err) => {
        if (active) {
          console.warn(`Failed to load thumbnail for ${point.id}:`, err);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [url, point.id]);

  if (!texture) return null;

  const [x, y, z] = getCoordinates(point);

  // Calculate aspect ratio preserving scale
  let scaleX = size;
  let scaleY = size;

  // Cast to any to avoid TS errors
  const img = texture.image as any;

  if (img && img.width && img.height) {
    const aspect = img.width / img.height;
    if (aspect > 1) {
      // Landscape: Width is fast, Height is scaled down
      scaleY = size / aspect;
    } else {
      // Portrait: Height is fast, Width is scaled down
      scaleX = size * aspect;
    }
  }

  return (
    <sprite
      position={[x, y, z]}
      scale={[scaleX, scaleY, 1]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(point);
      }}
    >
      <spriteMaterial
        map={texture}
        transparent={true}
        opacity={1.0}
        alphaTest={0.1}
      />
    </sprite>
  );
};

const ImageNodes = ({
  points,
  getImageUrl,
  onClick,
  size,
}: {
  points: Array<Point3D>;
  getImageUrl: (p: Point3D, t: "thumb" | "full") => string;
  onClick?: (point: Point3D) => void;
  size: number;
}) => {
  const imagePoints = useMemo(() => {
    return points.filter((p) => {
      if (!p) return false;
      const ap = p as any;
      // Markers aren't images
      if (ap.isMarker || ap.isQuery) return false;

      // Get type from various possible locations
      const type = (
        ap.artifact_type ||
        ap.type ||
        ap.metadata?.type ||
        ""
      ).toLowerCase();

      // Explicitly block non-visual types
      if (
        type.includes("folder") ||
        type.includes("collection") ||
        type.includes("directory") ||
        type.includes("container")
      ) {
        return false;
      }

      // If it has an ID, we try to render it.
      // The backend handles the actual image check.
      // This ensures "Artifact" types that are actually images still show up.
      return !!ap.id;
    });
  }, [points]);

  return (
    <group>
      {imagePoints.map((p) => (
        <ImageSprite
          key={p.id}
          point={p}
          getImageUrl={getImageUrl}
          onClick={onClick}
          size={size * 2.0}
        />
      ))}
    </group>
  );
};

const HighlightPoint = ({
  point,
  size = 0.15,
}: {
  point: Point3D | null;
  size?: number;
}) => {
  if (!point) return null;
  const pos = getCoordinates(point);

  return (
    <mesh position={pos}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        color="#ff00ff"
        emissive="#ff00ff"
        emissiveIntensity={2}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
};

const SelectedPoints = ({
  points,
  selectedIndices,
  size = 0.15,
}: {
  points: Array<Point3D>;
  selectedIndices: Array<number>;
  size?: number;
}) => {
  if (!points || selectedIndices.length === 0) return null;

  return (
    <group>
      {selectedIndices.map((idx) => {
        const point = points[idx];
        if (!point) return null;
        const pos = getCoordinates(point);

        return (
          <mesh key={idx} position={pos}>
            <sphereGeometry args={[size, 16, 16]} />
            <meshStandardMaterial
              color="#00ffff"
              emissive="#00ffff"
              emissiveIntensity={2}
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const QueryMarker = ({ marker }: { marker: SearchQueryMarker }) => {
  return (
    <group position={[marker.x, marker.y, marker.z]}>
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color={marker.color || "#ffffff"}
          emissive={marker.color || "#ffffff"}
          emissiveIntensity={2}
        />
      </mesh>
      <Html position={[0, 0.5, 0]} center zIndexRange={[100, 0]}>
        <div className="bg-black/80 text-white text-xs px-2 py-1 rounded border border-white/20 whitespace-nowrap backdrop-blur-md pointer-events-none font-medium shadow-lg">
          {marker.label}
        </div>
      </Html>
    </group>
  );
};

const CameraController = ({
  controlsRef,
  targetPoint,
  isActive = true,
}: {
  controlsRef: React.RefObject<any>;
  targetPoint: THREE.Vector3 | null;
  isActive?: boolean;
}) => {
  const { camera } = useThree();
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const isAnimating = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActive) setKeys((k) => ({ ...k, [e.code]: true }));
    };
    const handleKeyUp = (e: KeyboardEvent) =>
      setKeys((k) => ({ ...k, [e.code]: false }));
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isActive]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // Handle animation to target
    if (targetPoint) {
      const currentTarget = controlsRef.current.target;
      const dist = currentTarget.distanceTo(targetPoint);

      if (dist > 0.1) {
        isAnimating.current = true;
        // Smoothly interpolate target
        controlsRef.current.target.lerp(targetPoint, delta * 5);
      } else {
        isAnimating.current = false;
      }
    }

    // Manual controls override animation if keys are pressed
    const hasInput = isActive && Object.values(keys).some((k) => k);
    if (hasInput) {
      isAnimating.current = false;
      const speed = (keys["ShiftLeft"] || keys["ShiftRight"] ? 20 : 8) * delta;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);

      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      const move = new THREE.Vector3();

      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          document.activeElement.tagName === "SELECT")
      ) {
        // Ignore input when tying
      } else {
        if (keys["KeyW"] || keys["ArrowUp"]) move.add(forward);
        if (keys["KeyS"] || keys["ArrowDown"]) move.sub(forward);
        if (keys["KeyA"] || keys["ArrowLeft"]) move.sub(right);
        if (keys["KeyD"] || keys["ArrowRight"]) move.add(right);

        // Q/E for vertical movement
        if (keys["KeyQ"]) move.y += 1;
        if (keys["KeyE"]) move.y -= 1;
      }

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed);
        camera.position.add(move);
        controlsRef.current.target.add(move);
      }
    }
  });

  return null;
};

const ConnectionLines = ({
  points,
  connections,
  highlightedConnection,
}: {
  points: Array<Point3D>;
  connections?: Array<{
    startId: string | number;
    endId: string | number;
    color?: string;
  }>;
  highlightedConnection?: {
    startId: string | number;
    endId: string | number;
  } | null;
}) => {
  if (!connections || connections.length === 0) return null;

  const { lines, highlightedLine } = useMemo(() => {
    const pointMap = new Map();
    points.forEach((p) => pointMap.set(p.id, p));

    // Create geometry for lines
    const vertices: number[] = [];
    const colors: number[] = [];

    // Geometry for highlight
    const highlightVertices: number[] = [];
    const highlightColors: number[] = [];

    const tempColor = new THREE.Color();

    connections.forEach((c) => {
      const start = pointMap.get(c.startId);
      const end = pointMap.get(c.endId);
      if (start && end) {
        const [sx, sy, sz] = getCoordinates(start);
        const [ex, ey, ez] = getCoordinates(end);

        const isHighlighted =
          highlightedConnection &&
          ((highlightedConnection.startId === c.startId &&
            highlightedConnection.endId === c.endId) ||
            (highlightedConnection.startId === c.endId &&
              highlightedConnection.endId === c.startId)); // Bidirectional check

        if (isHighlighted) {
          highlightVertices.push(sx, sy, sz, ex, ey, ez);
          highlightColors.push(1, 1, 1, 1, 1, 1); // Pure white for highlight
        } else {
          vertices.push(sx, sy, sz, ex, ey, ez);
          // Color handling
          if (c.color) tempColor.set(c.color);
          else tempColor.set(1, 1, 1);

          colors.push(tempColor.r, tempColor.g, tempColor.b);
          colors.push(tempColor.r, tempColor.g, tempColor.b);
        }
      }
    });

    return {
      lines: {
        vertices: new Float32Array(vertices),
        colors: new Float32Array(colors),
      },
      highlightedLine: {
        vertices: new Float32Array(highlightVertices),
        colors: new Float32Array(highlightColors),
      },
    };
  }, [points, connections, highlightedConnection]);

  return (
    <group>
      {/* Normal Lines */}
      {lines.vertices.length > 0 && (
        <lineSegments key={`lines-${connections.length}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={lines.vertices.length / 3}
              array={lines.vertices}
              itemSize={3}
              args={[lines.vertices, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              count={lines.colors.length / 3}
              array={lines.colors}
              itemSize={3}
              args={[lines.colors, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.4}
            linewidth={1}
          />
        </lineSegments>
      )}

      {/* Highlighted Lines (Thicker/Brighter) */}
      {highlightedLine.vertices.length > 0 && (
        <lineSegments renderOrder={1}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={highlightedLine.vertices.length / 3}
              array={highlightedLine.vertices}
              itemSize={3}
              args={[highlightedLine.vertices, 3]}
            />
          </bufferGeometry>
          {/* Note: lineWidth doesn't always work in WebGL, but we can try opacity/color pop */}
          <lineBasicMaterial
            color="white"
            opacity={1.0}
            linewidth={3}
            depthTest={false}
          />
        </lineSegments>
      )}
    </group>
  );
};

export const Umap3DExplorer = ({
  points = [],
  isLoading = false,
  error = null,
  onPointSelect,
  getImageUrl,
  className,
  count,
  showDefaultOverlay = true,
  connections = [],
  pointSize = 0.15,
  selectedPointId,
  highlightedConnection,
  searchMarkers = [],
  isActive = true,
}: Explorer3DProps & {
  isActive?: boolean;
  showDefaultOverlay?: boolean;
  connections?: any[];
  pointSize?: number;
  selectedPointId?: string | number | null;
  searchMarkers?: SearchQueryMarker[];
  highlightedConnection?: {
    startId: string | number;
    endId: string | number;
  } | null;
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<Point3D | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Array<number>>([]);
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);
  const [showImages, setShowImages] = useState(false);
  const lastPointsLengthRef = useRef(0);
  const canShowImages = points.length <= 5000;
  const showPointCloud = !showImages;

  // Unified selection and auto-centering logic
  useEffect(() => {
    if (!points || points.length === 0 || !controlsRef.current) {
      lastPointsLengthRef.current = points?.length || 0;
      return;
    }

    // 1. Handle selection focus (Priority)
    if (selectedPointId !== undefined && selectedPointId !== null) {
      const index = points.findIndex((p) => p.id === selectedPointId);
      if (index !== -1) {
        const p = points[index];
        if (!p) return;
        const [x, y, z] = getCoordinates(p);
        setSelectedIndices([index]);
        setCameraTarget(new THREE.Vector3(x, y, z));
        lastPointsLengthRef.current = points.length;
        return; // Selection wins over centroid
      }
    } else {
      if (selectedIndices.length > 0) setSelectedIndices([]);
    }

    // 2. Handle initial/dramatic centroid re-centering
    const isInitial = lastPointsLengthRef.current === 0;
    const isMajorShift =
      Math.abs(points.length - lastPointsLengthRef.current) >
      lastPointsLengthRef.current * 0.4;

    if (isInitial || isMajorShift) {
      let sumX = 0,
        sumY = 0,
        sumZ = 0,
        validCount = 0;
      for (const p of points) {
        if (!p) continue;
        const [x, y, z] = getCoordinates(p);
        sumX += x;
        sumY += y;
        sumZ += z;
        validCount++;
      }

      if (validCount > 0) {
        setCameraTarget(
          new THREE.Vector3(
            sumX / validCount,
            sumY / validCount,
            sumZ / validCount,
          ),
        );
      }
    }

    lastPointsLengthRef.current = points.length;
  }, [selectedPointId, points]);

  const controlsRef = useRef<any>(null);

  const handlePointClick = (
    index: number,
    point: Point3D,
    event?: ThreeEvent<MouseEvent>,
  ) => {
    // Normal click: Select point (CameraController will lerp smoothly)
    setSelectedIndices([index]);
    if (onPointSelect) onPointSelect(point);
  };

  const selectNearest = (index: number, numberOfNeighbors: number = 50) => {
    if (!points) return;
    const origin = points[index];
    if (!origin) return;

    const [ox, oy, oz] = getCoordinates(origin);

    // Calculate all distances
    const distances = points.map((p: Point3D, i: number) => {
      const [px, py, pz] = getCoordinates(p);
      const dx = px - ox;
      const dy = py - oy;
      const dz = pz - oz;
      return { i, d: dx * dx + dy * dy + dz * dz }; // Squared dist is enough for sorting
    });
    distances.sort((a: any, b: any) => a.d - b.d);
    const nearest = distances.slice(0, numberOfNeighbors).map((d: any) => d.i);
    setSelectedIndices(nearest);
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse">
          Loading 3D Point Cloud...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center text-destructive">
        Error loading 3D data: {error.message}
      </div>
    );
  }

  if (!points || points.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        No 3D data found.
      </div>
    );
  }

  const selectedIndex =
    selectedIndices.length === 1 ? selectedIndices[0] : undefined;
  const selectedPoint =
    selectedIndex !== undefined ? points[selectedIndex] : undefined;

  return (
    <div
      className={`w-full h-full flex flex-col bg-card relative overflow-hidden ${
        className || ""
      }`}
    >
      <Canvas
        camera={{ position: [0, 0, 15], fov: 60 }}
        raycaster={{ params: { Points: { threshold: 0.15 } } as any }}
      >
        <fog attach="fog" args={["#050505", 10, 70]} />

        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.1}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          minDistance={1}
          maxDistance={30}
        />

        <CameraController
          controlsRef={controlsRef}
          targetPoint={cameraTarget}
          isActive={isActive}
        />

        {showPointCloud && (
          <PointCloud
            points={points}
            onHover={(_, point) => setHoveredPoint(point)}
            onClick={handlePointClick}
            size={pointSize}
            opacity={0.8}
          />
        )}

        {showImages && canShowImages && (
          <ImageNodes
            points={points}
            getImageUrl={getImageUrl}
            onClick={(p) => {
              const idx = points.findIndex((pt) => pt.id === p.id);
              if (idx !== -1) handlePointClick(idx, p);
            }}
            size={pointSize}
          />
        )}
        {!showImages && (
          <>
            <HighlightPoint point={hoveredPoint} size={pointSize} />
            <SelectedPoints
              points={points}
              selectedIndices={selectedIndices}
              size={pointSize}
            />
          </>
        )}
        <ConnectionLines
          points={points}
          connections={connections}
          highlightedConnection={highlightedConnection}
        />
        {searchMarkers.map((m, i) => (
          <QueryMarker key={i} marker={m} />
        ))}
      </Canvas>

      <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
        <div className="bg-black/50 backdrop-blur text-white px-3 py-1 text-xs border border-white/10 rounded flex items-center h-8">
          {count ? count.toLocaleString() : points.length.toLocaleString()}{" "}
          points
        </div>
      </div>

      <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto">
        <Button
          variant={showImages ? "default" : "outline"}
          size="sm"
          className="h-8 gap-2"
          onClick={() => setShowImages((prev) => !prev)}
          title={
            canShowImages
              ? "Toggle image thumbnails"
              : "Too many points to show images"
          }
          disabled={!canShowImages}
        >
          <ImageIcon className="w-4 h-4" />
          <span className="text-[10px] uppercase font-bold">
            {showImages ? "Images On" : "Images Off"}
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2"
          onClick={() => setCameraTarget(null)}
          disabled={!cameraTarget}
          title="Reset camera target"
        >
          <Focus className="w-4 h-4" />
          <span className="text-[10px] uppercase font-bold">Reset</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2"
          onClick={() => setSelectedIndices([])}
          disabled={!selectedIndices.length}
          title="Clear selection"
        >
          <Grid className="w-4 h-4" />
          <span className="text-[10px] uppercase font-bold">Clear</span>
        </Button>
      </div>

      {/* Target Clear Indicator */}
      {cameraTarget && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur text-white px-3 py-1 text-xs border border-white/20 rounded-full flex items-center gap-2 shadow-xl">
            <span>Camera Locked</span>
            <button
              onClick={() => setCameraTarget(null)}
              className="hover:bg-white/20 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Selected info with full image (Bottom Left) - Default Overlay */}
      {showDefaultOverlay && selectedPoint && selectedIndex !== undefined && (
        <div className="absolute bottom-4 left-4 z-10 ring-2 ring-foreground/10 overflow-hidden shadow-lg max-w-sm rounded bg-card">
          <div
            className="cursor-pointer relative ring-1 ring-foreground/10 hover:ring-2"
            onClick={() => {
              if (onPointSelect) onPointSelect(selectedPoint);
            }}
          >
            <img
              src={getImageUrl(selectedPoint, "thumb")}
              alt={`Point ${selectedIndex}`}
              className="w-full h-64 object-contain bg-black/20"
            />
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndices([]);
              }}
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                selectNearest(selectedIndex);
              }}
              variant="ghost"
              size="sm"
              className="absolute top-2 left-2 h-8 px-2 bg-black/50 hover:bg-black/70 text-white text-xs flex items-center justify-center backdrop-blur-sm rounded"
              title="Select 50 nearest neighbors"
            >
              <ScatterChart className="w-4 h-4 mr-1" />
            </Button>
          </div>
          <div className="absolute bottom-2 left-2 px-4 py-3 w-fit">
            <div className="mt-2 flex flex-row gap-1 absolute bottom-0 left-0 p-1">
              <Button
                variant="ghost"
                className="w-8 h-8 z-50 bg-black/50 hover:bg-black/70 p-2 text-white flex items-center justify-center backdrop-blur-sm rounded-full"
                onClick={() => {
                  if (onPointSelect) onPointSelect(selectedPoint);
                }}
              >
                <EyeIcon className="w-4" />
              </Button>
              <Button
                variant="ghost"
                className="w-8 h-8 bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm rounded-full"
                asChild
              >
                <a
                  href={getImageUrl(selectedPoint, "full")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLinkIcon className="w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-selection Grid (Bottom Left) */}
      {selectedIndices.length > 1 && points && (
        <div className="absolute bottom-4 left-4 z-10 bg-card border border-border overflow-hidden shadow-lg w-96 max-h-[50vh] flex flex-col rounded">
          <div className="p-2 bg-muted border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIndices.length} selected
            </span>
            <Button
              onClick={() => setSelectedIndices([])}
              variant="ghost"
              size="sm"
              className="text-xs h-6"
            >
              Clear
            </Button>
          </div>
          <div className="p-2 overflow-y-auto grid grid-cols-4 gap-2">
            {selectedIndices.slice(0, 100).map((idx) => {
              const point = points[idx];
              if (!point) return null;
              return (
                <div
                  key={idx}
                  className="aspect-square relative group cursor-pointer ring-1 ring-border hover:ring-primary/20 hover:ring-2 rounded overflow-hidden"
                  onClick={() => {
                    setSelectedIndices([idx]);
                    if (onPointSelect) onPointSelect(point);
                  }}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <img
                    src={getImageUrl(point, "thumb")}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 pointer-events-none max-w-sm text-right">
        <div className="text-white/50 text-[10px] bg-black/50 backdrop-blur px-2 py-1 border border-white/10 rounded">
          Left Click: Select • Ctrl+Click: Center & Select • Right Click: Pan •
          Scroll: Zoom • WASD/QE: Move
        </div>
      </div>
    </div>
  );
};
