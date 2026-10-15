export type ConstellationPoint = readonly [x: number, y: number];
export type ConstellationEdge = readonly [from: number, to: number];

export type ConstellationPosition = Readonly<{
  x: number;
  y: number;
  size: number;
}>;

export type Vector3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type ProjectConstellationVisual = Readonly<{
  motif: string;
  hoverMotion: "trace" | "wave" | "cards";
  points: readonly ConstellationPoint[];
  edges: readonly ConstellationEdge[];
  accent: string;
  worldOffset: Vector3;
  depth: number;
  position: ConstellationPosition;
  mobilePosition: ConstellationPosition;
  rotation: number;
  drawDelayMs: number;
}>;

export type ProjectConstellationManifestItem = Readonly<{
  id: string;
  motif: string;
  hoverMotion: "trace" | "wave" | "cards";
  points: readonly ConstellationPoint[];
  edges: readonly ConstellationEdge[];
  accent: string;
  worldOffset: Vector3;
  depth: number;
}>;

export type ProjectConstellationManifest =
  readonly ProjectConstellationManifestItem[];

/** The same immutable world vertices feed the renderer and first-paint HTML. */
export function createProjectConstellationWorldPoints(
  visual: Pick<ProjectConstellationVisual, "points" | "worldOffset" | "depth">,
  origin: Vector3,
): readonly Vector3[] {
  return visual.points.map(([x, y]) => ({
    x: origin.x + visual.worldOffset.x * 2.2 + ((x - 120) / 34) * 1.45,
    y: origin.y + visual.worldOffset.y * 1.5 + ((80 - y) / 34) * 1.45,
    z: origin.z + visual.worldOffset.z + visual.depth / 95,
  }));
}

export type ProjectTitleTiming = Readonly<{
  characterCount: number;
  delayMs: number;
  durationMs: number;
}>;

export const PROJECT_TITLE_CHARACTER_MS = 45;
export const PROJECT_TITLE_GAP_MS = 180;

export function createProjectTitleTimings(
  titles: readonly string[],
): readonly ProjectTitleTiming[] {
  let elapsedMs = 0;
  return titles.map((title) => {
    const characterCount = Math.max(1, Array.from(title).length);
    const durationMs = characterCount * PROJECT_TITLE_CHARACTER_MS;
    const timing = {
      characterCount,
      delayMs: elapsedMs,
      durationMs,
    };
    elapsedMs += durationMs + PROJECT_TITLE_GAP_MS;
    return timing;
  });
}

export const PROJECT_CONSTELLATION_VISUALS = {
  sightline: {
    motif: "spatial sightline",
    hoverMotion: "trace",
    points: [
      [22, 112],
      [54, 86],
      [88, 96],
      [116, 54],
      [148, 76],
      [178, 38],
      [214, 62],
      [194, 112],
      [146, 128],
      [102, 120],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 2],
      [3, 8],
    ],
    accent: "#ef4529",
    worldOffset: { x: 1.4, y: 2.8, z: 0 },
    depth: 96,
    position: { x: 74, y: 22, size: 26 },
    mobilePosition: { x: 65, y: 40, size: 46 },
    rotation: -4,
    drawDelayMs: 110,
  },
  "sleep-wake-model": {
    motif: "sleep signal",
    hoverMotion: "wave",
    points: [
      [24, 92],
      [54, 90],
      [78, 48],
      [108, 126],
      [136, 66],
      [164, 94],
      [196, 88],
      [218, 90],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
    ],
    accent: "#6e78a8",
    worldOffset: { x: -2.8, y: -2.2, z: -2.8 },
    depth: -112,
    position: { x: 47, y: 68, size: 18 },
    mobilePosition: { x: 27, y: 62, size: 34 },
    rotation: 6,
    drawDelayMs: 260,
  },
  "robotic-card-thrower": {
    motif: "poker dealer",
    hoverMotion: "cards",
    points: [
      [28, 46],
      [56, 34],
      [68, 78],
      [40, 88],
      [98, 20],
      [130, 20],
      [130, 68],
      [98, 68],
      [174, 40],
      [206, 54],
      [190, 96],
      [158, 82],
      [116, 132],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [8, 9],
      [9, 10],
      [10, 11],
      [11, 8],
      [12, 2],
      [12, 6],
      [12, 11],
    ],
    accent: "#b57661",
    worldOffset: { x: 4.1, y: -2, z: 1.8 },
    depth: 18,
    position: { x: 84, y: 68, size: 18 },
    mobilePosition: { x: 73, y: 76, size: 35 },
    rotation: -7,
    drawDelayMs: 390,
  },
} as const satisfies Readonly<Record<string, ProjectConstellationVisual>>;

const FALLBACK_ACCENTS = [
  "#ef4529",
  "#6e78a8",
  "#9c7cac",
  "#769488",
  "#b57661",
] as const;

const FALLBACK_MOTIFS = [
  "wandering arc",
  "resonant lattice",
  "binary drift",
  "deep-space relay",
  "orbital trace",
] as const;

const FALLBACK_POSITIONS = [
  {
    position: { x: 74, y: 23, size: 24 },
    mobilePosition: { x: 65, y: 41, size: 45 },
  },
  {
    position: { x: 47, y: 68, size: 17 },
    mobilePosition: { x: 27, y: 62, size: 33 },
  },
  {
    position: { x: 84, y: 68, size: 17 },
    mobilePosition: { x: 73, y: 76, size: 34 },
  },
  {
    position: { x: 59, y: 45, size: 16 },
    mobilePosition: { x: 38, y: 79, size: 31 },
  },
] as const;

const FALLBACK_WORLD_OFFSETS = [
  { x: 1.4, y: 2.8, z: 0 },
  { x: -2.8, y: -2.2, z: -2.8 },
  { x: 4.1, y: -2, z: 1.8 },
  { x: -0.6, y: -0.1, z: -1.4 },
] as const satisfies readonly Vector3[];

function hashProjectId(projectId: string) {
  let hash = 2166136261;
  for (let index = 0; index < projectId.length; index += 1) {
    hash ^= projectId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededFraction(seed: number, salt: number) {
  let value = seed + Math.imul(salt + 1, 0x6d2b79f5);
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function fallbackPoints(seed: number): readonly ConstellationPoint[] {
  const pointCount = 7 + (seed % 4);
  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);
    const x = 20 + progress * 200 + (seededFraction(seed, index) - 0.5) * 14;
    const wave = Math.sin(progress * Math.PI * (2 + (seed % 3))) * 28;
    const y = 80 + wave + (seededFraction(seed, index + pointCount) - 0.5) * 58;
    return [Math.round(x), Math.round(Math.max(20, Math.min(140, y)))] as const;
  });
}

function fallbackEdges(
  pointCount: number,
  seed: number,
): readonly ConstellationEdge[] {
  const edges: ConstellationEdge[] = Array.from(
    { length: pointCount - 1 },
    (_, index) => [index, index + 1] as const,
  );
  edges.push([0, 2 + (seed % Math.max(1, pointCount - 3))]);
  edges.push([1 + (seed % Math.max(1, pointCount - 4)), pointCount - 1]);
  if (pointCount > 8) edges.push([2, pointCount - 3]);
  return edges;
}

export function resolveProjectConstellation(
  projectId: string,
  projectIndex = 0,
): ProjectConstellationVisual {
  const authored = (
    PROJECT_CONSTELLATION_VISUALS as Readonly<
      Record<string, ProjectConstellationVisual>
    >
  )[projectId];
  if (authored) return authored;

  const seed = hashProjectId(projectId);
  const points = fallbackPoints(seed);
  const slot =
    FALLBACK_POSITIONS[(seed + projectIndex) % FALLBACK_POSITIONS.length];
  const worldSlot =
    FALLBACK_WORLD_OFFSETS[seed % FALLBACK_WORLD_OFFSETS.length];
  const xJitter = Math.round((seededFraction(seed, 37) - 0.5) * 6);
  const yJitter = Math.round((seededFraction(seed, 41) - 0.5) * 5);

  return {
    motif: FALLBACK_MOTIFS[seed % FALLBACK_MOTIFS.length],
    hoverMotion: "trace",
    points,
    edges: fallbackEdges(points.length, seed),
    accent: FALLBACK_ACCENTS[seed % FALLBACK_ACCENTS.length],
    worldOffset: {
      x: worldSlot.x + (seededFraction(seed, 53) - 0.5) * 0.8,
      y: worldSlot.y + (seededFraction(seed, 59) - 0.5) * 0.7,
      z: worldSlot.z + (seededFraction(seed, 61) - 0.5) * 0.9,
    },
    depth: -96 + Math.round(seededFraction(seed, 43) * 208),
    position: {
      ...slot.position,
      x: slot.position.x + xJitter,
      y: slot.position.y + yJitter,
    },
    mobilePosition: {
      ...slot.mobilePosition,
      x: slot.mobilePosition.x + Math.round(xJitter / 2),
      y: slot.mobilePosition.y + Math.round(yJitter / 2),
    },
    rotation: -8 + Math.round(seededFraction(seed, 47) * 16),
    drawDelayMs: 140 + ((seed + projectIndex * 97) % 360),
  };
}

export function createProjectConstellationManifest(
  projectIds: readonly string[],
): ProjectConstellationManifest {
  const seen = new Set<string>();
  const manifest: ProjectConstellationManifestItem[] = [];
  projectIds.forEach((candidate) => {
    const id = candidate.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const visual = resolveProjectConstellation(id, manifest.length);
    manifest.push({
      id,
      motif: visual.motif,
      hoverMotion: visual.hoverMotion,
      points: visual.points.map(([x, y]) => [x, y] as const),
      edges: visual.edges.map(([from, to]) => [from, to] as const),
      accent: visual.accent,
      worldOffset: { ...visual.worldOffset },
      depth: visual.depth,
    });
  });
  return manifest;
}
