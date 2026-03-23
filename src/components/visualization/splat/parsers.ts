/**
 * Parsers for common 3D Gaussian Splat file formats.
 *
 * Supported:
 *   - .ply   (standard PLY with gaussian attributes from 3DGS training)
 *   - .splat (antimatter15 compressed binary format)
 *
 * Both produce a common `SplatData` structure consumed by the viewer.
 */

import type { SplatData, SplatBounds, SplatStats } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

export function computeBounds(
  positions: Float32Array,
  count: number,
): SplatBounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3]!;
    const y = positions[i * 3 + 1]!;
    const z = positions[i * 3 + 2]!;
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }

  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];

  const dx = max[0] - min[0];
  const dy = max[1] - min[1];
  const dz = max[2] - min[2];
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;

  return { min, max, center, radius };
}

function computeStats(
  data: SplatData,
  bounds: SplatBounds,
  format: "ply" | "splat" | "unknown",
): SplatStats {
  let hasAlpha = false;
  for (let i = 0; i < data.count; i++) {
    if (data.colors[i * 4 + 3]! < 0.999) {
      hasAlpha = true;
      break;
    }
  }
  return {
    pointCount: data.count,
    bounds,
    format,
    hasAlpha,
    hasScales: data.scales.length > 0,
    hasRotations: data.rotations.length > 0,
    hasSH: !!data.sphericalHarmonics && data.sphericalHarmonics.length > 0,
  };
}

// ── PLY Parser ───────────────────────────────────────────────────────────────

function parsePLY(buffer: ArrayBuffer): { data: SplatData; stats: SplatStats } {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const headerStr = decoder.decode(
    bytes.subarray(0, Math.min(bytes.length, 8192)),
  );
  const endHeaderIdx = headerStr.indexOf("end_header\n");
  if (endHeaderIdx === -1) throw new Error("Invalid PLY: no end_header found");
  const headerEnd = endHeaderIdx + "end_header\n".length;

  const headerLines = headerStr.substring(0, endHeaderIdx).split("\n");
  let vertexCount = 0;
  const properties: Array<{ name: string; type: string }> = [];
  let inVertex = false;

  for (const line of headerLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("element vertex")) {
      vertexCount = parseInt(trimmed.split(/\s+/)[2] ?? "0", 10);
      inVertex = true;
    } else if (trimmed.startsWith("element")) {
      inVertex = false;
    } else if (inVertex && trimmed.startsWith("property")) {
      const parts = trimmed.split(/\s+/);
      properties.push({ type: parts[1] ?? "float", name: parts[2] ?? "" });
    }
  }

  if (vertexCount === 0) throw new Error("PLY has no vertices");

  const propMap = new Map<string, number>();
  properties.forEach((p, i) => propMap.set(p.name, i));

  const typeSize = (t: string): number => {
    switch (t) {
      case "float":
      case "float32":
      case "int":
      case "int32":
      case "uint":
      case "uint32":
        return 4;
      case "double":
      case "float64":
        return 8;
      case "short":
      case "int16":
      case "uint16":
      case "ushort":
        return 2;
      case "char":
      case "uchar":
      case "int8":
      case "uint8":
        return 1;
      default:
        return 4;
    }
  };

  const offsets: number[] = [];
  let stride = 0;
  for (const prop of properties) {
    offsets.push(stride);
    stride += typeSize(prop.type);
  }

  const dataView = new DataView(buffer, headerEnd);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 4);
  const scales = new Float32Array(vertexCount * 3);
  const rotations = new Float32Array(vertexCount * 4);

  const hasXYZ = propMap.has("x") && propMap.has("y") && propMap.has("z");
  const hasDC =
    propMap.has("f_dc_0") && propMap.has("f_dc_1") && propMap.has("f_dc_2");
  const hasRGB =
    propMap.has("red") && propMap.has("green") && propMap.has("blue");
  const hasOpacity = propMap.has("opacity");
  const hasScale =
    propMap.has("scale_0") && propMap.has("scale_1") && propMap.has("scale_2");
  const hasRot =
    propMap.has("rot_0") &&
    propMap.has("rot_1") &&
    propMap.has("rot_2") &&
    propMap.has("rot_3");

  let shRestCount = 0;
  while (propMap.has(`f_rest_${shRestCount}`)) shRestCount++;
  const shDegree =
    shRestCount > 0 ? (shRestCount >= 45 ? 3 : shRestCount >= 15 ? 2 : 1) : 0;
  const shData =
    shRestCount > 0 ? new Float32Array(vertexCount * shRestCount) : undefined;

  const readFloat = (vertexIdx: number, propIdx: number): number => {
    const byteOffset = vertexIdx * stride + offsets[propIdx]!;
    const ptype = properties[propIdx]!.type;
    switch (ptype) {
      case "float":
      case "float32":
        return dataView.getFloat32(byteOffset, true);
      case "double":
      case "float64":
        return dataView.getFloat64(byteOffset, true);
      case "uchar":
      case "uint8":
        return dataView.getUint8(byteOffset);
      case "char":
      case "int8":
        return dataView.getInt8(byteOffset);
      case "short":
      case "int16":
        return dataView.getInt16(byteOffset, true);
      case "ushort":
      case "uint16":
        return dataView.getUint16(byteOffset, true);
      case "int":
      case "int32":
        return dataView.getInt32(byteOffset, true);
      case "uint":
      case "uint32":
        return dataView.getUint32(byteOffset, true);
      default:
        return dataView.getFloat32(byteOffset, true);
    }
  };

  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

  for (let i = 0; i < vertexCount; i++) {
    if (hasXYZ) {
      positions[i * 3] = readFloat(i, propMap.get("x")!);
      positions[i * 3 + 1] = readFloat(i, propMap.get("y")!);
      positions[i * 3 + 2] = readFloat(i, propMap.get("z")!);
    }

    if (hasDC) {
      const SH_C0 = 0.28209479177387814;
      colors[i * 4] = Math.max(
        0,
        Math.min(1, 0.5 + SH_C0 * readFloat(i, propMap.get("f_dc_0")!)),
      );
      colors[i * 4 + 1] = Math.max(
        0,
        Math.min(1, 0.5 + SH_C0 * readFloat(i, propMap.get("f_dc_1")!)),
      );
      colors[i * 4 + 2] = Math.max(
        0,
        Math.min(1, 0.5 + SH_C0 * readFloat(i, propMap.get("f_dc_2")!)),
      );
    } else if (hasRGB) {
      const rIdx = propMap.get("red")!;
      const gIdx = propMap.get("green")!;
      const bIdx = propMap.get("blue")!;
      const rVal = readFloat(i, rIdx);
      const gVal = readFloat(i, gIdx);
      const bVal = readFloat(i, bIdx);
      const isUchar =
        properties[rIdx]!.type === "uchar" ||
        properties[rIdx]!.type === "uint8";
      const div = isUchar ? 255 : 1;
      colors[i * 4] = rVal / div;
      colors[i * 4 + 1] = gVal / div;
      colors[i * 4 + 2] = bVal / div;
    } else {
      colors[i * 4] = 1;
      colors[i * 4 + 1] = 1;
      colors[i * 4 + 2] = 1;
    }

    colors[i * 4 + 3] = hasOpacity
      ? sigmoid(readFloat(i, propMap.get("opacity")!))
      : 1.0;

    if (hasScale) {
      scales[i * 3] = Math.exp(readFloat(i, propMap.get("scale_0")!));
      scales[i * 3 + 1] = Math.exp(readFloat(i, propMap.get("scale_1")!));
      scales[i * 3 + 2] = Math.exp(readFloat(i, propMap.get("scale_2")!));
    }

    if (hasRot) {
      rotations[i * 4] = readFloat(i, propMap.get("rot_0")!);
      rotations[i * 4 + 1] = readFloat(i, propMap.get("rot_1")!);
      rotations[i * 4 + 2] = readFloat(i, propMap.get("rot_2")!);
      rotations[i * 4 + 3] = readFloat(i, propMap.get("rot_3")!);
      const len = Math.sqrt(
        rotations[i * 4]! ** 2 +
          rotations[i * 4 + 1]! ** 2 +
          rotations[i * 4 + 2]! ** 2 +
          rotations[i * 4 + 3]! ** 2,
      );
      if (len > 0) {
        rotations[i * 4] = rotations[i * 4]! / len;
        rotations[i * 4 + 1] = rotations[i * 4 + 1]! / len;
        rotations[i * 4 + 2] = rotations[i * 4 + 2]! / len;
        rotations[i * 4 + 3] = rotations[i * 4 + 3]! / len;
      }
    }

    if (shData) {
      for (let j = 0; j < shRestCount; j++) {
        shData[i * shRestCount + j] = readFloat(i, propMap.get(`f_rest_${j}`)!);
      }
    }
  }

  const splatData: SplatData = {
    count: vertexCount,
    positions,
    colors,
    scales,
    rotations,
    sphericalHarmonics: shData,
    shDegree,
  };

  const bounds = computeBounds(positions, vertexCount);
  const stats = computeStats(splatData, bounds, "ply");
  return { data: splatData, stats };
}

// ── .splat binary parser ─────────────────────────────────────────────────────

function parseSplat(buffer: ArrayBuffer): {
  data: SplatData;
  stats: SplatStats;
} {
  const BYTES_PER_SPLAT = 32;
  const count = Math.floor(buffer.byteLength / BYTES_PER_SPLAT);
  if (count === 0) throw new Error("Empty or invalid .splat file");

  const dv = new DataView(buffer);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const off = i * BYTES_PER_SPLAT;
    positions[i * 3] = dv.getFloat32(off, true);
    positions[i * 3 + 1] = dv.getFloat32(off + 4, true);
    positions[i * 3 + 2] = dv.getFloat32(off + 8, true);

    scales[i * 3] = dv.getFloat32(off + 12, true);
    scales[i * 3 + 1] = dv.getFloat32(off + 16, true);
    scales[i * 3 + 2] = dv.getFloat32(off + 20, true);

    colors[i * 4] = dv.getUint8(off + 24) / 255;
    colors[i * 4 + 1] = dv.getUint8(off + 25) / 255;
    colors[i * 4 + 2] = dv.getUint8(off + 26) / 255;
    colors[i * 4 + 3] = dv.getUint8(off + 27) / 255;

    const qx = (dv.getUint8(off + 28) - 128) / 128;
    const qy = (dv.getUint8(off + 29) - 128) / 128;
    const qz = (dv.getUint8(off + 30) - 128) / 128;
    const qw = (dv.getUint8(off + 31) - 128) / 128;
    const len = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
    rotations[i * 4] = len > 0 ? qx / len : 0;
    rotations[i * 4 + 1] = len > 0 ? qy / len : 0;
    rotations[i * 4 + 2] = len > 0 ? qz / len : 0;
    rotations[i * 4 + 3] = len > 0 ? qw / len : 1;
  }

  const splatData: SplatData = {
    count,
    positions,
    colors,
    scales,
    rotations,
  };

  const bounds = computeBounds(positions, count);
  const stats = computeStats(splatData, bounds, "splat");
  return { data: splatData, stats };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Auto-detect format and parse a splat file from an ArrayBuffer.
 */
export function parseSplatFile(
  buffer: ArrayBuffer,
  filename?: string,
): { data: SplatData; stats: SplatStats } {
  const ext = filename?.split(".").pop()?.toLowerCase();

  if (ext === "splat") return parseSplat(buffer);

  const header = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  const magic = String.fromCharCode(...header);
  if (magic.startsWith("ply")) return parsePLY(buffer);

  if (buffer.byteLength % 32 === 0 && buffer.byteLength > 0) {
    return parseSplat(buffer);
  }

  throw new Error(
    `Unsupported splat format. Expected .ply or .splat file (got ${ext ?? "unknown"})`,
  );
}
