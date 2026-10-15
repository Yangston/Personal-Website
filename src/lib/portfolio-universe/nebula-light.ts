import { NEBULA_INTEREST_REGIONS } from "./nebula-regions";

export const NEBULA_SWIRL_CENTERS = [
  [0.18, 0.46],
  [0.79, 0.59],
  [0.49, 0.88],
] as const;
export const NEBULA_SWIRL_LIMIT = 0.004;
// Apply the same display-space grade to the shader and its HTML texture crops.
export const NEBULA_GRADE = {
  contrast: 1.3,
  saturation: 1.2,
  brightness: 0.82,
};
export const NEBULA_GRADE_FILTER = `brightness(${NEBULA_GRADE.brightness}) contrast(${NEBULA_GRADE.contrast}) saturate(${NEBULA_GRADE.saturation})`;
export const NEBULA_SWIRL_EXCLUSIONS = NEBULA_INTEREST_REGIONS.map(
  ({ bounds: b }) => [b.x, b.y, b.x + b.width, b.y + b.height] as const,
);

export function sampleNebulaSwirls(timeMs: number, stationary = false) {
  return NEBULA_SWIRL_CENTERS.map(([x, y], i) => {
    const angle =
      (Math.max(0, timeMs) / (18000 + i * 6000)) * Math.PI * 2 + i * 2.1;
    const radius = stationary ? 0 : NEBULA_SWIRL_LIMIT;
    return { x, y, dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
  });
}

/** Local curl, mirrored in the shader; opposite sides move in opposite directions. */
export function sampleNebulaSwirlOffset(
  x: number,
  y: number,
  timeMs: number,
  stationary = false,
) {
  let dx = 0,
    dy = 0,
    total = 0;
  for (const swirl of sampleNebulaSwirls(timeMs, stationary)) {
    const px = x - swirl.x,
      py = y - swirl.y;
    const radius = Math.hypot(px, py);
    const weight = Math.exp(-(radius * radius) / 0.025);
    const curl = swirl.dx + swirl.dy * 0.35;
    const scale = (weight * curl) / Math.max(0.06, radius);
    dx -= py * scale;
    dy += px * scale;
    total += weight;
  }
  const envelope = nebulaSwirlEnvelope(x, y);
  const scale =
    envelope / Math.max(1, total, Math.hypot(dx, dy) / NEBULA_SWIRL_LIMIT);
  return { x: dx * scale, y: dy * scale };
}

/** Mirrors the shader's protected rectangles, with a soft outer boundary. */
export function nebulaSwirlEnvelope(x: number, y: number) {
  let distance = Math.hypot(x - 0.465, y - 0.435) - 0.13;
  for (const [left, top, right, bottom] of NEBULA_SWIRL_EXCLUSIONS) {
    distance = Math.min(
      distance,
      Math.hypot(
        Math.max(left - x, 0, x - right),
        Math.max(top - y, 0, y - bottom),
      ),
    );
  }
  const t = Math.max(0, Math.min(1, distance / 0.035));
  return t * t * (3 - 2 * t);
}

/** Shared-clock samples; hover changes energy, never the path or its phase. */
export function sampleCloudLight(
  timeMs: number,
  index: number,
  emphasis: number,
  stationary = false,
) {
  const phase = index * 2.17;
  const angle =
    (stationary ? 0 : Math.max(0, timeMs) / (18000 + index * 5000)) *
      Math.PI *
      2 +
    phase;
  // Follow the three authored folds: rising left arm, descending right arm,
  // and the broad lower curl. Keep the spill on the same ridge as the core.
  const slope = [-18, 18, -8][index] ?? -8;
  const ridge = (a: number) => ({
    x: 50 + Math.sin(a) * 23,
    y: (index === 2 ? 55 : 50) + Math.sin(a) * slope + Math.sin(a * 2) * 2,
  });
  const core = ridge(angle);
  const spill = ridge(angle + 0.65);
  return {
    ...core,
    spillX: spill.x,
    spillY: spill.y,
    intensity: 0.3 * (1 + Math.max(0, Math.min(1, emphasis))),
  };
}

export function easeCloudLight(
  current: number,
  target: number,
  deltaMs: number,
) {
  const duration = target > current ? 180 : 300;
  return (
    target +
    (current - target) * Math.exp((-Math.max(0, deltaMs) * 4) / duration)
  );
}
