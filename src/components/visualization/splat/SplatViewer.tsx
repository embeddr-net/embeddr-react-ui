/**
 * SplatViewer — shared R3F-based 3D Gaussian Splat viewer.
 *
 * Lives in @embeddr/react-ui so it's bundled with the host app.
 * Plugins import it via `@embeddr/react-ui/components/visualization`
 * and never touch @react-three/fiber directly (avoiding the
 * dual-React-reconciler UMD crash).
 *
 * Architecture follows Umap3DExplorer:
 *   <Canvas>  →  <SplatScene>  →  <GaussianCloud> + <FlyCamera> + <OrbitControls>
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { SplatData, SplatBounds, SplatViewerConfig } from "./types";
import { DEFAULT_SPLAT_VIEWER_CONFIG } from "./types";

// ── Gaussian Point Cloud ─────────────────────────────────────────────────────

const VERTEX_SHADER = `
  attribute float alpha;
  attribute float size;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uPointSize;
  uniform float uOpacity;

  void main() {
    vColor = color;
    vAlpha = alpha * uOpacity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float dist = -mvPosition.z;
    gl_PointSize = uPointSize * size * (300.0 / max(dist, 0.1));
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
  }
`;

const FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float r = length(coord);
    if (r > 0.5) discard;

    float falloff = exp(-8.0 * r * r);
    gl_FragColor = vec4(vColor, vAlpha * falloff);
  }
`;

interface GaussianCloudProps {
  data: SplatData;
  config: SplatViewerConfig;
}

function GaussianCloud({ data, config }: GaussianCloudProps) {
  const { geometry, material } = useMemo(() => {
    const count = Math.min(data.count, config.renderLimit);

    const geo = new THREE.BufferGeometry();
    const posArr =
      count < data.count ? data.positions.slice(0, count * 3) : data.positions;
    geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));

    const colorArr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colorArr[i * 3] = data.colors[i * 4]!;
      colorArr[i * 3 + 1] = data.colors[i * 4 + 1]!;
      colorArr[i * 3 + 2] = data.colors[i * 4 + 2]!;
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colorArr, 3));

    const alphaArr = new Float32Array(count);
    const sizeArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      alphaArr[i] = data.colors[i * 4 + 3]!;
      if (data.scales.length > 0) {
        const sx = data.scales[i * 3]!;
        const sy = data.scales[i * 3 + 1]!;
        const sz = data.scales[i * 3 + 2]!;
        sizeArr[i] = (sx + sy + sz) / 3;
      } else {
        sizeArr[i] = 1.0;
      }
    }
    geo.setAttribute("alpha", new THREE.Float32BufferAttribute(alphaArr, 1));
    geo.setAttribute("size", new THREE.Float32BufferAttribute(sizeArr, 1));
    geo.computeBoundingSphere();

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uPointSize: { value: config.pointSize * 2.0 },
        uOpacity: { value: config.opacity },
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, [data, config.renderLimit]);

  // Keep uniforms in sync with config changes
  useFrame(() => {
    if (material instanceof THREE.ShaderMaterial) {
      material.uniforms.uPointSize!.value = config.pointSize * 2.0;
      material.uniforms.uOpacity!.value = config.opacity;
    }
  });

  return <points geometry={geometry} material={material} />;
}

// ── Fly Camera ───────────────────────────────────────────────────────────────

interface FlyCameraProps {
  speed: number;
  controlsRef: React.RefObject<any>;
}

/**
 * WASD + QE fly-around controller.
 * Moves both camera.position AND controls.target so it cooperates
 * with OrbitControls — same pattern as Umap3DExplorer CameraController.
 */
function FlyCamera({ speed, controlsRef }: FlyCameraProps) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase());
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  useFrame((_, delta) => {
    const k = keys.current;
    if (k.size === 0 && velocity.current.length() < 0.0001) return;

    const dir = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    camera.getWorldDirection(dir);
    right.crossVectors(dir, up).normalize();

    const accel = speed * delta * 60;
    const targetVel = new THREE.Vector3();
    if (k.has("w")) targetVel.add(dir.clone().multiplyScalar(accel));
    if (k.has("s")) targetVel.add(dir.clone().multiplyScalar(-accel));
    if (k.has("a")) targetVel.add(right.clone().multiplyScalar(-accel));
    if (k.has("d")) targetVel.add(right.clone().multiplyScalar(accel));
    if (k.has("q") || k.has(" ")) targetVel.y += accel;
    if (k.has("e") || k.has("shift")) targetVel.y -= accel;

    velocity.current.lerp(targetVel, 0.15);
    if (velocity.current.length() > 0.0001) {
      const move = velocity.current.clone().multiplyScalar(delta);
      camera.position.add(move);
      // Move orbit target too so we don't fight controls
      const controls = controlsRef.current;
      if (controls?.target) {
        controls.target.add(move);
      }
    }
  });

  return null;
}

// ── Bounds Box Helper ────────────────────────────────────────────────────────

function BoundsBox({ bounds }: { bounds: SplatBounds }) {
  const size = useMemo(
    () =>
      [
        bounds.max[0] - bounds.min[0],
        bounds.max[1] - bounds.min[1],
        bounds.max[2] - bounds.min[2],
      ] as [number, number, number],
    [bounds],
  );
  return (
    <mesh position={bounds.center}>
      <boxGeometry args={size} />
      <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.15} />
    </mesh>
  );
}

// ── Scene (inside Canvas) ────────────────────────────────────────────────────

interface SplatSceneProps {
  data: SplatData;
  bounds: SplatBounds;
  config: SplatViewerConfig;
}

function SplatScene({ data, bounds, config }: SplatSceneProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const initialised = useRef(false);

  // Auto-centre camera on first mount
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const [cx, cy, cz] = bounds.center;
    const dist = bounds.radius * 2.5;
    camera.position.set(cx + dist * 0.5, cy + dist * 0.3, cz + dist);
    camera.lookAt(cx, cy, cz);
  }, [bounds, camera]);

  return (
    <>
      <fog
        attach="fog"
        args={[config.backgroundColor, bounds.radius * 0.5, bounds.radius * 6]}
      />
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />

      <GaussianCloud data={data} config={config} />

      {config.showAxes && <axesHelper args={[5]} />}
      {config.showBounds && <BoundsBox bounds={bounds} />}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={0.1}
        maxDistance={bounds.radius * 10}
        target={bounds.center}
      />

      <FlyCamera speed={config.flySpeed} controlsRef={controlsRef} />
    </>
  );
}

// ── Public Component ─────────────────────────────────────────────────────────

export interface SplatViewerProps {
  /** Parsed point cloud data */
  data: SplatData;
  /** Bounding box of the cloud */
  bounds: SplatBounds;
  /** Optional partial config overrides */
  config?: Partial<SplatViewerConfig>;
  /** CSS class */
  className?: string;
}

/**
 * Full 3D Gaussian Splat viewer with orbit + fly controls.
 *
 * Import from `@embeddr/react-ui/components/visualization`:
 * ```tsx
 * import { SplatViewer } from "@embeddr/react-ui/components/visualization";
 * ```
 */
export function SplatViewer({
  data,
  bounds,
  config: configOverrides,
  className,
}: SplatViewerProps) {
  const config = useMemo(
    () => ({ ...DEFAULT_SPLAT_VIEWER_CONFIG, ...configOverrides }),
    [configOverrides],
  );

  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 60, near: 0.01, far: 10000 }}
      style={{ background: config.backgroundColor }}
      className={className}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
    >
      <SplatScene data={data} bounds={bounds} config={config} />
    </Canvas>
  );
}
