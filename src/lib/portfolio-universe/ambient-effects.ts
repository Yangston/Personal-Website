import type { UniverseSceneId } from "./state";

export type InteractionId = "earth" | "about" | "projects";
export const NEBULA_PATCHES = [
  [0.35, 0.3, 0.18],
  [0.68, 0.26, 0.2],
  [0.78, 0.5, 0.18],
  [0.56, 0.75, 0.2],
  [0.26, 0.66, 0.18],
  [0.48, 0.44, 0.12],
] as const;
export const AMBIENT_PROFILES: Record<
  UniverseSceneId,
  { nebula: number; stars: number; dust: number }
> = {
  home: { nebula: 0.42, stars: 0.32, dust: 0.75 },
  about: { nebula: 0.52, stars: 0.12, dust: 0.18 },
  projects: { nebula: 0.14, stars: 0.5, dust: 0.3 },
  travel: { nebula: 0.12, stars: 0.12, dust: 0.055 },
};

export function easeInteraction(
  current: number,
  target: number,
  deltaMs: number,
  reduced = false,
) {
  if (reduced) return target;
  const duration = target > current ? 180 : 280;
  return (
    target +
    (current - target) * Math.exp((-Math.max(0, deltaMs) * 4) / duration)
  );
}

export function sampleNebulaPatches(
  timeMs: number,
  strength: number,
  reduced = false,
) {
  const weights = [0, 0, 0, 0, 0, 0];
  if (reduced) {
    weights[5] = strength;
    return { weights, warp: 0 };
  }
  const time = Math.max(0, timeMs) / 3600;
  const cycle = Math.floor(time),
    t = time - cycle;
  const order = [2, 4, 0, 5, 1, 3];
  weights[order[cycle % 6]] = strength * Math.cos((t * Math.PI) / 2) ** 2;
  weights[order[(cycle + 1) % 6]] = strength * Math.sin((t * Math.PI) / 2) ** 2;
  return { weights, warp: Math.min(0.01, 0.002 + strength * 0.007) };
}

const random = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
};
export type ShootingStarSample = Readonly<{
  event: number;
  progress: number;
  durationMs: number;
  x: number;
  y: number;
  direction: number;
}>;

/** Stateless schedule; event starts are 14–28 seconds apart, with no overlap. */
export function sampleShootingStar(
  timeMs: number,
  reduced = false,
): ShootingStarSample | null {
  if (reduced || timeMs < 16000) return null;
  const cycle = Math.floor((timeMs - 16000) / 21000);
  for (const event of [cycle - 1, cycle]) {
    if (event < 0) continue;
    const start = 16000 + event * 21000 + random(event + 19) * 7000;
    const durationMs = 900 + random(event + 47) * 500;
    const progress = (timeMs - start) / durationMs;
    if (progress >= 0 && progress <= 1)
      return {
        event,
        progress,
        durationMs,
        x: 0.42 + random(event + 73) * 0.36,
        y: 0.075 + random(event + 91) * 0.09,
        direction: random(event + 37) > 0.5 ? 1 : -1,
      };
  }
  return null;
}

/** Never begin a scheduled event mid-flight, including an event's remaining tail. */
export function createShootingStarGate() {
  let previous: number | null = null;
  let admitted = false;
  return (
    sample: ShootingStarSample | null,
    flight: boolean,
    pinned = false,
  ) => {
    if (!sample) {
      previous = null;
      admitted = false;
      return null;
    }
    if (sample.event !== previous || pinned) {
      previous = sample.event;
      admitted = !flight;
    }
    return admitted ? sample : null;
  };
}
