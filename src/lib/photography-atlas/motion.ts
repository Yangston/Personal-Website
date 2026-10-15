/** Shared by the canvas fallback and persistent Earth renderer. */
export const ATLAS_SPIN_DEGREES_PER_SECOND = 3;
export function createAtlasSpin() {
  return {
    advance(_time: number, elapsed: number, paused: boolean) {
      return paused
        ? 0
        : (Math.max(0, elapsed) / 1_000) * ATLAS_SPIN_DEGREES_PER_SECOND;
    },
  };
}

/** Linear weights interrupt continuously and ease perceptually in the shader. */
export function advanceCountryEmphasis(
  value: number,
  selected: boolean,
  elapsed: number,
  reducedMotion: boolean,
) {
  if (reducedMotion) return selected ? 1 : 0;
  return selected
    ? Math.min(1, value + Math.max(0, elapsed) / 180)
    : Math.max(0, value - Math.max(0, elapsed) / 140);
}

export function atlasAnchorOpacity(
  facing: number,
  point: readonly [number, number] | null,
  width: number,
  height: number,
) {
  if (
    !point ||
    !Number.isFinite(facing) ||
    facing <= 0 ||
    !point.every(Number.isFinite) ||
    point[0] < 0 ||
    point[0] > width ||
    point[1] < 0 ||
    point[1] > height
  )
    return 0;
  const t = Math.min(1, facing / 0.16);
  return t * t * (3 - 2 * t);
}

export function coordinateFacing(
  coordinate: readonly [number, number],
  rotation: readonly [number, number],
) {
  const radians = Math.PI / 180;
  const latitude = coordinate[1] * radians;
  const centerLatitude = -rotation[1] * radians;
  return (
    Math.sin(latitude) * Math.sin(centerLatitude) +
    Math.cos(latitude) *
      Math.cos(centerLatitude) *
      Math.cos((coordinate[0] + rotation[0]) * radians)
  );
}
