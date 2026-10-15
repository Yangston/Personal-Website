import type { WorldPlane } from "./scene-manifest";
import type { UniverseSceneId } from "./state";

export function worldPlateOpacity(
  plane: WorldPlane,
  sceneWeights: Readonly<Record<UniverseSceneId, number>>,
  cameraDepth = Infinity,
) {
  const near = Math.max(0, Math.min(1, (cameraDepth - 5) / 19));
  const nearOpacity =
    plane.approach || plane.projectCloud ? near * near * (3 - 2 * near) : 1;
  if (plane.projectCloud?.transitOnly) {
    // Introduce each transit veil as the camera approaches its depth, rather
    // than revealing all six distant layers over the intact Home composition.
    const approach = Math.max(0, Math.min(1, (64 - cameraDepth) / 24));
    const approachOpacity = approach * approach * (3 - 2 * approach);
    return (
      plane.opacity *
      nearOpacity *
      approachOpacity *
      Math.min(1, 5 * sceneWeights.home * sceneWeights.projects)
    );
  }
  if (plane.approach)
    return (
      plane.opacity *
      nearOpacity *
      Math.min(1, 5 * sceneWeights.home * sceneWeights.about)
    );
  const opacityWeight = Object.entries(sceneWeights).reduce(
    (total, [scene, weight]) =>
      total + weight * (plane.sceneOpacity?.[scene as UniverseSceneId] ?? 1),
    0,
  );
  return plane.opacity * nearOpacity * Math.max(0, Math.min(1, opacityWeight));
}

/** Pure projection inputs, shared with the pre-WebGL DOM composition. */
export function sampleWorldPlate(
  plane: WorldPlane,
  timeMs: number,
  aboutWeight = 0,
) {
  const { drift } = plane;
  const seconds =
    (Math.max(0, timeMs) / 1_000) *
    (plane.id === "nebula" ? 1 - aboutWeight : 1);
  const phase = drift.phase;
  const elapsed = seconds * drift.speed;
  return {
    position: {
      x:
        plane.position.x +
        (Math.sin(phase + elapsed) - Math.sin(phase)) * drift.x,
      y:
        plane.position.y +
        (Math.cos(phase + elapsed * 0.73) - Math.cos(phase)) * drift.y,
      z: plane.position.z,
    },
    rotation:
      plane.rotation +
      (Math.sin(phase + elapsed * 0.61) - Math.sin(phase)) * drift.rotation,
  };
}

export function selectWorldPlates(
  planes: readonly WorldPlane[],
  width: number,
) {
  return planes.filter((plane) => width > 700 || plane.mobile);
}

export function translucentRenderOrder(cameraDepth: number, tieBreak = 0) {
  return -cameraDepth + tieBreak * 0.00001;
}

/** Exact overlap for a camera-facing, rotated plate and the viewport at its depth. */
export function billboardIntersectsView(
  plate: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>,
  view: Readonly<{ width: number; height: number }>,
) {
  const cosine = Math.cos(plate.rotation);
  const sine = Math.sin(plate.rotation);
  const c = Math.abs(cosine);
  const s = Math.abs(sine);
  const x = plate.width / 2;
  const y = plate.height / 2;
  const vx = view.width / 2;
  const vy = view.height / 2;
  return (
    Math.abs(plate.x) <= vx + x * c + y * s &&
    Math.abs(plate.y) <= vy + x * s + y * c &&
    Math.abs(plate.x * cosine + plate.y * sine) <= x + vx * c + vy * s &&
    Math.abs(-plate.x * sine + plate.y * cosine) <= y + vx * s + vy * c
  );
}
