import type { UniverseSceneId } from "./state";
import artwork from "@/data/cloudscape-artwork.json" with { type: "json" };
import { NEBULA_FOCAL_POINT } from "./nebula-regions";

export type WorldPoint = Readonly<{ x: number; y: number; z: number }>;
export type WorldPose = Readonly<{
  position: WorldPoint;
  target: WorldPoint;
  fov: number;
}>;
export type WorldPlane = Readonly<{
  id: string;
  source: string;
  mobileSource: string;
  sourceWidth: number;
  sourceHeight: number;
  mobileWidth: number;
  mobileHeight: number;
  priority: "structural" | "detail";
  mobilePlacement?: Readonly<{
    position: WorldPoint;
    width: number;
    height: number;
  }>;
  mobile: boolean;
  rotation: number;
  drift: Readonly<{
    x: number;
    y: number;
    rotation: number;
    speed: number;
    phase: number;
  }>;
  position: WorldPoint;
  width: number;
  height: number;
  opacity: number;
  layer: number;
  sceneOpacity?: Readonly<Partial<Record<UniverseSceneId, number>>>;
  travelExit?: WorldPoint;
  nebulaLocal?: Readonly<{ x: number; y: number; z: number; size: number }>;
  approach?: boolean;
  projectSpace?: boolean;
  projectCloud?: Readonly<{
    distance: number;
    transitOnly?: boolean;
    x: number;
    y: number;
    size: number;
  }>;
}>;

/** Shared by first paint, GPU artwork, and the context-loss fallback. */
export function resolveWorldPlane(
  plane: WorldPlane,
  viewportWidth: number,
  viewportHeight = 900,
  travelWeight = 0,
): WorldPlane {
  let resolved =
    viewportWidth <= 700 && plane.mobilePlacement
      ? { ...plane, ...plane.mobilePlacement }
      : plane;
  if (plane.travelExit) {
    const progress = Math.max(0, Math.min(1, travelWeight));
    resolved = {
      ...resolved,
      position: {
        x: resolved.position.x + plane.travelExit.x * progress,
        y: resolved.position.y + plane.travelExit.y * progress,
        z: resolved.position.z + plane.travelExit.z * progress,
      },
    };
  }
  const replaced =
    viewportWidth <= 700
      ? ["puff-lowerleft", "puff-bottom", "middle-left"]
      : ["puff-left", "puff-midleft", "puff-right"];
  if (replaced.includes(plane.id))
    resolved = {
      ...resolved,
      sceneOpacity: { ...resolved.sceneOpacity, home: 0 },
    };
  // Same Home framing as createCompositionFrame, kept self-contained for SSR's
  // serialized bootstrap. Scaling around this camera preserves every Home pixel.
  const narrow = viewportWidth <= 700;
  const focal = viewportHeight / (2 * Math.tan((52 * Math.PI) / 360));
  const diameter = narrow
    ? Math.min(viewportWidth * 1.15, viewportHeight * 0.62)
    : viewportHeight;
  const depth = (26.3 * focal) / diameter;
  const home = {
    x:
      15.7 -
      ((viewportWidth * (narrow ? 0.88 : 0.84) - viewportWidth / 2) / focal) *
        depth,
    y:
      -12 -
      ((viewportHeight / 2 - viewportHeight * (narrow ? 0.94 : 0.96)) / focal) *
        depth,
    z: -7 + depth,
  };
  if (
    plane.id !== "nebula" &&
    plane.id !== "panorama" &&
    !plane.nebulaLocal &&
    !plane.projectSpace &&
    !plane.projectCloud
  ) {
    // The nebula moves three times deeper. Compare final depths: several
    // originally distant clouds otherwise become a translucent veil over it.
    const nebulaDepth = home.z + (-36 - home.z) * 3;
    return resolved.position.z > nebulaDepth
      ? { ...resolved, sceneOpacity: { ...resolved.sceneOpacity, about: 0 } }
      : resolved;
  }
  if (plane.projectCloud) {
    const cloud = plane.projectCloud;
    const factor = cloud.distance * 3;
    return {
      ...resolved,
      position: {
        x: home.x + (-2.8 + cloud.x - home.x) * factor,
        y: home.y + (6.8 + cloud.y - home.y) * factor,
        z: home.z + (-50 - home.z) * factor,
      },
      width: cloud.size * factor,
      height: (cloud.size * factor * resolved.height) / resolved.width,
    };
  }
  if (plane.projectSpace)
    return {
      ...resolved,
      position: {
        x: home.x + (resolved.position.x - home.x) * 6,
        y: home.y + (resolved.position.y - home.y) * 6,
        z: home.z + (resolved.position.z - home.z) * 6,
      },
      width: resolved.width * 6,
      height: resolved.height * 6,
    };
  if (plane.id === "panorama")
    return {
      ...resolved,
      position: {
        x: home.x + (resolved.position.x - home.x) * 3,
        y: home.y + (resolved.position.y - home.y) * 3,
        z: home.z + (resolved.position.z - home.z) * 3,
      },
      width: resolved.width * 3,
      height: resolved.height * 3,
    };
  const base = narrow
    ? { x: 20, y: 15, z: -36, width: 33 }
    : { x: 22, y: 15, z: -36, width: 37 };
  const center = {
    x: home.x + (base.x - home.x) * 3,
    y: home.y + (base.y - home.y) * 3,
    z: home.z + (base.z - home.z) * 3,
  };
  const size = base.width * 3;
  const local =
    plane.nebulaLocal && !plane.approach
      ? {
          ...plane.nebulaLocal,
          x:
            plane.nebulaLocal.x *
            Math.min(1, ((viewportWidth / viewportHeight) * 1023) / 1537),
          y: plane.nebulaLocal.y * (narrow ? 1.08 : 1),
          size: plane.nebulaLocal.size,
        }
      : plane.nebulaLocal;
  const approachProgress =
    local && plane.approach
      ? Math.max(
          0,
          Math.min(
            1,
            (home.z - center.z - local.z * size) / (home.z - center.z),
          ),
        )
      : 1;
  const lane = plane.approach
    ? {
        x: home.x + (center.x - home.x) * approachProgress,
        y: home.y + (center.y - home.y) * approachProgress,
      }
    : center;
  return {
    ...resolved,
    position: local
      ? {
          x: lane.x + local.x * size,
          y: lane.y + local.y * size,
          z: center.z + local.z * size,
        }
      : center,
    width: local ? local.size * size : resolved.width * 3,
    height: local
      ? (local.size * size * resolved.height) / resolved.width
      : resolved.height * 3,
  };
}

export const WORLD_RENDER_BUDGETS = {
  desktop: { planes: 46, drawCalls: 44 },
  mobile: { planes: 35, drawCalls: 32 },
} as const;

export const WORLD_ANCHORS = {
  earth: { x: 15.7, y: -12, z: -7 },
  planet: { x: -42, y: -20, z: -65 },
  about: { x: 22, y: 15, z: -36 },
  projects: { x: -2.8, y: 6.8, z: -50 },
} as const;

export const WORLD_EARTH_RADIUS = 13.15;

export const HOME_LABEL_ANCHORS = {
  about: { x: 29.7, y: 14.8, z: -36 },
  projects: { x: 3.7, y: 8.2, z: -50 },
  travel: { x: 7.2, y: -1.5, z: -7 },
} as const;

export const MOBILE_HOME_LABEL_ANCHORS = {
  about: { x: 17, y: 24, z: -36 },
  projects: { x: -3.5, y: 3, z: -50 },
  travel: { x: 7.2, y: -1.5, z: -7 },
} as const;

export const SCENE_CAMERAS: Readonly<Record<UniverseSceneId, WorldPose>> = {
  home: {
    position: { x: 0, y: 0, z: 20 },
    target: { x: 0, y: 0, z: -35 },
    fov: 52,
  },
  about: {
    position: { x: 11, y: 14, z: 1 },
    target: { x: 11, y: 14, z: -36 },
    fov: 47,
  },
  projects: {
    position: { x: -6, y: 9, z: -9 },
    target: { x: -6, y: 8, z: -50 },
    fov: 45,
  },
  travel: {
    position: { x: 3, y: -7, z: 31 },
    target: { x: 3, y: -7, z: -7 },
    fov: 43,
  },
};

type AssetId = keyof typeof artwork;
const plate = (
  id: string,
  asset: AssetId,
  position: WorldPoint,
  width: number,
  layer: number,
  mobile = false,
  opacity = 0.8,
  rotation = 0,
  narrow?: readonly [x: number, y: number, z: number, width: number],
): WorldPlane => {
  const image = artwork[asset];
  const aspect = image.desktop.height / image.desktop.width;
  return {
    id,
    source: image.desktop.source,
    mobileSource: image.mobile.source,
    sourceWidth: image.desktop.width,
    sourceHeight: image.desktop.height,
    mobileWidth: image.mobile.width,
    mobileHeight: image.mobile.height,
    position,
    width,
    height: width * aspect,
    layer,
    mobile,
    opacity,
    travelExit:
      id === "foreground-left"
        ? { x: -35, y: -16, z: 0 }
        : id === "foreground-bottom"
          ? { x: -6, y: -40, z: 0 }
          : undefined,
    rotation,
    priority: mobile ? "structural" : "detail",
    mobilePlacement: narrow
      ? {
          position: { x: narrow[0], y: narrow[1], z: narrow[2] },
          width: narrow[3],
          height: narrow[3] * aspect,
        }
      : undefined,
    sceneOpacity:
      id === "panorama"
        ? {}
        : id === "nebula"
          ? { about: 1, projects: 0, travel: 0.72 }
          : {
              about:
                position.z > WORLD_ANCHORS.about.z
                  ? 0
                  : position.z > -90
                    ? 0.1
                    : 0.32,
              projects: 0.18,
              travel: id.startsWith("foreground-")
                ? 1
                : position.z > 0
                  ? 0.35
                  : position.z > -35
                    ? 0.45
                    : 0.8,
            },
    drift: {
      x: id === "panorama" ? 0 : id === "nebula" ? 0.12 : 0.25 + layer * 0.08,
      y: id === "panorama" ? 0 : id === "nebula" ? 0.1 : 0.2 + layer * 0.04,
      rotation: id === "panorama" ? 0 : id === "nebula" ? 0.002 : 0.008,
      speed: 0.09 + layer * 0.007,
      phase: layer * 1.7,
    },
  };
};
// Each cloud uses original pixels from a different cluster of the approved master.
// The distant atmosphere fills disocclusions; all 22 cloud clusters move separately.
export const WORLD_PLANES: readonly WorldPlane[] = [
  plate(
    "panorama",
    "atmosphere",
    { x: -55, y: -55, z: -170 },
    540,
    0,
    true,
    1,
    0,
    [-35, -40, -170, 600],
  ),
  plate(
    "far-cloud-top",
    "upper-left",
    { x: -42, y: 43, z: -110 },
    100,
    0,
    true,
    0.8,
    0,
    [-6, 63, -110, 90],
  ),
  plate(
    "far-cloud-center",
    "upper-center",
    { x: 5, y: 45, z: -100 },
    90,
    1,
    false,
    0.7,
  ),
  plate(
    "far-cloud-right",
    "upper-right",
    { x: 62, y: 28, z: -95 },
    96,
    1,
    true,
    0.9,
    0,
    [40, 52, -95, 80],
  ),
  plate(
    "far-left",
    "left-wall",
    { x: -50, y: -3, z: -90 },
    80,
    1,
    true,
    0.68,
    0,
    [-22, 10, -90, 70],
  ),
  plate(
    "foreground-left",
    "lower-left",
    { x: -0.5, y: -10, z: 7 },
    26,
    7,
    true,
    0.97,
    0,
    [3, -13, 7, 36],
  ),
  plate(
    "foreground-bottom",
    "lower-center",
    { x: 2, y: -10, z: 10 },
    24,
    7,
    true,
    0.9,
    -0.05,
    [4, -12, 10, 28],
  ),
  plate(
    "middle-right",
    "right-wall",
    { x: 40, y: 2, z: -25 },
    50,
    4,
    true,
    0.8,
    0,
    [34, 10, -25, 38],
  ),
  plate(
    "cloud-cradle",
    "lower-right",
    { x: -7, y: -17, z: -18 },
    52,
    5,
    true,
    0.75,
    0.12,
    [0, -8, -18, 42],
  ),
  plate(
    "middle-left",
    "left-bridge",
    { x: -19, y: -4, z: -40 },
    43,
    3,
    true,
    0.48,
    0,
    [-11, 2, -40, 28],
  ),
  plate(
    "right-bridge",
    "right-bridge",
    { x: 33, y: -8, z: -35 },
    43,
    4,
    true,
    0.65,
    0,
    [25, -1, -35, 32],
  ),
  plate(
    "crown-left",
    "crown-left",
    { x: -13, y: 27, z: -55 },
    25,
    2,
    false,
    0.68,
  ),
  plate(
    "crown-middle",
    "crown-middle",
    { x: 7, y: 32, z: -75 },
    18,
    2,
    false,
    0.6,
  ),
  plate(
    "crown-right",
    "crown-right",
    { x: 32, y: 25, z: -40 },
    28,
    3,
    false,
    0.65,
  ),
  plate("puff-left", "puff-left", { x: -29, y: 9, z: -60 }, 15, 2, false, 0.6),
  plate(
    "puff-midleft",
    "puff-midleft",
    { x: -19, y: -14, z: -30 },
    18,
    4,
    false,
    0.75,
  ),
  plate(
    "puff-lowerleft",
    "puff-lowerleft",
    { x: -11, y: -11, z: -10 },
    20,
    6,
    true,
    0.75,
    0,
    [-9, -3, -10, 20],
  ),
  plate(
    "puff-bottom",
    "puff-bottom",
    { x: 4, y: -24, z: -24 },
    22,
    4,
    true,
    0.65,
    0,
    [5, -9, -24, 18],
  ),
  plate(
    "puff-right",
    "puff-right",
    { x: 31, y: 9, z: -15 },
    20,
    6,
    false,
    0.58,
  ),
  plate(
    "puff-lowerright",
    "puff-lowerright",
    { x: 28, y: -17, z: -5 },
    18,
    6,
    false,
    0.65,
  ),
  plate(
    "bridge-center",
    "bridge-center",
    { x: -3, y: -7, z: -62 },
    45,
    2,
    true,
    0.56,
    0,
    [8, -8, -62, 38],
  ),
  plate(
    "distant-peak",
    "distant-peak",
    { x: -5, y: -13, z: -80 },
    16,
    1,
    false,
    0.65,
  ),
  {
    ...plate(
      "project-sky",
      "mist",
      { x: -1.4, y: 6.5, z: -58 },
      38,
      0,
      true,
      1,
    ),
    source: "/media/site/project-sky.svg",
    mobileSource: "/media/site/project-sky.svg",
    sourceWidth: 1024,
    sourceHeight: 896,
    mobileWidth: 1024,
    mobileHeight: 896,
    height: 33.25,
    projectSpace: true,
    sceneOpacity: { about: 0, travel: 0 },
    drift: { x: 0, y: 0, rotation: 0, speed: 0, phase: 0 },
  },
  ...[
    { distance: 0.08, x: -11, y: 3, size: 24, asset: "left-bridge" as const },
    { distance: 0.16, x: 12, y: -2, size: 23, asset: "right-bridge" as const },
    { distance: 0.24, x: 1, y: -10, size: 28, asset: "puff-bottom" as const },
    ...Array.from({ length: 6 }, (_, i) => ({
      distance: 0.28 + i * 0.04,
      x: (i % 2 ? 1 : -1) * (10 + (i % 3)),
      y: [-3, 5, -7, 2, -4, 6][i],
      size: 24 + (i % 3) * 3,
      asset: (
        [
          "left-bridge",
          "right-bridge",
          "puff-bottom",
          "left-wall",
          "right-wall",
          "crown-left",
        ] as const
      )[i],
      transitOnly: true,
    })),
  ].map((cloud, i) => ({
    ...plate(
      `project-cloud-${i}`,
      cloud.asset,
      WORLD_ANCHORS.projects,
      1,
      6,
      true,
      0.48,
    ),
    projectCloud: cloud,
    sceneOpacity: {
      home: "transitOnly" in cloud ? 0 : 1,
      projects: 0,
      about: 0,
      travel: 0,
    },
    drift: { x: 0.05, y: 0.04, rotation: 0.005, speed: 0.09, phase: i * 2 },
  })),
  plate(
    "nebula",
    "nebula",
    WORLD_ANCHORS.about,
    37,
    3,
    true,
    1,
    0,
    [20, 15, -36, 33],
  ),
  {
    ...plate("planet", "lower-left", WORLD_ANCHORS.planet, 10, 4, true, 0.62),
    source: "/media/site/celestial/marble-planet-1024.webp",
    mobileSource: "/media/site/celestial/marble-planet-512.webp",
    sourceWidth: 1024,
    sourceHeight: 1024,
    mobileWidth: 512,
    mobileHeight: 512,
    height: 10,
    sceneOpacity: {},
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    ...plate(
      `about-approach-${i}`,
      i % 2 ? "right-wall" : "left-wall",
      WORLD_ANCHORS.about,
      1,
      6,
      i < 4,
      0.34,
    ),
    nebulaLocal: {
      x: (i % 2 ? 1 : -1) * (0.24 + i * 0.015),
      y: ((i % 3) - 1) * 0.11,
      z: 0.9 + i * 0.15,
      size: 0.38,
    },
    approach: true,
    sceneOpacity: { home: 0, about: 0, projects: 0, travel: 0 },
  })),
];

export const SCENE_MANIFEST = {
  nebulaFocalPoint: NEBULA_FOCAL_POINT,
  cameras: SCENE_CAMERAS,
  anchors: WORLD_ANCHORS,
  homeLabels: HOME_LABEL_ANCHORS,
  mobileHomeLabels: MOBILE_HOME_LABEL_ANCHORS,
  earthRadius: WORLD_EARTH_RADIUS,
  planes: WORLD_PLANES,
  labels: {
    home: "The wider system",
    about: "Inside the nebula",
    projects: "Project constellations",
    travel: "The Earth archive",
  },
} as const;

/** Self-contained so Astro can use the exact same projection before first paint. */
export function createCompositionFrame(
  scene: UniverseSceneId,
  viewportWidth: number,
  viewportHeight: number,
  manifest: typeof SCENE_MANIFEST,
  overridePose?: WorldPose,
  resolvePlane: typeof resolveWorldPlane = resolveWorldPlane,
) {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  // Scale about the responsive Home eye, preserving its projected silhouette.
  // This closure also runs in the serialized first-paint bootstrap.
  const homeFocal = height / (2 * Math.tan((52 * Math.PI) / 360));
  const homeDiameter =
    width <= 700 ? Math.min(width * 1.15, height * 0.62) : height;
  const homeDepth = (manifest.earthRadius * 2 * homeFocal) / homeDiameter;
  const homeEye = {
    x:
      manifest.anchors.earth.x -
      ((width * (width <= 700 ? 0.88 : 0.84) - width / 2) / homeFocal) *
        homeDepth,
    y:
      manifest.anchors.earth.y -
      ((height / 2 - height * (width <= 700 ? 0.94 : 0.96)) / homeFocal) *
        homeDepth,
    z: manifest.anchors.earth.z + homeDepth,
  };
  const projectToWorld = (point: WorldPoint): WorldPoint => ({
    x: homeEye.x + (point.x - homeEye.x) * 6,
    y: homeEye.y + (point.y - homeEye.y) * 6,
    z: homeEye.z + (point.z - homeEye.z) * 6,
  });
  const dot = (a: WorldPoint, b: WorldPoint) =>
    a.x * b.x + a.y * b.y + a.z * b.z;
  const subtract = (a: WorldPoint, b: WorldPoint) => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  });
  const add = (a: WorldPoint, b: WorldPoint) => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  });
  const multiply = (a: WorldPoint, n: number) => ({
    x: a.x * n,
    y: a.y * n,
    z: a.z * n,
  });
  const normalize = (a: WorldPoint) =>
    multiply(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));
  const cross = (a: WorldPoint, b: WorldPoint) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  let pose = overridePose ?? manifest.cameras[scene];
  if (scene === "about" && width <= 700)
    pose = {
      position: { x: 22, y: 24, z: 38 },
      target: { x: 22, y: 24, z: -36 },
      fov: 52,
    };
  if (scene === "about" && resolvePlane) {
    const authored = manifest.planes.find((plane) => plane.id === "nebula");
    if (authored) {
      const nebula = resolvePlane(authored, width, height);
      const fov = 47;
      const focal = height / (2 * Math.tan((fov * Math.PI) / 360));
      // Frame the visible eye; the portrait scale retains all three inner folds.
      const span = Math.min(width * 1.75, height * 1.35);
      const distance = (nebula.width * focal) / span;
      const eye = {
        x:
          nebula.position.x +
          (manifest.nebulaFocalPoint.x - 0.5) * nebula.width,
        y:
          nebula.position.y +
          (0.5 - manifest.nebulaFocalPoint.y) * nebula.height,
        z: nebula.position.z,
      };
      pose = {
        position: { ...eye, z: eye.z + distance },
        target: eye,
        fov,
      };
    }
  }
  if (scene === "projects" && width <= 700)
    pose = {
      position: { x: 2.8, y: 17, z: 20 },
      target: { x: 2.8, y: 17, z: -50 },
      fov: 58,
    };
  if (scene === "projects")
    pose = {
      position: projectToWorld(pose.position),
      target: projectToWorld(pose.target),
      fov: pose.fov,
    };
  let forward = normalize(subtract(pose.target, pose.position));
  const referenceUp =
    Math.abs(forward.y) > 0.999 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const right = normalize(cross(forward, referenceUp));
  const up = normalize(cross(right, forward));
  const focalLength = height / (2 * Math.tan((pose.fov * Math.PI) / 360));
  if (scene === "projects" && width > 700) {
    // Reserve the right quarter for previews without moving any world vertices.
    const distance = Math.hypot(
      ...Object.values(subtract(pose.target, pose.position)),
    );
    const offset = multiply(right, ((width * 0.13) / focalLength) * distance);
    pose = {
      ...pose,
      position: add(pose.position, offset),
      target: add(pose.target, offset),
    };
  }
  if ((scene === "travel" || scene === "home") && viewportHeight > 0) {
    const narrow = width <= 700;
    const home = scene === "home";
    const centerX =
      width * (home ? (narrow ? 0.88 : 0.84) : narrow ? 0.5 : 0.68);
    const centerY =
      height * (home ? (narrow ? 0.94 : 0.96) : narrow ? 0.66 : 0.54);
    const clearance = 2 * Math.min(centerX - 24, width - centerX - 24);
    const diameter = home
      ? narrow
        ? Math.min(width * 1.15, height * 0.62)
        : height
      : narrow
        ? Math.min(width * 0.8, height * 0.42, clearance)
        : Math.min(height * 0.66, clearance);
    const depth =
      (manifest.earthRadius * 2 * focalLength) / Math.max(1, diameter);
    const offset = add(
      add(
        multiply(forward, depth),
        multiply(right, ((centerX - width / 2) / focalLength) * depth),
      ),
      multiply(up, ((height / 2 - centerY) / focalLength) * depth),
    );
    const position = subtract(manifest.anchors.earth, offset);
    const lookDistance = Math.hypot(
      ...Object.values(subtract(pose.target, pose.position)),
    );
    pose = {
      position,
      target: add(position, multiply(forward, lookDistance)),
      fov: pose.fov,
    };
    forward = normalize(subtract(pose.target, pose.position));
  }
  return {
    pose,
    projectToWorld,
    project(position: WorldPoint, planeWidth = 0, planeHeight = planeWidth) {
      const relative = subtract(position, pose.position);
      const depth = dot(relative, forward);
      if (depth <= 0.35) return null;
      const scale = focalLength / depth;
      const x = width / 2 + dot(relative, right) * scale;
      const y = height / 2 - dot(relative, up) * scale;
      return {
        x,
        y,
        scale,
        depth,
        bounds: {
          left: x - (planeWidth * scale) / 2,
          top: y - (planeHeight * scale) / 2,
          width: planeWidth * scale,
          height: planeHeight * scale,
        },
      };
    },
  };
}
