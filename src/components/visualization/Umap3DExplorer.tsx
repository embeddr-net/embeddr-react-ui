import { useEffect, useMemo, useRef, useState } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  ExternalLinkIcon,
  EyeIcon,
  ScatterChart,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "../../ui/button";
import type { Explorer3DProps, Point3D } from "./types";

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
}: {
  points: Array<Point3D>;
  onHover: (index: number | null, point: Point3D | null) => void;
  onClick: (
    index: number,
    point: Point3D,
    event: ThreeEvent<MouseEvent>
  ) => void;
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
      const [x, y, z] = getCoordinates(p);

      // Map position to color (normalization might be needed depending on scale)
      // Assuming coordinates are somewhat centered around 0 and within -10 to 10 range approximately
      // We normalize to 0-1 for color
      const nx = x / 20 + 0.5;
      const ny = y / 20 + 0.5;
      const nz = z / 20 + 0.5;

      color.setRGB(
        Math.max(0, Math.min(1, nx)),
        Math.max(0, Math.min(1, ny)),
        Math.max(0, Math.min(1, nz))
      );
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
        size={0.15}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.8}
      />
    </points>
  );
};

const HighlightPoint = ({ point }: { point: Point3D | null }) => {
  if (!point) return null;
  const pos = getCoordinates(point);

  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.15, 16, 16]} />
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
}: {
  points: Array<Point3D>;
  selectedIndices: Array<number>;
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
            <sphereGeometry args={[0.15, 16, 16]} />
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

const CameraController = ({
  controlsRef,
  targetPoint,
}: {
  controlsRef: React.RefObject<any>;
  targetPoint: THREE.Vector3 | null;
}) => {
  const { camera } = useThree();
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const isAnimating = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) =>
      setKeys((k) => ({ ...k, [e.code]: true }));
    const handleKeyUp = (e: KeyboardEvent) =>
      setKeys((k) => ({ ...k, [e.code]: false }));
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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
    const hasInput = Object.values(keys).some((k) => k);
    if (hasInput) {
      isAnimating.current = false;
      const speed = (keys["ShiftLeft"] || keys["ShiftRight"] ? 20 : 8) * delta;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);

      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      const move = new THREE.Vector3();

      if (keys["KeyW"] || keys["ArrowUp"]) move.add(forward);
      if (keys["KeyS"] || keys["ArrowDown"]) move.sub(forward);
      if (keys["KeyA"] || keys["ArrowLeft"]) move.sub(right);
      if (keys["KeyD"] || keys["ArrowRight"]) move.add(right);

      // Q/E for vertical movement
      if (keys["KeyQ"]) move.y += 1;
      if (keys["KeyE"]) move.y -= 1;

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed);
        camera.position.add(move);
        controlsRef.current.target.add(move);
      }
    }
  });

  return null;
};

export const Umap3DExplorer = ({
  points = [],
  isLoading = false,
  error = null,
  onPointSelect,
  getImageUrl,
  className,
  count,
}: Explorer3DProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<Point3D | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Array<number>>([]);
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);
  const controlsRef = useRef<any>(null);

  const handlePointClick = (
    index: number,
    point: Point3D,
    event?: ThreeEvent<MouseEvent>
  ) => {
    // If Ctrl/Cmd click, center camera
    if (event && (event.ctrlKey || event.metaKey)) {
      const [x, y, z] = getCoordinates(point);
      const target = new THREE.Vector3(x, y, z);
      setCameraTarget(target);
      // Also select it
      setSelectedIndices([index]);
      if (onPointSelect) onPointSelect(point);
      return;
    }

    // Normal click: Select point
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
        />

        <PointCloud
          points={points}
          onHover={(_, point) => setHoveredPoint(point)}
          onClick={handlePointClick}
        />

        <HighlightPoint point={hoveredPoint} />
        <SelectedPoints points={points} selectedIndices={selectedIndices} />
      </Canvas>

      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-black/50 backdrop-blur text-white px-3 py-1 text-xs border border-white/10 rounded">
          {count ? count.toLocaleString() : points.length.toLocaleString()}{" "}
          points
        </div>
      </div>

      {/* Selected info with full image (Bottom Left) */}
      {selectedPoint && selectedIndex !== undefined && (
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
