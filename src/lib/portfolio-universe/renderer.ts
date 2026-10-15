import { createEarthCountryOverlays } from "./earth-country-overlays";
import { geoEquirectangular, geoPath } from "d3-geo";
import * as THREE from "three";
import { createFrameCadence } from "./frame-cadence";
import { ATLAS_SPIN_DEGREES_PER_SECOND } from "@/lib/photography-atlas/motion";
import { shouldScheduleUniverseFrame } from "./render-scheduling";
import { createAdaptiveQuality } from "./adaptive-quality";
import { createCelestialBodies } from "./celestial-bodies";
import { createShootingStar } from "./shooting-star";
import { easeInteraction, AMBIENT_PROFILES } from "./ambient-effects";
import { createOrbitalDust } from "./orbital-dust";
import {
  createCelestialEarthMaterial,
  createEarthAtmosphereMaterial,
} from "./earth-material";
import {
  createUniverseTextureLoader,
  createWorldArtwork,
  translucentRenderOrder,
} from "./world-artwork";
import { feature } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json";
import {
  CAMERA_ANCHORS,
  EARTH_WORLD_POSITION,
  EARTH_WORLD_RADIUS,
  createCameraFlight,
  projectWorldPoint as projectPointFromPose,
  resolveCameraPose,
  resolveCameraFlightTiming,
  sampleCameraFlight,
  selectUniverseQuality,
  universeFlightMotionDerivative,
  universeFlightMotionProgress,
  type CameraFlight,
  type CameraFlightSample,
  type CameraFlightTiming,
  type CameraPose,
  type UniverseProjection,
  type UniverseQualityProfile,
  type Vector3,
} from "./camera";
import {
  PROJECT_CONSTELLATION_VISUALS,
  createProjectConstellationManifest,
  createProjectConstellationWorldPoints,
  type ProjectConstellationManifest,
} from "./project-constellations";
import type { UniverseSceneId } from "./state";
import {
  WORLD_ANCHORS as COMPOSITION_ANCHORS,
  WORLD_PLANES,
  SCENE_MANIFEST,
  createCompositionFrame,
  resolveWorldPlane,
} from "./scene-manifest";
import {
  surfacePointFacing,
  longitudeLatitudeToVector3,
  vector3ToLongitudeLatitude,
  type AtlasEarthBridge,
  type AtlasEarthRotation,
  type AtlasLongitudeLatitude,
} from "@/lib/photography-atlas/three-earth-adapter";

type AtlasCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { name?: string }
>;

type RuntimeFlight = {
  curve: CameraFlight;
  fromScene: UniverseSceneId;
  toScene: UniverseSceneId;
  fromEmphasis: SceneEmphasis;
  startedAt: number;
  duration: number;
  timing: CameraFlightTiming;
  sequence: number;
  resolve: () => void;
};

export type SceneEmphasis = Record<UniverseSceneId, number>;

type RuntimeFrameListener = (snapshot: UniverseRuntimeSnapshot) => void;

export type UniverseRuntimeSnapshot = Readonly<{
  rendererType: "webgl" | "fallback" | "destroyed";
  webglReady: boolean;
  artworkReady: boolean;
  effectTimeMs: number;
  sceneWeights: Readonly<SceneEmphasis>;
  activeScene: UniverseSceneId;
  interactionTarget: string | null;
  camera: Readonly<{
    position: readonly [number, number, number];
    quaternion: readonly [number, number, number, number];
    fov: number;
  }>;
  flight: Readonly<{
    sequence: number;
    from: UniverseSceneId;
    to: UniverseSceneId;
    progress: number;
    motionProgress: number;
    durationMs: number;
  }> | null;
  effects: Readonly<{
    earthOpacity: number;
    earthOffset: readonly [number, number];
    earthAura: number;
    constellationPulse: number;
    nebulaActivity: number;
    shootingStarActive: boolean;
    bodyCount: number;
  }>;
  quality: Readonly<{
    tier: "high" | "low";
    pixelRatio: number;
    drawCalls: number;
    particleCount: number;
    dustCount: number;
    projectHaloCount: number;
    nebulaLayerCount: number;
    trailCount: number;
  }>;
  projectedAnchors: Readonly<Record<string, UniverseProjection | null>>;
  lifecycle: Readonly<{
    contextLost: boolean;
    frameScheduled: boolean;
    suspended: boolean;
    destroyed: boolean;
  }>;
}>;

export type PortfolioUniverseRenderer = Readonly<{
  ready: Promise<boolean>;
  travelTo: (scene: UniverseSceneId, duration: number) => Promise<void>;
  navigateTo: (scene: UniverseSceneId, duration: number) => Promise<void>;
  retarget: (scene: UniverseSceneId, duration: number) => Promise<void>;
  jumpTo: (scene: UniverseSceneId) => void;
  projectAnchor: (id: string) => UniverseProjection | null;
  projectPlane: (
    position: Vector3,
    width: number,
    height: number,
  ) => UniverseProjection | null;
  suspend: () => void;
  resume: () => void;
  setInteractionTarget: (target: string | null) => void;
  setEffectTime: (timeMs: number | null) => void;
  getSnapshot: () => UniverseRuntimeSnapshot;
  getAtlasEarthBridge: () => AtlasEarthBridge | null;
  subscribe: (listener: RuntimeFrameListener) => () => void;
  seekFlight: (
    from: UniverseSceneId,
    to: UniverseSceneId,
    progress: number,
  ) => UniverseRuntimeSnapshot;
  getFrameLog: () => readonly UniverseRuntimeSnapshot[];
  clearFrameLog: () => void;
  simulateContextLoss: () => void;
  cancel: () => void;
  destroy: () => void;
}>;

export { projectPointFromPose as projectWorldPoint };
export type { UniverseProjection };

export type UniverseRendererOptions = Readonly<{
  projectManifest?: ProjectConstellationManifest;
  projectIds?: readonly string[];
}>;

const EARTH_POSITION = EARTH_WORLD_POSITION;
const EARTH_RADIUS = EARTH_WORLD_RADIUS;
const ALIEN_PLANET_POSITION = COMPOSITION_ANCHORS.planet;
const ABOUT_NEBULA_POSITION = COMPOSITION_ANCHORS.about;
const PROJECT_FIELD_POSITION = COMPOSITION_ANCHORS.projects;
const DEFAULT_EARTH_ROTATION: AtlasEarthRotation = [85, 5, 0];
const MAX_FRAME_LOG = 1_200;
const ALIEN_PLANET_SCALE = 36.5;

export const UNIVERSE_EARTH_PALETTE = {
  ocean: "#dce9ec",
  land: "#f5f0e8",
  homeVisited: "#bbb2d2",
  visited: "#ff8d6d",
  active: "#b7cf69",
  activeOutline: "#ff8d6d",
  coastline: "rgba(67, 54, 65, .28)",
} as const;

const WORLD_ANCHORS: Readonly<Record<string, Vector3>> = {
  earth: EARTH_POSITION,
  planet: ALIEN_PLANET_POSITION,
  about: ABOUT_NEBULA_POSITION,
  projects: PROJECT_FIELD_POSITION,
};

function worldBox(
  center: Vector3,
  halfWidth: number,
  halfHeight = halfWidth,
  halfDepth = halfWidth,
) {
  return new THREE.Box3(
    new THREE.Vector3(
      center.x - halfWidth,
      center.y - halfHeight,
      center.z - halfDepth,
    ),
    new THREE.Vector3(
      center.x + halfWidth,
      center.y + halfHeight,
      center.z + halfDepth,
    ),
  );
}

export type UniverseNebulaLayerProfile = Readonly<{
  id: "far" | "core" | "drift" | "near" | "crown" | "veil" | "lower-bank";
  source: string;
  position: readonly [number, number, number];
  scale: readonly [number, number];
  homeOpacity: number;
  aboutOpacity: number;
  projectsOpacity: number;
  travelOpacity: number;
  renderOrder: number;
  motionIndex: number;
  drift: readonly [number, number];
  burst: number;
}>;

const NEBULA_LAYER_PROFILES = [
  {
    id: "far",
    source: "/media/site/nebula-cloud-core-v3.webp",
    position: [-16.8, 2.4, -60],
    scale: [78, 43],
    homeOpacity: 0.34,
    aboutOpacity: 0.58,
    projectsOpacity: 0.28,
    travelOpacity: 0.08,
    renderOrder: 0,
    motionIndex: 0,
    drift: [0.45, 0.2],
    burst: 0.055,
  },
  {
    id: "core",
    source: "/media/site/nebula-cloud-core-v3.webp",
    position: [-11.7, 0.8, -31],
    scale: [49, 32],
    homeOpacity: 0.42,
    aboutOpacity: 0.88,
    projectsOpacity: 0.34,
    travelOpacity: 0.08,
    renderOrder: 2,
    motionIndex: 1,
    drift: [0.7, 0.32],
    burst: 0.11,
  },
  {
    id: "drift",
    source: "/media/site/nebula-cloud-veil-v3.webp",
    position: [2.5, 1.2, -42],
    scale: [43, 25],
    homeOpacity: 0.26,
    aboutOpacity: 0.56,
    projectsOpacity: 0.3,
    travelOpacity: 0.05,
    renderOrder: 1,
    motionIndex: 2,
    drift: [0.52, 0.26],
    burst: 0.08,
  },
  {
    id: "near",
    source: "/media/site/nebula-cloud-veil-v3.webp",
    position: [-5.5, -0.2, -4.2],
    scale: [23, 15],
    homeOpacity: 0.1,
    aboutOpacity: 0.48,
    projectsOpacity: 0.08,
    travelOpacity: 0.01,
    renderOrder: 9,
    motionIndex: 3,
    drift: [0.3, 0.48],
    burst: 0.12,
  },
  {
    id: "crown",
    source: "/media/site/nebula-cloud-core-v3.webp",
    position: [18, 9.5, -41],
    scale: [43, 27],
    homeOpacity: 0.4,
    aboutOpacity: 0.38,
    projectsOpacity: 0.28,
    travelOpacity: 0.04,
    renderOrder: 3,
    motionIndex: 4,
    drift: [0.38, 0.34],
    burst: 0.075,
  },
  {
    id: "veil",
    source: "/media/site/nebula-cloud-veil-v3.webp",
    position: [-16, -11.5, -20],
    scale: [43, 27],
    homeOpacity: 0.34,
    aboutOpacity: 0.4,
    projectsOpacity: 0.18,
    travelOpacity: 0.05,
    renderOrder: 6,
    motionIndex: 5,
    drift: [0.52, 0.28],
    burst: 0.1,
  },
  {
    id: "lower-bank",
    source: "/media/site/nebula-cloud-core-v3.webp",
    position: [10.5, -13.5, -37],
    scale: [50, 27],
    homeOpacity: 0.24,
    aboutOpacity: 0.34,
    projectsOpacity: 0.21,
    travelOpacity: 0.03,
    renderOrder: 4,
    motionIndex: 6,
    drift: [0.44, 0.32],
    burst: 0.07,
  },
] as const satisfies readonly UniverseNebulaLayerProfile[];

export const UNIVERSE_CONSTELLATION_OPACITY = {
  home: { points: 0.98, lines: 0.78 },
  projects: { points: 1, lines: 0.9 },
} as const;

const CONSTELLATION_NATURAL_TINTS = ["#f5d3a0", "#edd5b4", "#e9bd86"] as const;

export function universeConstellationTint(
  accent: string,
  projectIndex: number,
): readonly [red: number, green: number, blue: number] {
  const natural = new THREE.Color(
    CONSTELLATION_NATURAL_TINTS[
      Math.abs(projectIndex) % CONSTELLATION_NATURAL_TINTS.length
    ],
  );
  const authored = new THREE.Color(accent);
  natural.lerp(authored, 0.04);
  return [natural.r, natural.g, natural.b];
}

export function universeNebulaLayerProfiles(
  tier: "high" | "low",
): readonly UniverseNebulaLayerProfile[] {
  return NEBULA_LAYER_PROFILES.filter(
    (profile) =>
      tier === "high" || ["far", "core", "crown", "veil"].includes(profile.id),
  );
}

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

export function universeTrailEnvelope(progress: number, reducedMotion = false) {
  return reducedMotion
    ? 0
    : Math.pow(Math.sin(Math.PI * clamp(progress)), 0.72);
}

export function universeTwinkleSample(
  timeMs: number,
  phase: number,
  amplitude: number,
) {
  const seconds = Math.max(0, timeMs) / 1_000;
  const twinkle = clamp(amplitude);
  const slowPulse = 0.5 + 0.5 * Math.sin(seconds * (0.72 + twinkle) + phase);
  const sharpTwinkle = Math.pow(
    Math.max(0, Math.sin(seconds * 1.7 + phase)),
    12,
  );
  return 0.72 + slowPulse * twinkle * 0.34 + sharpTwinkle * twinkle * 0.62;
}

export function universeConstellationPulse(
  timeMs: number,
  projectEmphasis: number,
  reducedMotion = false,
) {
  const seconds = reducedMotion ? 0 : Math.max(0, timeMs) / 1_000;
  return clamp(projectEmphasis) * (0.5 + 0.5 * Math.sin(seconds * 0.72));
}

export type UniverseEarthVisualState = Readonly<{
  opacity: number;
  offset: Readonly<{ x: number; y: number }>;
}>;

export function universeEarthVisualState(
  emphasis: SceneEmphasis,
): UniverseEarthVisualState {
  void emphasis;
  return {
    opacity: 1,
    offset: { x: 0, y: 0 },
  };
}

export function universeAboutRayIntensity(
  timeMs: number,
  phase: number,
  aboutEmphasis: number,
  interaction: number,
  reducedMotion = false,
) {
  const about = clamp(aboutEmphasis);
  const active = clamp(interaction);
  if (reducedMotion) return clamp(about * 0.12 + active * 0.22);
  const cycle = (Math.max(0, timeMs) / 1_000 + phase) % 1;
  const attack = clamp(cycle / 0.14);
  const release = 1 - clamp((cycle - 0.3) / 0.5);
  const burst = attack * release;
  return clamp(about * (0.08 + burst * 0.18) + active * burst * 0.72);
}

export function universeStarBandCounts(total: number) {
  const particleCount = Math.max(0, Math.floor(total));
  const far = Math.round(particleCount * 0.52);
  const middle = Math.round(particleCount * 0.3);
  return { far, middle, near: particleCount - far - middle } as const;
}

export function universeTrailSegment(
  anchor: Vector3,
  tangent: Vector3,
  progress: number,
  lengthScale = 1,
): readonly [Vector3, Vector3] {
  const direction = new THREE.Vector3(tangent.x, tangent.y, tangent.z);
  const envelope = universeTrailEnvelope(progress);
  if (direction.lengthSq() <= Number.EPSILON || envelope <= 0)
    return [anchor, anchor];
  direction.normalize().multiplyScalar(mix(0.9, 2.55, envelope) * lengthScale);
  return [
    {
      x: anchor.x + direction.x,
      y: anchor.y + direction.y,
      z: anchor.z + direction.z,
    },
    anchor,
  ];
}

export function universeNebulaBurst(
  timeMs: number,
  profile: Pick<UniverseNebulaLayerProfile, "motionIndex" | "burst">,
) {
  const seconds = Math.max(0, timeMs) / 1_000;
  const phase = profile.motionIndex * 1.37;
  return (
    Math.pow(
      Math.max(
        0,
        Math.sin(seconds * (0.34 + profile.motionIndex * 0.018) + phase),
      ),
      8,
    ) * profile.burst
  );
}

const sceneEmphasisFor = (sceneId: UniverseSceneId): SceneEmphasis => ({
  home: sceneId === "home" ? 1 : 0,
  about: sceneId === "about" ? 1 : 0,
  projects: sceneId === "projects" ? 1 : 0,
  travel: sceneId === "travel" ? 1 : 0,
});

const vectorTuple = (vector: THREE.Vector3) =>
  [vector.x, vector.y, vector.z] as const;

const toThreeVector = (vector: Vector3) =>
  new THREE.Vector3(vector.x, vector.y, vector.z);

const vectorFromThree = (vector: THREE.Vector3): Vector3 => ({
  x: vector.x,
  y: vector.y,
  z: vector.z,
});

function configuredQuality(): UniverseQualityProfile {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return selectUniverseQuality({
    hardwareConcurrency: navigator.hardwareConcurrency || 8,
    deviceMemory:
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8,
    devicePixelRatio: window.devicePixelRatio || 1,
    reducedData: connection?.saveData,
  });
}

/** Keep the backing buffer bounded even on large or high-density displays. */
export function universeRenderPixelRatio(
  width: number,
  height: number,
  preferredPixelRatio: number,
) {
  const viewportWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const viewportHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const pixelBudget = viewportWidth <= 700 ? 1_000_000 : 2_000_000;
  const preferred = Number.isFinite(preferredPixelRatio)
    ? Math.max(0.1, preferredPixelRatio)
    : 1;
  return Math.min(
    preferred,
    Math.sqrt(pixelBudget / (viewportWidth * viewportHeight)),
  );
}

function seededRandom(seedValue: number) {
  let seed = seedValue;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function createDiscTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.17, "rgba(255,255,255,.96)");
  gradient.addColorStop(0.42, "rgba(255,255,255,.3)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function readVisitedAtlasIds(root: HTMLElement | null) {
  const data =
    root?.querySelector<HTMLScriptElement>("[data-atlas-countries]") ??
    document.querySelector<HTMLScriptElement>("[data-atlas-countries]");
  if (!data?.textContent) return new Set<number>();
  try {
    const countries = JSON.parse(data.textContent) as Array<{
      atlasId?: number;
    }>;
    return new Set(
      countries.flatMap((country) =>
        typeof country.atlasId === "number" ? [country.atlasId] : [],
      ),
    );
  } catch {
    return new Set<number>();
  }
}

function createEarthTexture(root: HTMLElement | null, quality: "high" | "low") {
  const width = quality === "high" ? 4_096 : 2_048;
  const height = width / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const topology = countries110m as unknown as {
    type: "Topology";
    objects: Record<string, object> & { countries: object };
    arcs: unknown[];
  };
  const collection = feature(
    topology as never,
    topology.objects.countries as never,
  ) as unknown as AtlasCollection;
  const projection = geoEquirectangular()
    .translate([width / 2, height / 2])
    .scale(width / (2 * Math.PI))
    .precision(0.25);
  const path = geoPath(projection, context);
  const visited = readVisitedAtlasIds(root);

  const renderTexture = () => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = UNIVERSE_EARTH_PALETTE.ocean;
    context.fillRect(0, 0, width, height);
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    path(collection);
    context.fillStyle = UNIVERSE_EARTH_PALETTE.land;
    context.fill();
    context.strokeStyle = UNIVERSE_EARTH_PALETTE.coastline;
    context.lineWidth = quality === "high" ? 0.62 : 0.85;
    context.stroke();

    for (const country of collection.features) {
      if (!visited.has(Number(country.id))) continue;
      context.beginPath();
      path(country);
      context.fillStyle = UNIVERSE_EARTH_PALETTE.visited;
      context.fill();
      context.strokeStyle = "rgba(67,54,65,.34)";
      context.lineWidth = quality === "high" ? 1.1 : 1.35;
      context.stroke();
    }
  };
  renderTexture();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.offset.x = 0.5;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = quality === "high" ? 16 : 4;
  return { texture };
}

function createStarField(
  count: number,
  band: "far" | "middle" | "near" | "dust",
  discTexture: THREE.Texture | null,
  projectHaloCount = 0,
) {
  const random = seededRandom(
    band === "far"
      ? 731
      : band === "middle"
        ? 907
        : band === "near"
          ? 1213
          : 1831,
  );
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const twinkles = new Float32Array(count);
  const sizes = new Float32Array(count);
  const projectHalos = new Float32Array(count);
  const white = new THREE.Color("#ffffff");
  const depth =
    band === "far"
      ? [-132, -56]
      : band === "middle"
        ? [-64, -20]
        : band === "near"
          ? [-26, 4]
          : [-18, 7];
  const spread =
    band === "far" ? 88 : band === "middle" ? 56 : band === "near" ? 34 : 24;

  for (let index = 0; index < count; index += 1) {
    const haloStar = band === "middle" && index >= count - projectHaloCount;
    const color = white;
    projectHalos[index] = haloStar ? 1 : 0;
    positions[index * 3] = haloStar
      ? PROJECT_FIELD_POSITION.x + (random() - 0.5) * 13
      : (random() - 0.5) * spread * 2;
    positions[index * 3 + 1] = haloStar
      ? PROJECT_FIELD_POSITION.y + (random() - 0.5) * 9
      : (random() - 0.5) * spread * 1.08;
    positions[index * 3 + 2] = haloStar
      ? PROJECT_FIELD_POSITION.z + (random() - 0.5) * 10
      : mix(depth[0], depth[1], random());
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    phases[index] = random() * Math.PI * 2;
    twinkles[index] =
      index % 11 === 3 || haloStar ? 0.65 + random() * 0.35 : 0.12;
    sizes[index] =
      (band === "far"
        ? 0.12
        : band === "middle"
          ? 0.17
          : band === "near"
            ? 0.23
            : 0.075) *
      (0.72 + random() * 0.7);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkles, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute(
    "aProjectHalo",
    new THREE.BufferAttribute(projectHalos, 1),
  );
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uViewportHeight: { value: 450 },
      uOpacity: { value: band === "dust" ? 0.3 : 0.78 },
      uProjectEmphasis: { value: 0 },
      uTexture: { value: discTexture },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float aPhase;
      attribute float aTwinkle;
      attribute float aSize;
      attribute float aProjectHalo;
      uniform float uTime;
      uniform float uViewportHeight;
      uniform float uProjectEmphasis;
      varying vec3 vColor;
      varying float vGlow;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float slowPulse = 0.5 + 0.5 * sin(uTime * (0.72 + aTwinkle) + aPhase);
        float sharpTwinkle = pow(max(0.0, sin(uTime * 1.7 + aPhase)), 12.0);
        vGlow = 0.72 + slowPulse * aTwinkle * 0.34 + sharpTwinkle * aTwinkle * 0.62;
        float projectHalo = aProjectHalo * (0.45 + uProjectEmphasis * 0.55);
        vGlow *= 1.0 + projectHalo * (0.48 + sharpTwinkle * 0.42);
        vColor = color;
        gl_PointSize = max(1.0, aSize * uViewportHeight / max(0.4, -viewPosition.z) * vGlow * (1.0 + projectHalo * 0.16));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uTexture;
      varying vec3 vColor;
      varying float vGlow;

      void main() {
        vec4 disc = texture2D(uTexture, gl_PointCoord);
        float alpha = disc.a * uOpacity * min(vGlow, 1.34);
        if (alpha < 0.012) discard;
        vec3 pearl = mix(vColor, vec3(1.0), mix(0.18, 0.9, step(0.5, vGlow - 0.72)));
        gl_FragColor = vec4(pearl * min(vGlow, 1.24), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = `universe-stars-${band}`;
  points.renderOrder = band === "far" ? 1 : band === "middle" ? 3 : 6;
  return points;
}

function createConstellations(
  discTexture: THREE.Texture | null,
  projectManifest: ProjectConstellationManifest,
) {
  const pointPositions: number[] = [];
  const pointColors: number[] = [];
  const pointPhases: number[] = [];
  const pointProjects: number[] = [];
  const pointGlints: number[] = [];
  const pointVariations: number[] = [];
  const pointMotions: number[] = [];
  const pointOrders: number[] = [];
  const lineMotions: number[] = [];
  const lineOrders: number[] = [];
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  const lineProjects: number[] = [];
  const anchors = new Map<string, THREE.Vector3>();
  const bounds = new Map<string, THREE.Box3>();
  const projectIndices = new Map<string, number>();
  const projectFieldBounds = new THREE.Box3();
  const champagne = new THREE.Color("#eed3a3");

  projectManifest.forEach((visual, visualIndex) => {
    const projectId = visual.id;
    const motion =
      visual.hoverMotion === "wave"
        ? 1
        : visual.hoverMotion === "cards"
          ? 2
          : 0;
    const color = new THREE.Color(
      ...universeConstellationTint(visual.accent, visualIndex),
    );
    const stellarColor = color.clone().lerp(champagne, 0.86);
    const linkColor = color.clone().lerp(champagne, 0.76);
    const points = createProjectConstellationWorldPoints(
      visual,
      PROJECT_FIELD_POSITION,
    ).map(({ x, y, z }) => new THREE.Vector3(x, y, z));
    const center = points
      .reduce((sum, point) => sum.add(point), new THREE.Vector3())
      .multiplyScalar(1 / Math.max(1, points.length));
    const projectBounds = new THREE.Box3().setFromPoints(points);
    anchors.set(`project:${projectId}`, center);
    bounds.set(`project:${projectId}`, projectBounds);
    projectFieldBounds.union(projectBounds);
    projectIndices.set(projectId, visualIndex);
    points.forEach((point, pointIndex) => {
      pointPositions.push(point.x, point.y, point.z);
      pointColors.push(stellarColor.r, stellarColor.g, stellarColor.b);
      pointPhases.push(
        (visualIndex * 2.17 + pointIndex * 0.91) % (Math.PI * 2),
      );
      pointProjects.push(visualIndex);
      pointMotions.push(motion);
      pointOrders.push(pointIndex / Math.max(1, points.length - 1));
      // One unmistakable guiding star per project; the smaller stars retain
      // their own readable cores instead of becoming uniformly large halos.
      pointGlints.push(
        pointIndex === Math.floor(points.length / 2)
          ? 1
          : pointIndex % 4 === 0
            ? 0.65
            : 0.12,
      );
      pointVariations.push(((pointIndex * 7 + visualIndex * 3) % 11) / 10);
    });
    visual.edges.forEach(([from, to]) => {
      const start = points[from];
      const end = points[to];
      linePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
      lineColors.push(
        linkColor.r,
        linkColor.g,
        linkColor.b,
        linkColor.r,
        linkColor.g,
        linkColor.b,
      );
      lineProjects.push(visualIndex, visualIndex);
      lineMotions.push(motion, motion);
      lineOrders.push(
        from / Math.max(1, points.length - 1),
        to / Math.max(1, points.length - 1),
      );
    });
  });
  if (!projectFieldBounds.isEmpty()) {
    anchors.set("projects", projectFieldBounds.getCenter(new THREE.Vector3()));
    bounds.set("projects", projectFieldBounds);
  }

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(pointPositions, 3),
  );
  pointGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(pointColors, 3),
  );
  pointGeometry.setAttribute(
    "aPhase",
    new THREE.Float32BufferAttribute(pointPhases, 1),
  );
  pointGeometry.setAttribute(
    "aProject",
    new THREE.Float32BufferAttribute(pointProjects, 1),
  );
  pointGeometry.setAttribute(
    "aGlint",
    new THREE.Float32BufferAttribute(pointGlints, 1),
  );
  pointGeometry.setAttribute(
    "aVariation",
    new THREE.Float32BufferAttribute(pointVariations, 1),
  );
  pointGeometry.setAttribute(
    "aMotion",
    new THREE.Float32BufferAttribute(pointMotions, 1),
  );
  pointGeometry.setAttribute(
    "aOrder",
    new THREE.Float32BufferAttribute(pointOrders, 1),
  );
  const pointMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uEmphasis: { value: 0 },
      uFieldInteraction: { value: 0 },
      uFocusedProject: { value: -1 },
      uTexture: { value: discTexture },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float aPhase;
      attribute float aProject;
      attribute float aMotion;
      attribute float aOrder;
      attribute float aGlint;
      attribute float aVariation;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uEmphasis;
      uniform float uFieldInteraction;
      uniform float uFocusedProject;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlint;
      varying float vCard;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float focused = 1.0 - step(0.35, abs(aProject - uFocusedProject));
        float trace = pow(max(0.0, cos(aOrder * 6.283 - uTime * 2.6)), 12.0);
        float wave = pow(0.5 + 0.5 * sin(aOrder * 9.0 - uTime * 3.8), 3.0);
        float cards = pow(max(0.0, sin(uTime * 3.0 - floor(aOrder * 3.0) * 2.0)), 8.0);
        float gesture = aMotion < 0.5 ? trace : aMotion < 1.5 ? wave : cards;
        float breath = sin(uTime * 0.75 + aPhase) * 0.11;
        float sparkle = pow(max(0.0, sin(uTime * 1.08 + aPhase)), 8.0) * mix(0.22, 0.36, uEmphasis);
        float ordinarySize = 16.0 + aVariation * 6.0;
        float guidingSize = 54.0 + aVariation * 10.0;
        float perspective = clamp(420.0 / max(72.0, -viewPosition.z), 0.55, 1.55);
        float size = mix(ordinarySize, guidingSize, aGlint) * perspective;
        float glow = (1.0 + breath + sparkle) * (1.0 + focused * (0.2 + gesture * 1.35) + uFieldInteraction * 0.55);
        vColor = color;
        vGlint = aGlint;
        vCard = step(1.5, aMotion) * focused * gesture;
        vAlpha = mix(${UNIVERSE_CONSTELLATION_OPACITY.home.points.toFixed(2)}, ${UNIVERSE_CONSTELLATION_OPACITY.projects.points.toFixed(2)}, uEmphasis) + focused * 0.34 + uFieldInteraction * 0.24;
        gl_PointSize = size * glow * uPixelRatio;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlint;
      varying float vCard;

      void main() {
        vec2 centered = gl_PointCoord * 2.0 - 1.0;
        float radius = length(centered);
        float core = 1.0 - smoothstep(0.025, 0.14, radius);
        float shoulder = exp(-radius * radius * 35.0) * 0.60;
        float halo = texture2D(uTexture, gl_PointCoord).a * 0.48;
        float horizontal = exp(-abs(centered.y) * 48.0) * pow(max(0.0, 1.0 - abs(centered.x)), 0.95);
        float vertical = exp(-abs(centered.x) * 48.0) * pow(max(0.0, 1.0 - abs(centered.y)), 0.95);
        float rays = max(horizontal * 0.78, vertical) * mix(0.12, 0.98, vGlint);
        float cardDistance = max(abs(centered.x) * 1.5, abs(centered.y));
        float card = (1.0 - smoothstep(0.02, 0.075, abs(cardDistance - 0.57))) * vCard * 0.7;
        float filaments = (0.5 + 0.5 * sin(atan(centered.y, centered.x) * 12.0 + radius * 28.0)) * exp(-radius * 7.0) * 0.08;
        float alpha = min(1.0, core + shoulder + halo + rays + filaments + card) * min(vAlpha, 1.0);
        if (alpha < 0.008) discard;
        vec3 pearl = mix(vColor, vec3(1.0, 0.985, 0.93), min(1.0, core + shoulder + rays * 0.6));
        gl_FragColor = vec4(pearl, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  pointMaterial.toneMapped = false;
  const points = new THREE.Points(pointGeometry, pointMaterial);
  points.name = "project-constellation-points";
  points.renderOrder = 8;

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(linePositions, 3),
  );
  lineGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(lineColors, 3),
  );
  lineGeometry.setAttribute(
    "aProject",
    new THREE.Float32BufferAttribute(lineProjects, 1),
  );
  lineGeometry.setAttribute(
    "aMotion",
    new THREE.Float32BufferAttribute(lineMotions, 1),
  );
  lineGeometry.setAttribute(
    "aOrder",
    new THREE.Float32BufferAttribute(lineOrders, 1),
  );
  const lineMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEmphasis: { value: 0 },
      uFieldInteraction: { value: 0 },
      uFocusedProject: { value: -1 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float aProject;
      attribute float aMotion;
      attribute float aOrder;
      uniform float uTime;
      uniform float uEmphasis;
      uniform float uFieldInteraction;
      uniform float uFocusedProject;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float focused = 1.0 - step(0.35, abs(aProject - uFocusedProject));
        float trace = pow(max(0.0, cos(aOrder * 6.283 - uTime * 2.6)), 12.0);
        float wave = pow(0.5 + 0.5 * sin(aOrder * 9.0 - uTime * 3.8), 3.0);
        float cards = pow(max(0.0, sin(uTime * 3.0 - floor(aOrder * 3.0) * 2.0)), 8.0);
        float gesture = aMotion < 0.5 ? trace : aMotion < 1.5 ? wave : cards;
        vColor = color;
        float pulse = 0.5 + 0.5 * sin(uTime * 0.72 + aProject * 1.83);
        vAlpha = mix(${UNIVERSE_CONSTELLATION_OPACITY.home.lines.toFixed(2)}, ${UNIVERSE_CONSTELLATION_OPACITY.projects.lines.toFixed(2)}, uEmphasis) + uEmphasis * (0.07 + pulse * 0.12) + focused * (0.18 + gesture * 0.7) + uFieldInteraction * (0.38 + (0.5 + 0.5 * sin(uTime * 1.8 - position.x * 0.21 + position.y * 0.14)) * 0.25);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        gl_FragColor = vec4(mix(vColor, vec3(1.0, 0.975, 0.91), 0.12), min(vAlpha, 0.90));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  lineMaterial.toneMapped = false;
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.name = "project-constellation-lines";
  lines.renderOrder = 7;

  return {
    points,
    lines,
    pointMaterial,
    lineMaterial,
    anchors,
    bounds,
    projectIndices,
  };
}

type CanvasViewport = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

function projectBillboardPlane(
  pose: CameraPose,
  position: Vector3,
  planeWidth: number,
  planeHeight: number,
  viewport: CanvasViewport,
): UniverseProjection | null {
  if (
    !Number.isFinite(planeWidth) ||
    !Number.isFinite(planeHeight) ||
    planeWidth < 0 ||
    planeHeight < 0
  )
    return null;
  const projection = projectPointFromPose(pose, position, viewport);
  if (!projection) return null;
  const width = planeWidth * projection.scale;
  const height = planeHeight * projection.scale;
  return {
    ...projection,
    bounds: {
      left: projection.x - width / 2,
      top: projection.y - height / 2,
      width,
      height,
    },
  };
}

function makeFallbackRuntime(
  canvas: HTMLCanvasElement,
  root: HTMLElement | null,
): PortfolioUniverseRenderer {
  let activeScene: UniverseSceneId = "home";
  let destroyed = false;
  let suspended = false;
  let documentVisible = !document.hidden;
  let viewport: CanvasViewport = canvas.getBoundingClientRect();
  const currentPose = () =>
    resolveCameraPose(
      activeScene,
      viewport.width || innerWidth,
      viewport.height || innerHeight,
    );
  const listeners = new Set<RuntimeFrameListener>();
  const snapshot = (): UniverseRuntimeSnapshot => {
    const pose = currentPose();
    return {
      rendererType: destroyed ? "destroyed" : "fallback",
      webglReady: false,
      artworkReady: false,
      effectTimeMs: 0,
      sceneWeights: sceneEmphasisFor(activeScene),
      activeScene,
      interactionTarget: null,
      camera: {
        position: [pose.position.x, pose.position.y, pose.position.z],
        quaternion: [0, 0, 0, 1],
        fov: pose.fov,
      },
      flight: null,
      effects: {
        earthOpacity: 1,
        earthOffset: [0, 0],
        earthAura: 0,
        constellationPulse: activeScene === "projects" ? 0.5 : 0,
        nebulaActivity: activeScene === "about" ? 0.12 : 0,
        shootingStarActive: false,
        bodyCount: 0,
      },
      quality: {
        tier: "low",
        pixelRatio: 1,
        drawCalls: 0,
        particleCount: 0,
        dustCount: 0,
        projectHaloCount: 0,
        nebulaLayerCount: 0,
        trailCount: 0,
      },
      projectedAnchors: {},
      lifecycle: {
        contextLost: false,
        frameScheduled: false,
        suspended,
        destroyed,
      },
    };
  };
  const publish = () => {
    if (destroyed || suspended || !documentVisible) return;
    const value = snapshot();
    listeners.forEach((listener) => listener(value));
  };
  const refreshViewport = () => {
    if (destroyed) return;
    viewport = canvas.getBoundingClientRect();
    publish();
  };
  const onVisibility = () => {
    documentVisible = !document.hidden;
    if (documentVisible) refreshViewport();
  };
  const resizeObserver = new ResizeObserver(refreshViewport);
  resizeObserver.observe(canvas);
  window.addEventListener("resize", refreshViewport);
  window.visualViewport?.addEventListener("resize", refreshViewport);
  window.visualViewport?.addEventListener("scroll", refreshViewport);
  document.addEventListener("visibilitychange", onVisibility);
  const jumpTo = (scene: UniverseSceneId) => {
    if (destroyed) return;
    activeScene = scene;
    root?.setAttribute("data-earth-scene-opacity", "1.0000");
    root?.setAttribute("data-earth-scene-offset", "0.0000,0.0000");
    root?.setAttribute(
      "data-constellation-pulse",
      scene === "projects" ? "0.5000" : "0.0000",
    );
    publish();
  };
  root?.setAttribute("data-renderer-type", "fallback");
  root?.setAttribute("data-webgl-ready", "false");
  root?.setAttribute("data-artwork-ready", "false");
  root?.setAttribute("data-trail-count", "0");
  root?.setAttribute("data-trail-opacity", "0.0000");
  root?.setAttribute("data-interaction-target", "");
  root?.setAttribute("data-earth-scene-opacity", "1.0000");
  root?.setAttribute("data-earth-scene-offset", "0.0000,0.0000");
  root?.setAttribute("data-constellation-pulse", "0.0000");
  canvas.style.visibility = "hidden";
  return {
    ready: Promise.resolve(false),
    travelTo: async (scene) => jumpTo(scene),
    navigateTo: async (scene) => jumpTo(scene),
    retarget: async (scene) => jumpTo(scene),
    jumpTo,
    projectAnchor: () => null,
    projectPlane: (position, width, height) =>
      destroyed
        ? null
        : projectBillboardPlane(currentPose(), position, width, height, {
            ...viewport,
            width: viewport.width || innerWidth,
            height: viewport.height || innerHeight,
          }),
    suspend: () => {
      suspended = true;
      root?.setAttribute("data-renderer-suspended", "true");
    },
    resume: () => {
      if (destroyed) return;
      suspended = false;
      root?.setAttribute("data-renderer-suspended", "false");
      refreshViewport();
    },
    setInteractionTarget: () => undefined,
    setEffectTime: () => undefined,
    getSnapshot: snapshot,
    getAtlasEarthBridge: () => null,
    subscribe: (listener) => {
      if (destroyed) return () => undefined;
      listeners.add(listener);
      // There is no animation loop to deliver an initial fallback frame.
      if (!suspended && documentVisible) listener(snapshot());
      return () => listeners.delete(listener);
    },
    seekFlight: (_from, to) => {
      jumpTo(to);
      return snapshot();
    },
    getFrameLog: () => [],
    clearFrameLog: () => undefined,
    simulateContextLoss: () => undefined,
    cancel: () => undefined,
    destroy: () => {
      destroyed = true;
      resizeObserver.disconnect();
      window.removeEventListener("resize", refreshViewport);
      window.visualViewport?.removeEventListener("resize", refreshViewport);
      window.visualViewport?.removeEventListener("scroll", refreshViewport);
      document.removeEventListener("visibilitychange", onVisibility);
      listeners.clear();
      if (root) {
        root.dataset.rendererType = "destroyed";
        delete root.dataset.projectCount;
        delete root.dataset.loadedCloudCount;
        delete root.dataset.trailCount;
        delete root.dataset.trailOpacity;
        delete root.dataset.interactionTarget;
        delete root.dataset.earthSceneOpacity;
        delete root.dataset.earthSceneOffset;
        delete root.dataset.earthAura;
        delete root.dataset.constellationPulse;
        delete root.dataset.nebulaActivity;
      }
    },
  };
}

export function universeAnchorSnapshot(scene: UniverseSceneId) {
  const viewport = { width: 1_440, height: 900 } as const;
  const pose = resolveCameraPose(scene, viewport.width, viewport.height);
  return {
    earth: projectPointFromPose(pose, EARTH_POSITION, viewport),
    alienPlanet: projectPointFromPose(pose, ALIEN_PLANET_POSITION, viewport),
    aboutNebula: projectPointFromPose(pose, ABOUT_NEBULA_POSITION, viewport),
  };
}

export function createPortfolioUniverseRenderer(
  canvas: HTMLCanvasElement,
  legacyEarthElement: HTMLElement | null = null,
  options: UniverseRendererOptions = {},
): PortfolioUniverseRenderer {
  void legacyEarthElement;
  const root = canvas.closest<HTMLElement>(
    "[data-universe-world], [data-portfolio-universe]",
  );
  const projectManifest =
    options.projectManifest ??
    createProjectConstellationManifest(
      options.projectIds ?? Object.keys(PROJECT_CONSTELLATION_VISUALS),
    );
  const projectIds = projectManifest.map(({ id }) => id);
  root?.setAttribute("data-project-count", String(projectIds.length));
  root?.setAttribute("data-loaded-cloud-count", "0");
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: configuredQuality().tier === "high",
      powerPreference: "high-performance",
      premultipliedAlpha: true,
    });
  } catch {
    return makeFallbackRuntime(canvas, root);
  }

  const quality = configuredQuality();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.08, 1200);
  camera.up.set(0, 1, 0);
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.sortObjects = true;

  const resources = new Set<
    THREE.Texture | THREE.Material | THREE.BufferGeometry
  >();
  const textureLoader = createUniverseTextureLoader();
  const worldArtwork = createWorldArtwork(scene, camera, textureLoader, () => {
    if (!destroyed && !contextLost) requestRender();
  });
  const listeners = new Set<RuntimeFrameListener>();
  const earthFrameListeners = new Set<
    (time: number, delta: number, automaticMotion?: boolean) => void
  >();
  const frameLog: UniverseRuntimeSnapshot[] = [];
  const anchorObjects = new Map<string, THREE.Vector3>();
  const anchorBounds = new Map<string, THREE.Box3>([
    ["earth", worldBox(EARTH_POSITION, EARTH_RADIUS)],
    [
      "planet",
      worldBox(
        ALIEN_PLANET_POSITION,
        ALIEN_PLANET_SCALE / 2,
        ALIEN_PLANET_SCALE / 2,
        0.5,
      ),
    ],
    ["about", worldBox(ABOUT_NEBULA_POSITION, 9, 6, 2)],
    ["projects", worldBox(PROJECT_FIELD_POSITION, 7, 5, 4)],
  ]);
  Object.entries(WORLD_ANCHORS).forEach(([id, position]) =>
    anchorObjects.set(id, toThreeVector(position)),
  );

  const discTexture = createDiscTexture();
  if (discTexture) resources.add(discTexture);

  const {
    far: farStarCount,
    middle: middleStarCount,
    near: nearStarCount,
  } = universeStarBandCounts(quality.particleCount);
  const farStars = createStarField(farStarCount, "far", discTexture);
  const middleStars = createStarField(
    middleStarCount,
    "middle",
    discTexture,
    quality.projectHaloCount,
  );
  const nearStars = createStarField(nearStarCount, "near", discTexture);
  const dust = createStarField(quality.dustCount, "dust", discTexture);
  [farStars, middleStars, nearStars, dust].forEach((points) => {
    scene.add(points);
    resources.add(points.geometry);
    resources.add(points.material);
  });
  const orbitalDust = createOrbitalDust(PROJECT_FIELD_POSITION);
  scene.add(orbitalDust.points);
  resources.add(orbitalDust.geometry);
  resources.add(orbitalDust.material);

  const constellations = createConstellations(discTexture, projectManifest);
  root?.setAttribute(
    "data-constellation-point-geometry",
    constellations.points.geometry.uuid,
  );
  root?.setAttribute(
    "data-constellation-line-geometry",
    constellations.lines.geometry.uuid,
  );
  scene.add(constellations.lines, constellations.points);
  resources.add(constellations.lines.geometry);
  resources.add(constellations.points.geometry);
  resources.add(constellations.lineMaterial);
  resources.add(constellations.pointMaterial);
  const updateProjectDepth = (
    viewportWidth: number,
    viewportHeight: number,
  ) => {
    const { projectToWorld } = createCompositionFrame(
      "home",
      viewportWidth,
      viewportHeight,
      SCENE_MANIFEST,
    );
    const offset = projectToWorld({ x: 0, y: 0, z: 0 });
    for (const object of [constellations.points, constellations.lines]) {
      object.scale.setScalar(6);
      object.position.set(offset.x, offset.y, offset.z);
    }
    const origin = projectToWorld(PROJECT_FIELD_POSITION);
    orbitalDust.points.position.set(origin.x, origin.y, origin.z);
    orbitalDust.points.scale.setScalar(6);
    constellations.anchors.forEach((point, id) =>
      anchorObjects.set(id, toThreeVector(projectToWorld(point))),
    );
    constellations.bounds.forEach((bounds, id) =>
      anchorBounds.set(
        id,
        new THREE.Box3(
          toThreeVector(projectToWorld(bounds.min)),
          toThreeVector(projectToWorld(bounds.max)),
        ),
      ),
    );
  };
  updateProjectDepth(innerWidth, innerHeight);

  const trailGeometry = new THREE.BufferGeometry();
  const trailPositions = new Float32Array(quality.trailCount * 6);
  const trailAnchors = new Float32Array(quality.trailCount * 3);
  const nearPosition = nearStars.geometry.getAttribute("position");
  const dustPosition = dust.geometry.getAttribute("position");
  for (let index = 0; index < quality.trailCount; index += 1) {
    const source = index < nearPosition.count ? nearPosition : dustPosition;
    const sourceIndex =
      index < nearPosition.count
        ? index
        : (index - nearPosition.count) % source.count;
    const x = source.getX(sourceIndex);
    const y = source.getY(sourceIndex);
    const z = source.getZ(sourceIndex);
    trailAnchors.set([x, y, z], index * 3);
    trailPositions.set([x, y, z, x, y, z], index * 6);
  }
  trailGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trailPositions, 3),
  );
  const trailMaterial = new THREE.LineBasicMaterial({
    color: "#b4a9cb",
    opacity: 0,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const trails = new THREE.LineSegments(trailGeometry, trailMaterial);
  trails.renderOrder = 5;
  scene.add(trails);
  resources.add(trailGeometry);
  resources.add(trailMaterial);

  const bodies = createCelestialBodies(
    scene,
    camera,
    textureLoader,
    root,
    () => {
      if (!destroyed && !contextLost) requestRender();
    },
  );
  const shootingStar = createShootingStar(scene, camera);
  root?.setAttribute(
    "data-about-ray-count",
    String(quality.tier === "high" ? 30 : 18),
  );

  const earthTextureState = createEarthTexture(root, quality.tier);
  root?.setAttribute(
    "data-earth-texture-size",
    quality.tier === "high" ? "4096x2048" : "2048x1024",
  );
  root?.setAttribute(
    "data-earth-geometry",
    quality.tier === "high" ? "128x96" : "64x48",
  );
  const earthTexture = earthTextureState?.texture ?? null;
  if (earthTexture) {
    earthTexture.anisotropy = Math.max(
      1,
      Math.min(
        earthTexture.anisotropy,
        renderer.capabilities.getMaxAnisotropy(),
      ),
    );
    resources.add(earthTexture);
  }
  const earthGroup = new THREE.Group();
  earthGroup.position.copy(toThreeVector(EARTH_POSITION));
  earthGroup.name = "persistent-earth";
  const earthGeometry = new THREE.SphereGeometry(
    EARTH_RADIUS,
    quality.tier === "high" ? 128 : 64,
    quality.tier === "high" ? 96 : 48,
  );
  const celestialEarth = earthTexture
    ? createCelestialEarthMaterial(
        earthTexture,
        textureLoader,
        quality.tier === "high" && innerWidth > 700 ? 2048 : 1024,
        UNIVERSE_EARTH_PALETTE,
      )
    : null;
  const earthUniforms = celestialEarth?.uniforms ?? null;
  const earthMaterial =
    celestialEarth?.material ??
    new THREE.MeshBasicMaterial({
      color: 0xdce9ec,
    });
  const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  earthMesh.name = "earth-surface";
  earthGroup.add(earthMesh);
  scene.add(earthGroup);
  const countryOverlays = createEarthCountryOverlays(
    earthGroup,
    earthGeometry,
    renderer,
    quality.tier === "high",
  );
  resources.add(earthGeometry);
  if (!celestialEarth) resources.add(earthMaterial);
  const earthClouds = celestialEarth
    ? new THREE.Mesh(earthGeometry, celestialEarth.cloudMaterial)
    : null;
  if (earthClouds) {
    earthClouds.name = "earth-cloud-shell";
    earthClouds.scale.setScalar(1.008);
    earthGroup.add(earthClouds);
  }

  const atmosphereMaterial = createEarthAtmosphereMaterial();
  const atmosphereMesh = new THREE.Mesh(earthGeometry, atmosphereMaterial);
  atmosphereMesh.name = "earth-atmosphere";
  atmosphereMesh.scale.setScalar(1.02);
  earthGroup.add(atmosphereMesh);
  resources.add(atmosphereMaterial);

  // Several particle/line objects store world coordinates in their geometry.
  // Sorting their object origins would put every constellation at (0, 0, 0)
  // and incorrectly paint its stars over the nearest cloud banks.
  const transparentObjects: THREE.Object3D[] = [
    farStars,
    middleStars,
    nearStars,
    dust,
    orbitalDust.points,
    constellations.lines,
    constellations.points,
    trails,
    earthMesh,
    ...(earthClouds ? [earthClouds] : []),
    atmosphereMesh,
  ];
  const transparentCenters = transparentObjects.map((object) => {
    const localCenter = new THREE.Vector3();
    if (
      "geometry" in object &&
      object.geometry instanceof THREE.BufferGeometry
    ) {
      object.geometry.computeBoundingSphere();
      if (object.geometry.boundingSphere)
        localCenter.copy(object.geometry.boundingSphere.center);
    }
    return { object, localCenter };
  });
  const sortCenter = new THREE.Vector3();
  const orderTransparentObjects = () => {
    transparentCenters.forEach(({ object, localCenter }, index) => {
      object.updateWorldMatrix(true, false);
      sortCenter
        .copy(localCenter)
        .applyMatrix4(object.matrixWorld)
        .applyMatrix4(camera.matrixWorldInverse);
      object.renderOrder = translucentRenderOrder(-sortCenter.z, index);
    });
  };

  let activeScene: UniverseSceneId = "home";
  let currentPose: CameraPose = CAMERA_ANCHORS.home;
  let flight: RuntimeFlight | null = null;
  let currentEmphasis: SceneEmphasis = sceneEmphasisFor("home");
  let auditBlend: Readonly<{
    from: UniverseSceneId;
    to: UniverseSceneId;
    progress: number;
    timing: CameraFlightTiming;
  }> | null = null;
  let flightSequence = 0;
  let frame = 0;
  let destroyed = false;
  let contextLost = false;
  let documentVisible = !document.hidden;
  let suspended = false;
  let pausedAt: number | null = documentVisible ? null : performance.now();
  let width = 1;
  let height = 1;
  let viewport: CanvasViewport = { left: 0, top: 0, width: 1, height: 1 };
  let renderPixelRatio = quality.pixelRatio;
  const adaptiveQuality = createAdaptiveQuality();
  let visibleParticleCount = quality.particleCount;
  let visibleDustCount = quality.dustCount;
  let visibleOrbitalDustCount = 320;
  let lastTime = performance.now();
  const cadence = createFrameCadence();
  let rendering = false;
  let renderRequested = true;
  const auditEnabled = new URLSearchParams(location.search).has(
    "universeAudit",
  );
  let captureFrameLog = auditEnabled;
  let measuredFlight: RuntimeFlight | null = null;
  let lastFlightFrame = 0;
  const flightIntervals: number[] = [];
  if (auditEnabled && root) {
    root.dataset.universeAudit = "true";
    const gl = renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(
      gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
    );
    root.dataset.rendererHardware = String(
      !/swiftshader|llvmpipe|software|basic render/i.test(name),
    );
  }
  const projectedAnchorCache = new Map<string, UniverseProjection | null>();
  let interactionTarget: string | null = null;
  let auditEffectTime: number | null = null;
  let currentEffectSeconds = 0;
  let elapsedEffectMs = 0;
  let artworkReady = false;
  const currentFlightTangent = new THREE.Vector3();
  let currentFlightProgress = 0;
  let earthRotation: AtlasEarthRotation = DEFAULT_EARTH_ROTATION;
  let earthTransformDirty = true;
  let earthInteractionEnabled = false;
  let activeEarthPointer: number | null = null;
  let countryHandoffProgress = 0;
  let earthSceneOpacity = 1;
  let earthSceneOffset: readonly [number, number] = [0, 0];
  let earthAura = 0;
  let constellationPulse = 0;
  let nebulaActivity = 0;
  let shootingStarActive = false;
  const interactionStrength = { earth: 0, about: 0, projects: 0 };
  let emphasizedCountrySlug: string | null = null;
  const raycaster = new THREE.Raycaster();

  const writeDiagnostic = (name: string, value: string) => {
    if (root && root.dataset[name] !== value) root.dataset[name] = value;
  };

  const updateDiagnostics = (progress?: number) => {
    if (!root) return;
    writeDiagnostic("rendererType", contextLost ? "fallback" : "webgl");
    writeDiagnostic(
      "webglReady",
      String(!contextLost && root.dataset.rendererReady === "true"),
    );
    writeDiagnostic("qualityTier", quality.tier);
    writeDiagnostic("performanceScale", adaptiveQuality.scale.toFixed(2));
    writeDiagnostic("earthMeshCount", contextLost ? "0" : "1");
    writeDiagnostic("earthInteraction", String(earthInteractionEnabled));
    writeDiagnostic("earthRotation", earthRotation.join(","));
    writeDiagnostic("interactionTarget", interactionTarget ?? "");
    writeDiagnostic("projectCount", String(projectIds.length));
    writeDiagnostic("loadedCloudCount", String(worldArtwork.loadedCount()));
    writeDiagnostic("artworkReady", String(artworkReady));
    writeDiagnostic("artworkFailedCount", String(worldArtwork.failedCount()));
    writeDiagnostic("trailCount", String(quality.trailCount));
    writeDiagnostic("trailOpacity", trailMaterial.opacity.toFixed(4));
    writeDiagnostic("earthSceneOpacity", earthSceneOpacity.toFixed(4));
    writeDiagnostic(
      "earthSceneOffset",
      earthSceneOffset.map((value) => value.toFixed(4)).join(","),
    );
    writeDiagnostic("earthAura", earthAura.toFixed(4));
    writeDiagnostic("constellationPulse", constellationPulse.toFixed(4));
    writeDiagnostic("nebulaActivity", nebulaActivity.toFixed(4));
    writeDiagnostic(
      "cameraPosition",
      [currentPose.position.x, currentPose.position.y, currentPose.position.z]
        .map((value) => value.toFixed(4))
        .join(","),
    );
    writeDiagnostic(
      "cameraTarget",
      [currentPose.target.x, currentPose.target.y, currentPose.target.z]
        .map((value) => value.toFixed(4))
        .join(","),
    );
    writeDiagnostic("cameraFov", currentPose.fov.toFixed(3));
    if (flight) {
      const flightProgress = progress ?? currentFlightProgress;
      writeDiagnostic("flightFrom", flight.fromScene);
      writeDiagnostic("flightTo", flight.toScene);
      writeDiagnostic("flightProgress", flightProgress.toFixed(4));
      writeDiagnostic(
        "flightMotionProgress",
        universeFlightMotionProgress(flightProgress, flight.timing).toFixed(4),
      );
      writeDiagnostic("cameraFlight", `${flight.fromScene}-${flight.toScene}`);
    } else {
      delete root.dataset.flightFrom;
      delete root.dataset.flightTo;
      delete root.dataset.flightProgress;
      delete root.dataset.flightMotionProgress;
      delete root.dataset.cameraFlight;
    }
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, bounds.width);
    const nextHeight = Math.max(1, bounds.height);
    viewport = {
      left: bounds.left,
      top: bounds.top,
      width: nextWidth,
      height: nextHeight,
    };
    const nextPixelRatio =
      universeRenderPixelRatio(nextWidth, nextHeight, quality.pixelRatio) *
      adaptiveQuality.scale;
    if (
      nextWidth === width &&
      nextHeight === height &&
      nextPixelRatio === renderPixelRatio
    )
      return;
    width = nextWidth;
    height = nextHeight;
    updateProjectDepth(width, height);
    renderPixelRatio = nextPixelRatio;
    if (contextLost) {
      // Continue responsive DOM projection without touching the lost GL
      // context, loading textures or scheduling an animation frame.
      camera.aspect = width / height;
      currentPose = resolveCameraPose(activeScene, width, height);
      currentEmphasis = sceneEmphasisFor(activeScene);
      camera.updateProjectionMatrix();
      applyPose(currentPose);
      renderRequested = false;
      return;
    }
    visibleOrbitalDustCount = Math.round(
      (width <= 700 ? 120 : 320) * adaptiveQuality.scale ** 2,
    );
    orbitalDust.geometry.setDrawRange(0, visibleOrbitalDustCount);
    orbitalDust.material.uniforms.uPixelRatio.value = renderPixelRatio;
    void worldArtwork.select(width);
    artworkReady = worldArtwork.isReady();
    writeDiagnostic("artworkReady", String(artworkReady));
    renderer.setPixelRatio(renderPixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!flight && !auditBlend)
      currentPose = resolveCameraPose(activeScene, width, height);
    const pointScale = height * renderPixelRatio * 0.5;
    [farStars, middleStars, nearStars, dust].forEach((points) => {
      points.material.uniforms.uViewportHeight.value = pointScale;
    });
    constellations.pointMaterial.uniforms.uPixelRatio.value = renderPixelRatio;
    projectedAnchorCache.clear();
    renderRequested = true;
  };

  const applyPose = (pose: CameraPose) => {
    const position = toThreeVector(pose.position);
    const target = toThreeVector(pose.target);
    camera.position.copy(position);
    if (camera.fov !== pose.fov) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target);
    camera.updateMatrixWorld();
    projectedAnchorCache.clear();
    earthTransformDirty = true;
  };

  const orientEarth = () => {
    if (!earthTransformDirty) return;
    const basePosition = toThreeVector(EARTH_POSITION);
    const viewRight = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const viewUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const cameraBase = basePosition
      .clone()
      .applyMatrix4(camera.matrixWorldInverse);
    const baseDepth = Math.max(EARTH_RADIUS * 1.2, -cameraBase.z);
    const halfHeight =
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * baseDepth;
    const halfWidth = halfHeight * Math.max(1, camera.aspect);
    earthGroup.position
      .copy(basePosition)
      .addScaledVector(
        viewRight,
        (halfWidth + EARTH_RADIUS * 1.8) * earthSceneOffset[0],
      )
      .addScaledVector(
        viewUp,
        -(halfHeight + EARTH_RADIUS * 1.8) * earthSceneOffset[1],
      );
    const centerCoordinate: AtlasLongitudeLatitude = [
      -earthRotation[0],
      -earthRotation[1],
    ];
    const centerVectorTuple = longitudeLatitudeToVector3(centerCoordinate);
    const centerVector = new THREE.Vector3(...centerVectorTuple).normalize();
    const northVector = new THREE.Vector3(
      ...longitudeLatitudeToVector3([centerCoordinate[0], 90]),
    );
    const facing = camera.position.clone().sub(earthGroup.position).normalize();
    const alignCenter = new THREE.Quaternion().setFromUnitVectors(
      centerVector,
      facing,
    );
    const currentNorth = northVector
      .applyQuaternion(alignCenter)
      .projectOnPlane(facing)
      .normalize();
    const desiredNorth = camera.up
      .clone()
      .applyQuaternion(camera.quaternion)
      .projectOnPlane(facing)
      .normalize();
    const cross = currentNorth.clone().cross(desiredNorth);
    const signedAngle = Math.atan2(
      cross.dot(facing),
      clamp(currentNorth.dot(desiredNorth), -1, 1),
    );
    const twist = new THREE.Quaternion().setFromAxisAngle(facing, signedAngle);
    const roll = new THREE.Quaternion().setFromAxisAngle(
      facing,
      THREE.MathUtils.degToRad(earthRotation[2]),
    );
    earthGroup.quaternion.copy(roll.multiply(twist).multiply(alignCenter));
    const handoffScale = 1 + countryHandoffProgress * 0.58;
    earthGroup.scale.setScalar(handoffScale);
    const surfaceOpacity =
      earthSceneOpacity * (1 - countryHandoffProgress * 0.96);
    if (earthUniforms) earthUniforms.uOpacity.value = surfaceOpacity;
    else earthMaterial.opacity = surfaceOpacity;
    earthGroup.visible = surfaceOpacity > 0.001;
    atmosphereMesh.scale.setScalar(1.02 + earthAura * 0.004);
    const atmospherePulse = reducedMotion.matches
      ? 1
      : 0.98 + Math.sin(currentEffectSeconds * 1.15) * 0.02 * earthAura;
    atmosphereMaterial.uniforms.uOpacity.value =
      (0.48 + earthAura * 0.32) * surfaceOpacity * atmospherePulse;
    atmosphereMesh.visible = surfaceOpacity > 0.001;
    earthGroup.updateMatrixWorld(true);
    earthTransformDirty = false;
    projectedAnchorCache.delete("earth");
  };

  const updateWorldEmphasis = (time: number, deltaMs = 0) => {
    const transition = flight
      ? {
          from: flight.fromScene,
          to: flight.toScene,
          progress: universeFlightMotionProgress(
            clamp((time - flight.startedAt) / flight.duration),
            flight.timing,
          ),
        }
      : auditBlend
        ? {
            ...auditBlend,
            progress: universeFlightMotionProgress(
              auditBlend.progress,
              auditBlend.timing,
            ),
          }
        : null;
    const blendProgress = transition?.progress ?? 0;
    const sceneEmphasis = (sceneId: UniverseSceneId) =>
      flight
        ? mix(
            flight.fromEmphasis[sceneId],
            sceneId === flight.toScene ? 1 : 0,
            blendProgress,
          )
        : transition
          ? mix(
              transition.from === sceneId ? 1 : 0,
              transition.to === sceneId ? 1 : 0,
              blendProgress,
            )
          : activeScene === sceneId
            ? 1
            : 0;
    const homeEmphasis = sceneEmphasis("home");
    const aboutEmphasis = sceneEmphasis("about");
    const projectEmphasis = sceneEmphasis("projects");
    const travelEmphasis = sceneEmphasis("travel");
    currentEmphasis = {
      home: homeEmphasis,
      about: aboutEmphasis,
      projects: projectEmphasis,
      travel: travelEmphasis,
    };
    const motionTime = reducedMotion.matches
      ? 0
      : (auditEffectTime ?? elapsedEffectMs);
    const seconds = motionTime / 1_000;
    currentEffectSeconds = seconds;
    const ambient = (Object.keys(currentEmphasis) as UniverseSceneId[]).reduce(
      (value, scene) => ({
        nebula:
          value.nebula +
          currentEmphasis[scene] * AMBIENT_PROFILES[scene].nebula,
        stars:
          value.stars + currentEmphasis[scene] * AMBIENT_PROFILES[scene].stars,
        dust:
          value.dust + currentEmphasis[scene] * AMBIENT_PROFILES[scene].dust,
      }),
      { nebula: 0, stars: 0, dust: 0 },
    );
    for (const id of ["earth", "about", "projects"] as const) {
      const target = interactionTarget === id ? 1 : 0;
      interactionStrength[id] = easeInteraction(
        interactionStrength[id],
        target,
        deltaMs,
        reducedMotion.matches || auditEffectTime !== null,
      );
    }
    bodies.update(
      motionTime,
      width,
      reducedMotion.matches,
      adaptiveQuality.scale,
      aboutEmphasis,
      projectEmphasis,
    );
    shootingStarActive = shootingStar.update(
      motionTime,
      width,
      reducedMotion.matches,
      Boolean(flight || auditBlend),
      auditEffectTime !== null,
    );
    writeDiagnostic("bodyCount", String(bodies.count()));
    writeDiagnostic("shootingStarActive", String(shootingStarActive));
    orbitalDust.material.uniforms.uTime.value = seconds;
    orbitalDust.material.uniforms.uOpacity.value = ambient.dust;
    orbitalDust.points.rotation.z = -0.31 + Math.sin(seconds * 0.003) * 0.045;
    orbitalDust.points.rotation.y = Math.sin(seconds * 0.002) * 0.028;
    const focusedProject = interactionTarget?.startsWith("project:")
      ? (constellations.projectIndices.get(interactionTarget.slice(8)) ?? -1)
      : -1;
    const constellationEmphasis = clamp(
      projectEmphasis +
        homeEmphasis * 0.12 +
        interactionStrength.projects * 0.2,
    );
    [farStars, middleStars, nearStars, dust].forEach((points) => {
      points.material.uniforms.uTime.value = seconds;
    });
    middleStars.material.uniforms.uProjectEmphasis.value = projectEmphasis;
    farStars.material.uniforms.uOpacity.value = 0.58 + ambient.stars * 0.35;
    dust.material.uniforms.uOpacity.value = 0.2 + ambient.dust * 0.18;
    constellations.pointMaterial.uniforms.uTime.value = seconds;
    constellations.pointMaterial.uniforms.uEmphasis.value =
      constellationEmphasis;
    constellations.pointMaterial.uniforms.uFocusedProject.value =
      focusedProject;
    constellations.pointMaterial.uniforms.uFieldInteraction.value =
      interactionStrength.projects;
    constellations.lineMaterial.uniforms.uTime.value = seconds;
    constellations.lineMaterial.uniforms.uEmphasis.value =
      constellationEmphasis;
    constellations.lineMaterial.uniforms.uFocusedProject.value = focusedProject;
    constellations.lineMaterial.uniforms.uFieldInteraction.value =
      interactionStrength.projects;
    constellationPulse = universeConstellationPulse(
      motionTime,
      projectEmphasis,
      reducedMotion.matches,
    );
    earthSceneOpacity = 1;
    earthSceneOffset = [0, 0];
    earthAura =
      homeEmphasis *
        (0.38 + (reducedMotion.matches ? 0 : Math.sin(seconds * 0.75) * 0.09)) +
      interactionStrength.earth * 1.1;
    if (earthUniforms) {
      earthUniforms.uTravelMix.value = travelEmphasis;
      earthUniforms.uInteraction.value = earthAura;
    }
    celestialEarth?.update(
      motionTime,
      earthSceneOpacity * (1 - countryHandoffProgress * 0.96),
      travelEmphasis,
    );
    nebulaActivity = ambient.nebula + interactionStrength.about * 1.0;
    const trailEnvelope =
      flight || auditBlend
        ? universeTrailEnvelope(currentFlightProgress, reducedMotion.matches)
        : 0;
    const trailAttribute = trailGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    if (trailEnvelope > 0)
      for (let index = 0; index < quality.trailCount; index += 1) {
        const anchorOffset = index * 3;
        const lineOffset = index * 2;
        const x = trailAnchors[anchorOffset];
        const y = trailAnchors[anchorOffset + 1];
        const z = trailAnchors[anchorOffset + 2];
        const [trailStart, trailEnd] = universeTrailSegment(
          { x, y, z },
          {
            x: currentFlightTangent.x,
            y: currentFlightTangent.y,
            z: currentFlightTangent.z,
          },
          currentFlightProgress,
          0.68 + (index % 7) * 0.055,
        );
        trailAttribute.setXYZ(
          lineOffset,
          trailStart.x,
          trailStart.y,
          trailStart.z,
        );
        trailAttribute.setXYZ(
          lineOffset + 1,
          trailEnd.x,
          trailEnd.y,
          trailEnd.z,
        );
      }
    trailAttribute.needsUpdate = trailEnvelope > 0;
    trailMaterial.opacity = 0.34 * trailEnvelope;
    if (root) writeDiagnostic("trailOpacity", trailMaterial.opacity.toFixed(4));
    if (root) {
      writeDiagnostic("earthSceneOpacity", earthSceneOpacity.toFixed(4));
      writeDiagnostic(
        "earthSceneOffset",
        earthSceneOffset.map((value) => value.toFixed(4)).join(","),
      );
      writeDiagnostic("earthAura", earthAura.toFixed(4));
      writeDiagnostic("constellationPulse", constellationPulse.toFixed(4));
      writeDiagnostic("nebulaActivity", nebulaActivity.toFixed(4));
    }
    if (!reducedMotion.matches) {
      farStars.rotation.z = Math.sin(motionTime * 0.000025) * 0.006;
      middleStars.rotation.y = Math.sin(motionTime * 0.00004) * 0.01;
      dust.rotation.z = Math.sin(motionTime * 0.00008) * 0.014;
    }
  };

  const projectAnchor = (id: string): UniverseProjection | null => {
    if (destroyed || contextLost) return null;
    if (id === "about") {
      const plane = resolveWorldPlane(
        WORLD_PLANES.find((plane) => plane.id === "nebula")!,
        width,
        height,
      );
      return projectBillboardPlane(
        currentPose,
        plane.position,
        plane.width,
        plane.height,
        viewport,
      );
    }
    if (projectedAnchorCache.has(id))
      return projectedAnchorCache.get(id) ?? null;
    const point = id === "earth" ? earthGroup.position : anchorObjects.get(id);
    if (!point || width <= 0 || height <= 0) return null;
    const projected = point.clone().project(camera);
    const cameraPoint = point.clone().applyMatrix4(camera.matrixWorldInverse);
    const depth = -cameraPoint.z;
    if (depth <= 0.08) return null;
    const focalLength = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const worldBounds = anchorBounds.get(id);
    let bounds = {
      left: ((projected.x + 1) / 2) * width - 22,
      top: ((1 - projected.y) / 2) * height - 22,
      width: 44,
      height: 44,
    };
    if (id === "earth") {
      const diameter =
        (EARTH_RADIUS * 2 * focalLength * earthGroup.scale.x) / depth;
      const centerX = ((projected.x + 1) / 2) * width;
      const centerY = ((1 - projected.y) / 2) * height;
      bounds = {
        left: centerX - diameter / 2,
        top: centerY - diameter / 2,
        width: diameter,
        height: diameter,
      };
    } else if (worldBounds && !worldBounds.isEmpty()) {
      const corners = [
        [worldBounds.min.x, worldBounds.min.y, worldBounds.min.z],
        [worldBounds.min.x, worldBounds.min.y, worldBounds.max.z],
        [worldBounds.min.x, worldBounds.max.y, worldBounds.min.z],
        [worldBounds.min.x, worldBounds.max.y, worldBounds.max.z],
        [worldBounds.max.x, worldBounds.min.y, worldBounds.min.z],
        [worldBounds.max.x, worldBounds.min.y, worldBounds.max.z],
        [worldBounds.max.x, worldBounds.max.y, worldBounds.min.z],
        [worldBounds.max.x, worldBounds.max.y, worldBounds.max.z],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z).project(camera));
      const projectedX = corners.map((corner) => ((corner.x + 1) / 2) * width);
      const projectedY = corners.map((corner) => ((1 - corner.y) / 2) * height);
      const left = Math.min(...projectedX);
      const right = Math.max(...projectedX);
      const top = Math.min(...projectedY);
      const bottom = Math.max(...projectedY);
      const boundsWidth = Math.max(44, right - left);
      const boundsHeight = Math.max(44, bottom - top);
      bounds = {
        left: (left + right - boundsWidth) / 2,
        top: (top + bottom - boundsHeight) / 2,
        width: boundsWidth,
        height: boundsHeight,
      };
    }
    const result = {
      x: ((projected.x + 1) / 2) * width,
      y: ((1 - projected.y) / 2) * height,
      scale: focalLength / depth,
      depth,
      bounds,
    };
    projectedAnchorCache.set(id, result);
    return result;
  };

  const getSnapshot = (
    includeProjectedAnchors = true,
  ): UniverseRuntimeSnapshot => {
    const flightProgress = flight ? currentFlightProgress : null;
    const flightMotionProgress =
      flight && flightProgress !== null
        ? universeFlightMotionProgress(flightProgress, flight.timing)
        : null;
    return {
      rendererType: destroyed
        ? "destroyed"
        : contextLost
          ? "fallback"
          : "webgl",
      webglReady:
        !destroyed && !contextLost && root?.dataset.rendererReady === "true",
      artworkReady: artworkReady && !destroyed && !contextLost,
      effectTimeMs: currentEffectSeconds * 1_000,
      sceneWeights: { ...currentEmphasis },
      activeScene,
      interactionTarget,
      camera: {
        position: vectorTuple(camera.position),
        quaternion: [
          camera.quaternion.x,
          camera.quaternion.y,
          camera.quaternion.z,
          camera.quaternion.w,
        ],
        fov: camera.fov,
      },
      flight: flight
        ? {
            sequence: flight.sequence,
            from: flight.fromScene,
            to: flight.toScene,
            progress: flightProgress ?? 0,
            motionProgress: flightMotionProgress ?? 0,
            durationMs: flight.duration,
          }
        : null,
      effects: {
        earthOpacity: earthSceneOpacity,
        earthOffset: earthSceneOffset,
        earthAura,
        constellationPulse,
        nebulaActivity,
        shootingStarActive,
        bodyCount: bodies.count(),
      },
      quality: {
        tier: quality.tier,
        pixelRatio: renderPixelRatio,
        drawCalls: contextLost ? 0 : renderer.info.render.calls,
        particleCount: visibleParticleCount,
        dustCount: visibleDustCount + visibleOrbitalDustCount,
        projectHaloCount: quality.projectHaloCount,
        nebulaLayerCount: worldArtwork.visibleCount(),
        trailCount: quality.trailCount,
      },
      projectedAnchors: includeProjectedAnchors
        ? {
            earth: projectAnchor("earth"),
            planet: projectAnchor("planet"),
            about: projectAnchor("about"),
            projects: projectAnchor("projects"),
            ...Object.fromEntries(
              projectIds.map((projectId) => [
                `project:${projectId}`,
                projectAnchor(`project:${projectId}`),
              ]),
            ),
          }
        : {},
      lifecycle: {
        contextLost,
        frameScheduled: frame !== 0,
        suspended,
        destroyed,
      },
    };
  };

  const emitFrame = () => {
    if (listeners.size === 0 && !(flight && captureFrameLog)) return;
    const snapshot = getSnapshot(captureFrameLog);
    if (flight && captureFrameLog) {
      frameLog.push(snapshot);
      if (frameLog.length > MAX_FRAME_LOG) frameLog.shift();
    }
    listeners.forEach((listener) => listener(snapshot));
  };

  const renderOnce = (time: number, delta: number) => {
    if (destroyed || suspended || !documentVisible) return;
    if (contextLost) {
      applyPose(currentPose);
      earthSceneOpacity = 1;
      earthSceneOffset = [0, 0];
      renderRequested = false;
      updateDiagnostics();
      emitFrame();
      return;
    }
    rendering = true;
    renderRequested = false;
    if (!reducedMotion.matches && auditEffectTime === null)
      elapsedEffectMs += Math.max(0, delta);
    // Travel's atlas owns rotation while interactive; Home uses the same clock.
    if (
      activeScene === "home" &&
      !flight &&
      !auditBlend &&
      !earthInteractionEnabled &&
      !reducedMotion.matches &&
      auditEffectTime === null
    ) {
      earthRotation = [
        earthRotation[0] + (delta / 1_000) * ATLAS_SPIN_DEGREES_PER_SECOND,
        earthRotation[1],
        earthRotation[2],
      ];
      earthTransformDirty = true;
    }
    applyPose(currentPose);
    updateWorldEmphasis(time, delta);
    orientEarth();
    earthFrameListeners.forEach((listener) =>
      listener(time, delta, auditEffectTime === null),
    );
    if (
      countryOverlays.update(
        delta,
        reducedMotion.matches,
        earthInteractionEnabled
          ? earthSceneOpacity * (1 - countryHandoffProgress)
          : 0,
      )
    )
      requestRender();
    writeDiagnostic(
      "earthBaseTextureVersion",
      String(earthTexture?.version ?? 0),
    );
    orientEarth();
    worldArtwork.update(
      currentEffectSeconds * 1_000,
      worldArtwork.isReady(),
      currentEmphasis,
      nebulaActivity,
      reducedMotion.matches,
    );
    orderTransparentObjects();
    countryOverlays.order(earthMesh.renderOrder + 0.001);
    renderer.render(scene, camera);
    if (destroyed || contextLost) {
      rendering = false;
      return;
    }
    // Publish only after the complete replacement frame exists in the canvas.
    artworkReady =
      worldArtwork.isReady() && root?.dataset.rendererReady === "true";
    writeDiagnostic("artworkReady", String(artworkReady));
    writeDiagnostic("loadedCloudCount", String(worldArtwork.loadedCount()));
    writeDiagnostic("artworkFailedCount", String(worldArtwork.failedCount()));
    writeDiagnostic("worldPlateCount", String(worldArtwork.visibleCount()));
    writeDiagnostic("orbitalDustCount", String(visibleOrbitalDustCount));
    writeDiagnostic("drawCallBudget", width <= 700 ? "32" : "44");
    emitFrame();
    rendering = false;
    if (renderRequested) startFrame();
  };

  const completeFlight = (completed: RuntimeFlight) => {
    if (flight !== completed) return;
    // Observe real journeys only, then reduce decoration at rest. Semantic
    // constellations, Earth geometry, DOM artwork, and camera framing stay intact.
    const previousScale = adaptiveQuality.scale;
    const nextScale = adaptiveQuality.observeFlight(flightIntervals);
    if (auditEnabled && root && flightIntervals.length) {
      const ordered = [...flightIntervals].sort((a, b) => a - b);
      const mean =
        ordered.reduce((sum, value) => sum + value, 0) / ordered.length;
      root.dataset.flightMetrics = JSON.stringify({
        from: completed.fromScene,
        to: completed.toScene,
        frames: ordered.length,
        meanFrameMs: Number(mean.toFixed(2)),
        p95FrameMs: Number(
          ordered[Math.floor(ordered.length * 0.95)].toFixed(2),
        ),
        fps: Number((1000 / mean).toFixed(1)),
        hardware: root.dataset.rendererHardware === "true",
      });
    }
    flight = null;
    currentFlightProgress = 0;
    currentFlightTangent.set(0, 0, 0);
    currentPose = resolveCameraPose(completed.toScene, width, height);
    activeScene = completed.toScene;
    currentEmphasis = sceneEmphasisFor(completed.toScene);
    if (nextScale !== previousScale) {
      const decorationScale = nextScale ** 2;
      [farStars, middleStars, nearStars, dust].forEach((points) => {
        points.geometry.setDrawRange(
          0,
          Math.floor(
            points.geometry.getAttribute("position").count * decorationScale,
          ),
        );
      });
      visibleParticleCount = [farStars, middleStars, nearStars].reduce(
        (count, points) => count + points.geometry.drawRange.count,
        0,
      );
      visibleDustCount = dust.geometry.drawRange.count;
      resize();
    }
    applyPose(currentPose);
    updateDiagnostics();
    // setSize clears the backing buffer. Paint its replacement in this task so
    // the browser never presents an empty Earth/star layer between frames.
    if (nextScale !== previousScale) renderOnce(performance.now(), 0);
    completed.resolve();
  };

  const tick = (time: number) => {
    frame = 0;
    if (destroyed || contextLost || suspended || !documentVisible) return;
    const targetFps =
      flight || earthInteractionEnabled || interactionTarget ? 60 : 30;
    if (!cadence.shouldRender(time, targetFps)) {
      frame = requestAnimationFrame(tick);
      return;
    }
    const delta = Math.min(64, Math.max(0, time - lastTime));
    lastTime = time;
    let completed: RuntimeFlight | null = null;
    if (flight) {
      if (measuredFlight !== flight) {
        measuredFlight = flight;
        flightIntervals.length = 0;
      } else if (lastFlightFrame > 0)
        flightIntervals.push(time - lastFlightFrame);
      lastFlightFrame = time;
      const progress = clamp((time - flight.startedAt) / flight.duration);
      const motionProgress = universeFlightMotionProgress(
        progress,
        flight.timing,
      );
      const sample = sampleCameraFlight(flight.curve, motionProgress);
      currentPose = sample;
      currentFlightProgress = progress;
      currentFlightTangent
        .copy(toThreeVector(sample.tangent))
        .multiplyScalar(
          universeFlightMotionDerivative(progress, flight.timing) /
            flight.duration,
        );
      updateDiagnostics(progress);
      if (progress >= 1) completed = flight;
    }

    renderOnce(time, delta);
    if (completed) completeFlight(completed);
    if (
      !destroyed &&
      !contextLost &&
      !suspended &&
      documentVisible &&
      frame === 0 &&
      shouldScheduleUniverseFrame({
        effectsPinned: auditEffectTime !== null,
        reducedMotion: reducedMotion.matches,
        flight: Boolean(flight),
        renderRequested,
        activeInput: activeEarthPointer !== null,
      })
    )
      frame = requestAnimationFrame(tick);
  };

  const startFrame = () => {
    if (
      frame ||
      rendering ||
      destroyed ||
      contextLost ||
      suspended ||
      !documentVisible
    )
      return;
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const requestRender = () => {
    renderRequested = true;
    startFrame();
  };

  const syncActivity = () => {
    const now = performance.now();
    if (suspended || !documentVisible) {
      activeEarthPointer = null;
      pausedAt ??= now;
      lastFlightFrame = 0;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      return;
    }
    if (pausedAt !== null) {
      if (flight) flight.startedAt += now - pausedAt;
      pausedAt = null;
    }
    cadence.reset();
    if (contextLost) renderOnce(now, 0);
    else requestRender();
  };

  const cancel = () => {
    if (!flight) return;
    const interrupted = flight;
    const progress = clamp(
      ((pausedAt ?? performance.now()) - interrupted.startedAt) /
        interrupted.duration,
    );
    const motionProgress = universeFlightMotionProgress(
      progress,
      interrupted.timing,
    );
    currentPose = sampleCameraFlight(interrupted.curve, motionProgress);
    flight = null;
    currentFlightProgress = 0;
    currentFlightTangent.set(0, 0, 0);
    updateDiagnostics();
    interrupted.resolve();
  };

  const startFlight = (sceneId: UniverseSceneId, duration: number) => {
    if (destroyed) return Promise.resolve();
    auditBlend = null;
    const previousFlight = flight;
    let currentSample: CameraFlightSample | null = null;
    if (previousFlight) {
      const progress = clamp(
        ((pausedAt ?? performance.now()) - previousFlight.startedAt) /
          previousFlight.duration,
      );
      const motionProgress = universeFlightMotionProgress(
        progress,
        previousFlight.timing,
      );
      currentSample = sampleCameraFlight(previousFlight.curve, motionProgress);
      currentPose = currentSample;
      currentFlightTangent
        .copy(toThreeVector(currentSample.tangent))
        .multiplyScalar(
          universeFlightMotionDerivative(progress, previousFlight.timing) /
            previousFlight.duration,
        );
      flight = null;
      previousFlight.resolve();
    }

    if (duration <= 0 || contextLost || reducedMotion.matches) {
      currentPose = resolveCameraPose(sceneId, width, height);
      activeScene = sceneId;
      currentEmphasis = sceneEmphasisFor(sceneId);
      currentFlightProgress = 0;
      currentFlightTangent.set(0, 0, 0);
      updateDiagnostics();
      renderOnce(performance.now(), 0);
      return Promise.resolve();
    }

    const fromScene = previousFlight?.toScene ?? activeScene;
    const timing = resolveCameraFlightTiming(
      fromScene,
      sceneId,
      Boolean(previousFlight),
    );
    const incomingVelocity = previousFlight
      ? currentFlightTangent.clone()
      : null;
    const incomingTangent = incomingVelocity
      ? incomingVelocity.multiplyScalar(duration / timing.startSlope)
      : undefined;
    const curve = createCameraFlight(
      currentPose,
      fromScene,
      sceneId,
      incomingTangent
        ? vectorFromThree(incomingTangent)
        : currentSample?.tangent,
      resolveCameraPose(sceneId, width, height),
    );
    return new Promise<void>((resolve) => {
      currentFlightProgress = 0;
      flight = {
        curve,
        fromScene,
        toScene: sceneId,
        fromEmphasis: { ...currentEmphasis },
        startedAt: pausedAt ?? performance.now(),
        duration,
        timing,
        sequence: ++flightSequence,
        resolve,
      };
      updateDiagnostics(0);
      startFrame();
    });
  };

  const jumpTo = (sceneId: UniverseSceneId) => {
    if (destroyed) return;
    cancel();
    auditBlend = null;
    currentPose = resolveCameraPose(sceneId, width, height);
    activeScene = sceneId;
    currentEmphasis = sceneEmphasisFor(sceneId);
    currentFlightProgress = 0;
    currentFlightTangent.set(0, 0, 0);
    updateDiagnostics();
    applyPose(currentPose);
    renderOnce(performance.now(), 0);
  };

  const resetCountryHandoff = () => {
    if (countryHandoffProgress === 0 && emphasizedCountrySlug === null) {
      delete root?.dataset.earthHandoffProgress;
      delete root?.dataset.earthCountryEmphasis;
      return;
    }
    countryHandoffProgress = 0;
    earthTransformDirty = true;
    emphasizedCountrySlug = null;
    countryOverlays.select(null);
    delete root?.dataset.earthHandoffProgress;
    delete root?.dataset.earthCountryEmphasis;
  };

  const earthBridge: AtlasEarthBridge = {
    subscribeFrame: (listener) => {
      if (destroyed) return () => undefined;
      earthFrameListeners.add(listener);
      return () => earthFrameListeners.delete(listener);
    },
    setInteractionEnabled: (active) => {
      if (destroyed) return;
      if (earthInteractionEnabled === active) return;
      earthInteractionEnabled = active;
      if (!active) activeEarthPointer = null;
      updateDiagnostics();
      requestRender();
    },
    getRotation: () => earthRotation,
    setRotation: (rotation) => {
      if (destroyed) return;
      if (
        rotation.every(
          (value, index) => Math.abs(value - earthRotation[index]) < 0.0000001,
        )
      )
        return;
      earthRotation = [rotation[0], rotation[1], rotation[2]];
      earthTransformDirty = true;
      projectedAnchorCache.delete("earth");
      writeDiagnostic("earthRotation", earthRotation.join(","));
      requestRender();
    },
    projectCoordinate: (coordinate) => {
      if (contextLost || destroyed) return null;
      orientEarth();
      const local = new THREE.Vector3(
        ...longitudeLatitudeToVector3(coordinate),
      ).multiplyScalar(EARTH_RADIUS);
      const world = earthGroup.localToWorld(local.clone());
      const projected = world.clone().project(camera);
      const center = vectorTuple(earthGroup.position);
      const facing = surfacePointFacing(
        vectorTuple(world),
        vectorTuple(camera.position),
        center,
      );
      const cameraPoint = world.clone().applyMatrix4(camera.matrixWorldInverse);
      const bounds = viewport;
      return {
        clientX: bounds.left + ((projected.x + 1) / 2) * bounds.width,
        clientY: bounds.top + ((1 - projected.y) / 2) * bounds.height,
        visible: facing > 0 && projected.z >= -1 && projected.z <= 1,
        facing,
        depth: -cameraPoint.z,
      };
    },
    pickCoordinate: (clientX, clientY) => {
      if (contextLost || destroyed || !earthInteractionEnabled) return null;
      const bounds = viewport;
      if (bounds.width <= 0 || bounds.height <= 0) return null;
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((clientX - bounds.left) / bounds.width) * 2 - 1,
          -((clientY - bounds.top) / bounds.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster.intersectObject(earthMesh, false)[0];
      if (!hit) return null;
      const local = earthGroup.worldToLocal(hit.point.clone()).normalize();
      return vector3ToLongitudeLatitude(vectorTuple(local));
    },
    getGlobeRect: () => {
      if (contextLost || destroyed) return null;
      orientEarth();
      const bounds = viewport;
      const center = earthGroup.position.clone().project(camera);
      const cameraCenter = earthGroup.position
        .clone()
        .applyMatrix4(camera.matrixWorldInverse);
      const depth = -cameraCenter.z;
      if (depth <= EARTH_RADIUS * 0.2) return null;
      const focalLength =
        bounds.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
      const diameter =
        (EARTH_RADIUS * 2 * focalLength * earthGroup.scale.x) / depth;
      const centerX = bounds.left + ((center.x + 1) / 2) * bounds.width;
      const centerY = bounds.top + ((1 - center.y) / 2) * bounds.height;
      return {
        left: centerX - diameter / 2,
        top: centerY - diameter / 2,
        width: diameter,
        height: diameter,
      };
    },
    setCountryFeatures: (features) => {
      if (destroyed) return;
      countryOverlays.setFeatures(features);
      if (root) root.dataset.earthCountryFeatureCount = String(features.length);
    },
    setCountryEmphasis: (slug) => {
      if (destroyed) return;
      if (slug === emphasizedCountrySlug) return;
      emphasizedCountrySlug = slug;
      countryOverlays.select(slug);
      if (root) root.dataset.earthCountryEmphasis = slug ?? "";
      requestRender();
    },
    prepareCountryHandoff: async (_target, signal) =>
      !destroyed && !contextLost && !signal.aborted,
    setCountryHandoffProgress: (progress) => {
      if (destroyed) return;
      countryHandoffProgress = clamp(progress);
      earthTransformDirty = true;
      if (root)
        root.dataset.earthHandoffProgress = countryHandoffProgress.toFixed(4);
      requestRender();
    },
    cancelCountryHandoff: () => {
      if (destroyed) return;
      resetCountryHandoff();
      requestRender();
    },
  };

  const markFallback = (
    reason: "context-lost" | "asset-load" | "shader-compile" = "context-lost",
  ) => {
    if (destroyed || contextLost) return;
    contextLost = true;
    artworkReady = false;
    earthSceneOpacity = 0;
    constellationPulse = 0;
    shootingStarActive = false;
    const fallbackScene = flight?.toScene ?? activeScene;
    cancel();
    auditBlend = null;
    activeScene = fallbackScene;
    currentPose = resolveCameraPose(activeScene, width, height);
    currentEmphasis = sceneEmphasisFor(activeScene);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    canvas.style.visibility = "hidden";
    if (root) {
      root.dataset.rendererType = "fallback";
      root.dataset.webglReady = "false";
      root.dataset.artworkReady = "false";
      root.dataset.rendererFailure = reason;
      delete root.dataset.rendererReady;
      root.dataset.earthMeshCount = "0";
      root.dataset.earthSceneOpacity = "0.0000";
      root.dataset.earthSceneOffset = "0.0000,0.0000";
      root.dataset.earthAura = "0.0000";
      root.dataset.constellationPulse = "0.0000";
      root.dataset.nebulaActivity = "0.0000";
      delete root.dataset.flightMotionProgress;
      delete root.dataset.constellationPointGeometry;
      delete root.dataset.constellationLineGeometry;
    }
    const backdrop = document.querySelector<HTMLElement>(
      "[data-cosmic-backdrop]",
    );
    if (backdrop) backdrop.dataset.universeWebgl = "false";
    root?.dispatchEvent(new CustomEvent("universe:contextlost"));
    renderOnce(performance.now(), 0);
  };

  // Three reports linking failures through this hook, not a rejected compile
  // promise. A failed shader must never count as a completed artwork frame.
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (
    gl,
    program,
    vertexShader,
    fragmentShader,
  ) => {
    if (destroyed || contextLost) return;
    const diagnostic = [
      gl.getProgramInfoLog(program),
      gl.getShaderInfoLog(vertexShader),
      gl.getShaderInfoLog(fragmentShader),
    ]
      .filter(Boolean)
      .join("\n");
    console.error(
      `The universe renderer could not compile its shaders.\n${diagnostic}`,
    );
    markFallback("shader-compile");
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    markFallback();
  };
  const onVisibility = () => {
    documentVisible = !document.hidden;
    syncActivity();
  };
  const onMotionPreference = () => {
    if (!reducedMotion.matches) {
      requestRender();
      return;
    }
    farStars.rotation.z = 0;
    middleStars.rotation.y = 0;
    dust.rotation.z = 0;
    trailMaterial.opacity = 0;
    const activeFlight = flight;
    if (activeFlight) {
      flight = null;
      auditBlend = null;
      currentPose = resolveCameraPose(activeFlight.toScene, width, height);
      activeScene = activeFlight.toScene;
      currentEmphasis = sceneEmphasisFor(activeFlight.toScene);
      currentFlightProgress = 0;
      currentFlightTangent.set(0, 0, 0);
      updateDiagnostics();
    }
    if (!destroyed && !contextLost && documentVisible)
      renderOnce(performance.now(), 0);
    activeFlight?.resolve();
  };

  const onViewportChange = () => {
    if (destroyed) return;
    resize();
    if (contextLost) renderOnce(performance.now(), 0);
    else requestRender();
  };
  const onEarthPointerDown = (event: PointerEvent) => {
    if (
      !earthInteractionEnabled ||
      !(event.target instanceof Element) ||
      !event.target.closest("[data-atlas-canvas]")
    )
      return;
    activeEarthPointer = event.pointerId;
    if (auditEffectTime !== null) requestRender();
  };
  const onEarthPointerEnd = (event: PointerEvent) => {
    if (activeEarthPointer !== event.pointerId) return;
    activeEarthPointer = null;
    // The first release frame lets the atlas start its momentum. Subsequent
    // rotation changes request their own frames until that momentum settles.
    if (auditEffectTime !== null) requestRender();
  };
  const resizeObserver = new ResizeObserver(onViewportChange);
  resizeObserver.observe(canvas);
  window.addEventListener("resize", onViewportChange);
  window.visualViewport?.addEventListener("resize", onViewportChange);
  window.visualViewport?.addEventListener("scroll", onViewportChange);
  canvas.addEventListener("webglcontextlost", onContextLost);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("pointerdown", onEarthPointerDown, true);
  document.addEventListener("pointerup", onEarthPointerEnd, true);
  document.addEventListener("pointercancel", onEarthPointerEnd, true);
  reducedMotion.addEventListener("change", onMotionPreference);
  root?.setAttribute("data-renderer-type", "webgl");
  root?.setAttribute("data-webgl-ready", "false");
  root?.setAttribute("data-artwork-ready", "false");
  root?.setAttribute("data-quality-tier", quality.tier);
  resize();
  applyPose(currentPose);
  orientEarth();
  renderer.render(scene, camera);
  startFrame();

  const ready = Promise.resolve()
    .then(async () => {
      if (destroyed || contextLost) return false;
      const [, physicalEarth] = await Promise.all([
        worldArtwork.select(width),
        celestialEarth?.ready ?? Promise.resolve(false),
      ]);
      if (destroyed || contextLost) return false;
      writeDiagnostic("physicalEarthReady", String(physicalEarth));
      worldArtwork.update(
        currentEffectSeconds * 1_000,
        worldArtwork.isReady(),
        currentEmphasis,
      );
      orderTransparentObjects();
      if (renderer.extensions.has("KHR_parallel_shader_compile"))
        await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
      if (destroyed || contextLost) return false;
      root?.setAttribute("data-renderer-ready", "true");
      root?.setAttribute("data-webgl-ready", "true");
      root?.setAttribute("data-earth-mesh-count", "1");
      const backdrop = document.querySelector<HTMLElement>(
        "[data-cosmic-backdrop]",
      );
      if (backdrop) backdrop.dataset.universeWebgl = "true";
      canvas.style.removeProperty("visibility");
      updateDiagnostics();
      renderOnce(performance.now(), 0);
      return !destroyed && !contextLost;
    })
    .catch(() => {
      markFallback("asset-load");
      return false;
    });

  return {
    ready,
    travelTo: startFlight,
    navigateTo: startFlight,
    retarget: startFlight,
    jumpTo,
    projectAnchor,
    projectPlane: (position, planeWidth, planeHeight) =>
      destroyed
        ? null
        : projectBillboardPlane(
            currentPose,
            position,
            planeWidth,
            planeHeight,
            viewport,
          ),
    suspend: () => {
      if (destroyed || suspended) return;
      suspended = true;
      root?.setAttribute("data-renderer-suspended", "true");
      syncActivity();
    },
    resume: () => {
      if (destroyed) return;
      suspended = false;
      root?.setAttribute("data-renderer-suspended", "false");
      resize();
      syncActivity();
    },
    setInteractionTarget: (target) => {
      if (destroyed || interactionTarget === target) return;
      interactionTarget = target;
      updateDiagnostics();
      requestRender();
    },
    setEffectTime: (timeMs) => {
      auditEffectTime = timeMs === null ? null : Math.max(0, timeMs);
      if (
        auditEffectTime !== null &&
        !flight &&
        activeEarthPointer === null &&
        frame
      ) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      cadence.reset();
      if (!destroyed && !contextLost && documentVisible)
        renderOnce(performance.now(), 0);
      if (auditEffectTime === null && !destroyed && !contextLost)
        requestRender();
    },
    getSnapshot,
    getAtlasEarthBridge: () => (contextLost || destroyed ? null : earthBridge),
    subscribe: (listener) => {
      if (destroyed) return () => undefined;
      listeners.add(listener);
      if (contextLost && !suspended && documentVisible)
        listener(getSnapshot(false));
      return () => listeners.delete(listener);
    },
    seekFlight: (from, to, progress) => {
      cancel();
      const rawProgress = clamp(progress);
      const timing = resolveCameraFlightTiming(from, to);
      const motionProgress = universeFlightMotionProgress(rawProgress, timing);
      auditBlend = { from, to, progress: rawProgress, timing };
      const curve = createCameraFlight(
        resolveCameraPose(from, width, height),
        from,
        to,
        undefined,
        resolveCameraPose(to, width, height),
      );
      const sample = sampleCameraFlight(curve, motionProgress);
      currentPose = sample;
      currentFlightProgress = rawProgress;
      currentFlightTangent.copy(toThreeVector(sample.tangent));
      activeScene = rawProgress >= 1 ? to : from;
      currentEmphasis = {
        home: mix(
          from === "home" ? 1 : 0,
          to === "home" ? 1 : 0,
          motionProgress,
        ),
        about: mix(
          from === "about" ? 1 : 0,
          to === "about" ? 1 : 0,
          motionProgress,
        ),
        projects: mix(
          from === "projects" ? 1 : 0,
          to === "projects" ? 1 : 0,
          motionProgress,
        ),
        travel: mix(
          from === "travel" ? 1 : 0,
          to === "travel" ? 1 : 0,
          motionProgress,
        ),
      };
      updateDiagnostics(rawProgress);
      renderOnce(performance.now(), 0);
      return getSnapshot();
    },
    getFrameLog: () => frameLog,
    clearFrameLog: () => {
      captureFrameLog = true;
      frameLog.length = 0;
    },
    simulateContextLoss: markFallback,
    cancel,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      cancel();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      resizeObserver.disconnect();
      window.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onEarthPointerDown, true);
      document.removeEventListener("pointerup", onEarthPointerEnd, true);
      document.removeEventListener("pointercancel", onEarthPointerEnd, true);
      reducedMotion.removeEventListener("change", onMotionPreference);
      resetCountryHandoff();
      listeners.clear();
      earthFrameListeners.clear();
      worldArtwork.destroy();
      bodies.destroy();
      shootingStar.destroy();
      celestialEarth?.destroy();
      countryOverlays.destroy();
      textureLoader.destroy();
      resources.forEach((resource) => resource.dispose());
      resources.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.width = 1;
      canvas.height = 1;
      if (root) {
        root.dataset.rendererType = "destroyed";
        root.dataset.webglReady = "false";
        root.dataset.artworkReady = "false";
        delete root.dataset.worldPlateCount;
        delete root.dataset.artworkFailedCount;
        delete root.dataset.physicalEarthReady;
        delete root.dataset.drawCallBudget;
        delete root.dataset.orbitalDustCount;
        delete root.dataset.rendererFailure;
        delete root.dataset.rendererReady;
        delete root.dataset.rendererSuspended;
        delete root.dataset.earthMeshCount;
        delete root.dataset.flightFrom;
        delete root.dataset.flightTo;
        delete root.dataset.flightProgress;
        delete root.dataset.flightMotionProgress;
        delete root.dataset.cameraFlight;
        delete root.dataset.projectCount;
        delete root.dataset.loadedCloudCount;
        delete root.dataset.trailCount;
        delete root.dataset.trailOpacity;
        delete root.dataset.interactionTarget;
        delete root.dataset.earthSceneOpacity;
        delete root.dataset.earthSceneOffset;
        delete root.dataset.earthAura;
        delete root.dataset.constellationPulse;
        delete root.dataset.nebulaActivity;
        delete root.dataset.aboutRayCount;
        delete root.dataset.earthTextureSize;
        delete root.dataset.earthGeometry;
        delete root.dataset.constellationPointGeometry;
        delete root.dataset.constellationLineGeometry;
      }
      const backdrop = document.querySelector<HTMLElement>(
        "[data-cosmic-backdrop]",
      );
      if (backdrop) backdrop.dataset.universeWebgl = "false";
    },
  };
}
