import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Billboard,
  Image as DreiImage,
  Html,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import { Loader2 } from "lucide-react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Point3D, SearchQueryMarker } from "./types";

export interface ControlledUmap3DProps {
  points: Array<Point3D>;
  isLoading?: boolean;

  // Controlled camera
  targetPosition?: [number, number, number]; // Where camera is looking
  cameraPosition?: [number, number, number]; // Where camera is

  // Visuals
  selectedIds?: Array<string | number>;
  highlightedIds?: Array<string | number>;
  searchMarkers?: Array<SearchQueryMarker>;
  maxImages?: number;

  // Events
  onPointSelect?: (point: Point3D) => void;
  onHover?: (point: Point3D | null) => void;
  onCameraUpdate?: (data: {
    position: [number, number, number];
    target: [number, number, number];
  }) => void;

  className?: string;
}

const getCoordinates = (point: Point3D): [number, number, number] => {
  let x = point.x || 0;
  let y = point.y || 0;
  let z = point.z || 0;
  // Ensure valid numbers
  if (isNaN(x)) x = 0;
  if (isNaN(y)) y = 0;
  if (isNaN(z)) z = 0;
  return [x, y, z];
};

// Hook to manage the shared animation state for all points
const useUnifyingPointTransition = (
  points: Array<Point3D>,
  highlightedIds?: Array<string | number>,
) => {
  // We maintain persistent buffer for animation
  const currentPositionsRef = useRef<Float32Array | null>(null);
  const startPositionsRef = useRef<Float32Array | null>(null);
  const transitionProgressRef = useRef(1.0);

  // Memoize TARGET positions and colors (re-runs when points/data changes)
  const { targetPositions, colors } = useMemo(() => {
    const pos = new Float32Array(points.length * 3);
    const cols = new Float32Array(points.length * 3);
    const color = new THREE.Color();
    const highlightSet = highlightedIds ? new Set(highlightedIds) : null;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p) continue;

      const [x, y, z] = getCoordinates(p);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Color logic
      const isDimmed = highlightSet && !highlightSet.has(p.id);

      if (isDimmed) {
        color.setRGB(0.2, 0.2, 0.2); // Dark gray
      } else if (p.color && typeof p.color === "string") {
        color.set(p.color);
      } else {
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
    return { targetPositions: pos, colors: cols };
  }, [points, highlightedIds]);

  // Ensure refs are initialized immediately
  if (!currentPositionsRef.current) {
    currentPositionsRef.current = new Float32Array(targetPositions);
    startPositionsRef.current = new Float32Array(targetPositions);
  }

  // Handle Transitions when targetPositions changes
  useEffect(() => {
    if (!currentPositionsRef.current) {
      currentPositionsRef.current = new Float32Array(targetPositions);
      startPositionsRef.current = new Float32Array(targetPositions);
      transitionProgressRef.current = 1.0;
    } else if (currentPositionsRef.current.length === targetPositions.length) {
      // Snapshot current visual state as start
      startPositionsRef.current = new Float32Array(currentPositionsRef.current);
      transitionProgressRef.current = 0.0;
    } else {
      // Resize (snap)
      currentPositionsRef.current = new Float32Array(targetPositions);
      startPositionsRef.current = new Float32Array(targetPositions);
      transitionProgressRef.current = 1.0;
    }
  }, [targetPositions]);

  // Animation Loop
  useFrame((_, delta) => {
    if (
      !currentPositionsRef.current ||
      !startPositionsRef.current ||
      transitionProgressRef.current >= 1.0
    )
      return;

    transitionProgressRef.current += delta / 2.0;
    const t = Math.min(transitionProgressRef.current, 1.0);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const current = currentPositionsRef.current;
    const start = startPositionsRef.current;
    const target = targetPositions;

    for (let i = 0; i < current.length; i++) {
      current[i] = THREE.MathUtils.lerp(start[i] ?? 0, target[i] ?? 0, ease);
    }
  });

  return {
    currentPositionsRef,
    colors,
    targetPositions, // return target in case current is not ready
  };
};

const PointCloud = ({
  points,
  positionsRef,
  fallbackPositions,
  colors,
  onHover,
  onClick,
  hiddenIndices,
}: {
  points: Array<Point3D>;
  positionsRef: React.MutableRefObject<Float32Array | null>;
  fallbackPositions: Float32Array;
  colors: Float32Array;
  onHover: (index: number | null, point: Point3D | null) => void;
  onClick: (
    index: number,
    point: Point3D,
    event: ThreeEvent<MouseEvent>,
  ) => void;
  hiddenIndices?: Set<number>;
}) => {
  const meshRef = useRef<THREE.Points>(null);
  const hoverRef = useRef<number | null>(null);

  // Filter indices based on hiddenIndices
  const pointIndices = useMemo(() => {
    if (!hiddenIndices || hiddenIndices.size === 0) return null;

    const indices: Array<number> = [];
    for (let i = 0; i < points.length; i++) {
      if (!hiddenIndices.has(i)) {
        indices.push(i);
      }
    }
    return new Uint32Array(indices);
  }, [points.length, hiddenIndices]);

  // We rely on the parent's buffer.
  // We just need to mark geometry dirty every frame if animating?
  // Or just check if buffer content changed?
  // Since we are mutating the buffer in place in parent hook, we need to tell THREE to upload it.

  useFrame(() => {
    if (meshRef.current?.geometry.attributes.position) {
      meshRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const index = e.index;
    if (index !== undefined && index !== hoverRef.current) {
      hoverRef.current = index;
      if (index >= 0 && index < points.length && points[index]) {
        onHover(index, points[index]);
      }
    }
  };

  const handlePointerOut = () => {
    hoverRef.current = null;
    onHover(null, null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const index = e.index;
    if (
      index !== undefined &&
      index >= 0 &&
      index < points.length &&
      points[index]
    ) {
      onClick(index, points[index], e);
    }
  };

  const renderPositions = positionsRef.current || fallbackPositions;

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
          count={renderPositions.length / 3}
          array={renderPositions}
          itemSize={3}
          args={[renderPositions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
          args={[colors, 3]}
        />
        {pointIndices && (
          <bufferAttribute
            attach="index"
            count={pointIndices.length}
            array={pointIndices}
            itemSize={1}
            args={[pointIndices, 1]}
          />
        )}
      </bufferGeometry>
      <pointsMaterial
        size={0.2}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.8}
      />
    </points>
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
        <div className="bg-card/85 text-foreground px-2 py-1 rounded text-xs whitespace-nowrap backdrop-blur-md border border-border select-none pointer-events-none">
          {marker.label}
        </div>
      </Html>
    </group>
  );
};

const ControlledCamera = ({
  position,
  target,
  controlsRef,
}: {
  position?: [number, number, number];
  target?: [number, number, number];
  controlsRef: React.RefObject<any>;
}) => {
  const { camera } = useThree();
  const isInitialMove = useRef(true);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    const step = isInitialMove.current ? 1 : delta * 2; // Instant first move, then smooth

    if (position) {
      const currentPos = camera.position;
      const targetVec = new THREE.Vector3(...position);
      if (currentPos.distanceTo(targetVec) > 0.05) {
        currentPos.lerp(targetVec, step);
      }
    }

    if (target) {
      const currentTarget = controls.target;
      const targetVec = new THREE.Vector3(...target);
      if (currentTarget.distanceTo(targetVec) > 0.05) {
        currentTarget.lerp(targetVec, step);
        // Important: notify controls that target changed?
        // OrbitControls usually auto-updates if we change target in frame
      }
    }

    if (isInitialMove.current) isInitialMove.current = false;
  });

  return null;
};

const ImageCloud = ({
  points,
  highlightedIds,
  positionsRef,
  onHover,
  onClick,
  maxImages = 50,
}: {
  points: Array<Point3D>;
  highlightedIds?: Array<string | number>;
  positionsRef: React.MutableRefObject<Float32Array | null>;
  onHover: (point: Point3D | null) => void;
  onClick: (point: Point3D, event: any) => void;
  maxImages?: number;
}) => {
  const visiblePoints = useMemo(() => {
    // Map with original indices properly
    if (!highlightedIds) {
      return points
        .slice(0, maxImages)
        .map((p, i) => ({ ...p, originalIndex: i }));
    }
    // Expensive search? Map first then filter? Or just iterate?
    // We need original index to look up buffer
    const result: Array<Point3D & { originalIndex: number }> = [];
    for (let i = 0; i < points.length; i++) {
      // Safe access because points[i] exists in loop range
      const ptr = points[i];
      if (ptr && ptr.id && highlightedIds.includes(ptr.id)) {
        result.push({ ...ptr, originalIndex: i });
      }
      if (result.length > maxImages) break; // Hard cap for performance
    }
    return result;
  }, [points, highlightedIds, maxImages]);

  return (
    <group>
      {visiblePoints.map((p) => (
        <AnimatedBillboard
          key={p.id}
          point={p}
          globalIndex={p.originalIndex}
          positionsRef={positionsRef}
          onHover={onHover}
          onClick={onClick}
        />
      ))}
    </group>
  );
};

const AnimatedBillboard = ({
  point,
  globalIndex,
  positionsRef,
  onHover,
  onClick,
}: {
  point: Point3D;
  globalIndex: number;
  positionsRef: React.MutableRefObject<Float32Array | null>;
  onHover: (point: Point3D | null) => void;
  onClick: (point: Point3D, event: any) => void;
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // We simply read from the parent buffer every frame
  useFrame(() => {
    if (!groupRef.current || !positionsRef.current) return;

    const buffer = positionsRef.current;

    // Safety check buffer bounds
    if (globalIndex * 3 + 2 < buffer.length) {
      const x = buffer[globalIndex * 3] ?? 0;
      const y = buffer[globalIndex * 3 + 1] ?? 0;
      const z = buffer[globalIndex * 3 + 2] ?? 0;
      groupRef.current.position.set(x, y, z);
    }
  });

  if (!point.thumb) return null;

  // Initial render might be off for 1 frame if we don't set it,
  // but useFrame runs before painting usually.
  // We can default to the point's data if buffer not ready
  const defaultPos = getCoordinates(point);

  return (
    <group ref={groupRef} position={defaultPos}>
      <Billboard>
        <DreiImage
          url={point.thumb}
          scale={2}
          transparent
          opacity={1}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(point);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onHover(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick(point, e);
          }}
        />
      </Billboard>
    </group>
  );
};

const SceneContent = ({
  points,
  highlightedIds,
  selectedIds,
  searchMarkers,
  renderImageMode,
  cameraPosition,
  targetPosition,
  onPointSelect,
  onHover,
  onCameraUpdate,
  maxImages,
}: ControlledUmap3DProps & { renderImageMode?: boolean }) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Unified animation hook - MUST be inside Canvas
  const { currentPositionsRef, colors, targetPositions } =
    useUnifyingPointTransition(points, highlightedIds);

  useEffect(() => {
    if (onCameraUpdate && controlsRef.current) {
      const target = controlsRef.current.target;
      onCameraUpdate({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [target.x, target.y, target.z],
      });
    }
  }, [onCameraUpdate, camera, controlsRef]); // Trigger when callback becomes available

  const handleCameraChange = (e: any) => {
    if (onCameraUpdate && e.target && e.target.object) {
      const pos = e.target.object.position;
      const target = e.target.target;
      onCameraUpdate({
        position: [pos.x, pos.y, pos.z],
        target: [target.x, target.y, target.z],
      });
    }
  };

  // Determine which images are visible to hide their corresponding points
  const visibleImageIndices = useMemo(() => {
    if (!renderImageMode) return new Set<number>();

    const set = new Set<number>();

    // Logic matches ImageCloud's visiblePoints calculation
    if (!highlightedIds) {
      const limit = Math.min(points.length, maxImages || 50);
      for (let i = 0; i < limit; i++) {
        set.add(i);
      }
    } else {
      // Assume highlightedIds creates a subset; we need to find their original indices
      // This is slightly inefficient O(N^2) if not optimized, but highlightedIds is usually small
      // Optimization: Create map of ID -> Index or just iterate once
      let found = 0;
      const limit = maxImages || 50;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p && highlightedIds.includes(p.id)) {
          set.add(i);
          found++;
          if (found >= limit) break;
        }
      }
    }
    return set;
  }, [points, highlightedIds, maxImages, renderImageMode]);

  return (
    <>
      <fog attach="fog" args={["#000000", 5, 60]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        autoRotate={false}
        onChange={onCameraUpdate ? handleCameraChange : undefined}
      />

      <ControlledCamera
        controlsRef={controlsRef}
        position={cameraPosition}
        target={targetPosition}
      />

      <PointCloud
        points={points}
        positionsRef={currentPositionsRef}
        fallbackPositions={targetPositions}
        colors={colors}
        onHover={(_, p) => onHover?.(p)}
        onClick={(_, p) => onPointSelect?.(p)}
        hiddenIndices={visibleImageIndices}
      />

      {renderImageMode && (
        <ImageCloud
          points={points}
          highlightedIds={highlightedIds}
          positionsRef={currentPositionsRef}
          onHover={(p) => onHover?.(p)}
          onClick={(p, e) => onPointSelect?.(p)}
          maxImages={maxImages}
        />
      )}

      {searchMarkers?.map((m, i) => (
        <QueryMarker key={i} marker={m} />
      ))}

      {selectedIds?.map((id) => {
        const p = points.find((pt) => pt.id === id);
        if (!p) return null;
        const coords = getCoordinates(p);
        return (
          <mesh key={id} position={coords}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color={p.color || "#ffffff"} wireframe />
          </mesh>
        );
      })}
    </>
  );
};

export const ControlledUmap3D = (
  props: ControlledUmap3DProps & { renderImageMode?: boolean },
) => {
  if (props.isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-muted/10">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full bg-card relative overflow-hidden ${
        props.className || ""
      }`}
    >
      <Canvas
        camera={{ position: [0, 0, 15], fov: 50 }}
        raycaster={{ params: { Points: { threshold: 0.2 } } as any }}
      >
        <SceneContent {...props} />
      </Canvas>

      <div className="absolute bottom-4 right-4 pointer-events-none text-[10px] text-muted-foreground">
        Interactive Embeddr Space
      </div>
    </div>
  );
};
