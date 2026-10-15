import type { UniverseProjection } from "./camera";

/** A centered billboard matrix, shared by inline first paint and runtime fallback. */
export function projectedArtworkTransform(
  projection: UniverseProjection,
  intrinsicWidth: number,
  intrinsicHeight: number,
  rotation = 0,
) {
  const scaleX = projection.bounds.width / intrinsicWidth;
  const scaleY = projection.bounds.height / intrinsicHeight;
  const a = Math.cos(rotation) * scaleX;
  const b = -Math.sin(rotation) * scaleX;
  const c = Math.sin(rotation) * scaleY;
  const d = Math.cos(rotation) * scaleY;
  const x = projection.x - (a * intrinsicWidth + c * intrinsicHeight) / 2;
  const y = projection.y - (b * intrinsicWidth + d * intrinsicHeight) / 2;
  return `matrix(${a},${b},${c},${d},${x},${y})`;
}
