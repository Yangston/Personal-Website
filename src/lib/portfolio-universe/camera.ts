import type { UniverseSceneId } from "./state";
import {
  SCENE_MANIFEST,
  SCENE_CAMERAS,
  WORLD_ANCHORS,
  WORLD_EARTH_RADIUS,
  createCompositionFrame,
} from "./scene-manifest";

export type Vector3 = Readonly<{ x: number; y: number; z: number }>;

export type Quaternion = Readonly<{
  x: number;
  y: number;
  z: number;
  w: number;
}>;

export type CameraPose = Readonly<{
  position: Vector3;
  target: Vector3;
  fov: number;
}>;

export type CameraFlight = Readonly<{
  from: CameraPose;
  fromScene: UniverseSceneId;
  to: CameraPose;
  toScene: UniverseSceneId;
  startTangent: Vector3;
  endTangent: Vector3;
}>;

export type CameraFlightSample = CameraPose &
  Readonly<{
    orientation: Quaternion;
    tangent: Vector3;
    fromScene: UniverseSceneId;
    toScene: UniverseSceneId;
    progress: number;
  }>;

export type CameraFlightTiming = Readonly<{
  startSlope: number;
  endSlope: number;
}>;

export type UniverseProjection = Readonly<{
  x: number;
  y: number;
  scale: number;
  depth: number;
  bounds: Readonly<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
}>;

export type UniverseQualityProfile = Readonly<{
  tier: "high" | "low";
  pixelRatio: number;
  particleCount: number;
  dustCount: number;
  projectHaloCount: number;
  nebulaLayerCount: number;
  trailCount: number;
}>;

export const CAMERA_ANCHORS = SCENE_CAMERAS;
export const EARTH_WORLD_POSITION = WORLD_ANCHORS.earth;
export const EARTH_WORLD_RADIUS = WORLD_EARTH_RADIUS;

export const DEFAULT_CAMERA_FLIGHT_TIMING: CameraFlightTiming = {
  startSlope: 0,
  endSlope: 0,
};

export const RETARGET_CAMERA_FLIGHT_TIMING: CameraFlightTiming = {
  startSlope: 1,
  endSlope: 0,
};

export const HOME_TO_TRAVEL_CAMERA_FLIGHT_TIMING: CameraFlightTiming = {
  startSlope: DEFAULT_CAMERA_FLIGHT_TIMING.startSlope,
  endSlope: 0,
};

export function resolveCameraFlightTiming(
  from: UniverseSceneId,
  to: UniverseSceneId,
  retargeted = false,
): CameraFlightTiming {
  if (retargeted) return RETARGET_CAMERA_FLIGHT_TIMING;
  return from === "home" && to === "travel"
    ? HOME_TO_TRAVEL_CAMERA_FLIGHT_TIMING
    : DEFAULT_CAMERA_FLIGHT_TIMING;
}

export function responsiveCameraPose(
  pose: CameraPose,
  scene: UniverseSceneId,
  viewportWidth: number,
  viewportHeight = 0,
): CameraPose {
  return resolveCameraPose(scene, viewportWidth, viewportHeight, pose);
}

const PATH_CURVES: Readonly<Record<UniverseSceneId, Vector3>> = {
  home: { x: 0, y: 0.7, z: 1.6 },
  about: { x: -1.8, y: 1.1, z: -2.2 },
  projects: { x: 1.5, y: 1.9, z: -2.6 },
  travel: { x: -1.4, y: -1.1, z: -3.2 },
};

const WORLD_UP = { x: 0, y: 1, z: 0 } as const;
const ALTERNATE_UP = { x: 0, y: 0, z: 1 } as const;
const MINIMUM_DEPTH = 0.35;

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const add = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

const subtract = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const multiply = (vector: Vector3, scalar: number): Vector3 => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
  z: vector.z * scalar,
});

const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const magnitude = (vector: Vector3) => Math.hypot(vector.x, vector.y, vector.z);

const normalize = (vector: Vector3): Vector3 => {
  const length = magnitude(vector);
  return length > Number.EPSILON
    ? multiply(vector, 1 / length)
    : { x: 0, y: 0, z: 0 };
};

const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const mixVector = (from: Vector3, to: Vector3, progress: number): Vector3 => ({
  x: mix(from.x, to.x, progress),
  y: mix(from.y, to.y, progress),
  z: mix(from.z, to.z, progress),
});

/** The same framing function also lays out Astro's first paint. */
export function resolveCameraPose(
  scene: UniverseSceneId,
  viewportWidth: number,
  viewportHeight: number,
  pose: CameraPose = CAMERA_ANCHORS[scene],
): CameraPose {
  return createCompositionFrame(
    scene,
    viewportWidth,
    viewportHeight,
    SCENE_MANIFEST,
    pose,
  ).pose;
}

type FlightPosition = Vector3 | readonly number[];

const positionComponents = (position: FlightPosition): Vector3 => {
  if (Array.isArray(position))
    return { x: position[0] ?? 0, y: position[1] ?? 0, z: position[2] ?? 0 };
  return position as Vector3;
};

export function flightDurationMs(
  from: FlightPosition,
  to: FlightPosition,
  viewportWidth: number,
  reducedMotion = false,
) {
  if (reducedMotion) return 0;
  const start = positionComponents(from);
  const end = positionComponents(to);
  const distance = Math.hypot(
    end.x - start.x,
    end.y - start.y,
    end.z - start.z,
  );
  const distanceScale = clamp(distance / 20);
  return viewportWidth <= 700
    ? Math.round(1_400 + distanceScale * 400)
    : Math.round(1_500 + distanceScale * 400);
}

export function universeFlightMotionProgress(
  progress: number,
  timing: CameraFlightTiming = DEFAULT_CAMERA_FLIGHT_TIMING,
) {
  const value = clamp(progress);
  const startSlope = Math.max(0, timing.startSlope);
  const endSlope = Math.max(0, timing.endSlope);
  // Quintic Hermite timing keeps acceleration quiet at both ends while
  // retaining the incoming velocity when an in-progress journey is retargeted.
  const cubic = 10 - 6 * startSlope - 4 * endSlope;
  const quartic = -15 + 8 * startSlope + 7 * endSlope;
  const quintic = 6 - 3 * startSlope - 3 * endSlope;
  return clamp(
    value * startSlope +
      value ** 3 * (cubic + value * (quartic + value * quintic)),
  );
}

export function universeFlightMotionDerivative(
  progress: number,
  timing: CameraFlightTiming = DEFAULT_CAMERA_FLIGHT_TIMING,
) {
  const value = clamp(progress);
  const startSlope = Math.max(0, timing.startSlope);
  const endSlope = Math.max(0, timing.endSlope);
  const cubic = 10 - 6 * startSlope - 4 * endSlope;
  const quartic = -15 + 8 * startSlope + 7 * endSlope;
  const quintic = 6 - 3 * startSlope - 3 * endSlope;
  return (
    startSlope +
    value ** 2 * (3 * cubic + value * (4 * quartic + value * 5 * quintic))
  );
}

const hermite = (
  from: Vector3,
  to: Vector3,
  fromTangent: Vector3,
  toTangent: Vector3,
  progress: number,
) => {
  const squared = progress * progress;
  const cubed = squared * progress;
  return add(
    add(
      multiply(from, 2 * cubed - 3 * squared + 1),
      multiply(fromTangent, cubed - 2 * squared + progress),
    ),
    add(
      multiply(to, -2 * cubed + 3 * squared),
      multiply(toTangent, cubed - squared),
    ),
  );
};

const hermiteDerivative = (
  from: Vector3,
  to: Vector3,
  fromTangent: Vector3,
  toTangent: Vector3,
  progress: number,
) => {
  const squared = progress * progress;
  return add(
    add(
      multiply(from, 6 * squared - 6 * progress),
      multiply(fromTangent, 3 * squared - 4 * progress + 1),
    ),
    add(
      multiply(to, -6 * squared + 6 * progress),
      multiply(toTangent, 3 * squared - 2 * progress),
    ),
  );
};

function quaternionFromRotationMatrix(
  right: Vector3,
  up: Vector3,
  backward: Vector3,
): Quaternion {
  const m11 = right.x;
  const m12 = up.x;
  const m13 = backward.x;
  const m21 = right.y;
  const m22 = up.y;
  const m23 = backward.y;
  const m31 = right.z;
  const m32 = up.z;
  const m33 = backward.z;
  const trace = m11 + m22 + m33;

  let x: number;
  let y: number;
  let z: number;
  let w: number;

  if (trace > 0) {
    const scale = 0.5 / Math.sqrt(trace + 1);
    w = 0.25 / scale;
    x = (m32 - m23) * scale;
    y = (m13 - m31) * scale;
    z = (m21 - m12) * scale;
  } else if (m11 > m22 && m11 > m33) {
    const scale = 2 * Math.sqrt(1 + m11 - m22 - m33);
    w = (m32 - m23) / scale;
    x = 0.25 * scale;
    y = (m12 + m21) / scale;
    z = (m13 + m31) / scale;
  } else if (m22 > m33) {
    const scale = 2 * Math.sqrt(1 + m22 - m11 - m33);
    w = (m13 - m31) / scale;
    x = (m12 + m21) / scale;
    y = 0.25 * scale;
    z = (m23 + m32) / scale;
  } else {
    const scale = 2 * Math.sqrt(1 + m33 - m11 - m22);
    w = (m21 - m12) / scale;
    x = (m13 + m31) / scale;
    y = (m23 + m32) / scale;
    z = 0.25 * scale;
  }

  const length = Math.hypot(x, y, z, w) || 1;
  return { x: x / length, y: y / length, z: z / length, w: w / length };
}

function lookQuaternion(position: Vector3, target: Vector3): Quaternion {
  const forward = normalize(subtract(target, position));
  if (magnitude(forward) <= Number.EPSILON) return { x: 0, y: 0, z: 0, w: 1 };

  const referenceUp =
    Math.abs(dot(forward, WORLD_UP)) > 0.999 ? ALTERNATE_UP : WORLD_UP;
  const right = normalize(cross(forward, referenceUp));
  const up = normalize(cross(right, forward));
  return quaternionFromRotationMatrix(right, up, multiply(forward, -1));
}

function defaultTangents(
  from: CameraPose,
  fromScene: UniverseSceneId,
  toScene: UniverseSceneId,
  to: CameraPose = CAMERA_ANCHORS[toScene],
): Readonly<{ start: Vector3; end: Vector3 }> {
  const displacement = subtract(to.position, from.position);
  const direction = fromScene === "home" ? 1 : toScene === "home" ? -1 : 0.72;
  const bend = multiply(PATH_CURVES[toScene], direction * Math.PI);

  return {
    start: add(displacement, bend),
    end: subtract(displacement, bend),
  };
}

export function createCameraFlight(
  fromPose: CameraPose,
  fromScene: UniverseSceneId,
  toScene: UniverseSceneId,
  incomingTangent?: Vector3,
  toPose: CameraPose = CAMERA_ANCHORS[toScene],
): CameraFlight {
  const defaults = defaultTangents(fromPose, fromScene, toScene, toPose);

  return {
    from: fromPose,
    fromScene,
    to: toPose,
    toScene,
    startTangent: incomingTangent ?? defaults.start,
    endTangent: defaults.end,
  };
}

export function sampleCameraFlight(
  flight: CameraFlight,
  progress: number,
): CameraFlightSample {
  const clampedProgress = clamp(progress);
  const position = hermite(
    flight.from.position,
    flight.to.position,
    flight.startTangent,
    flight.endTangent,
    clampedProgress,
  );
  const tangent = hermiteDerivative(
    flight.from.position,
    flight.to.position,
    flight.startTangent,
    flight.endTangent,
    clampedProgress,
  );
  const target = mixVector(
    flight.from.target,
    flight.to.target,
    clampedProgress,
  );

  return {
    position,
    target,
    fov: mix(flight.from.fov, flight.to.fov, clampedProgress),
    orientation: lookQuaternion(position, target),
    tangent,
    fromScene: flight.fromScene,
    toScene: flight.toScene,
    progress: clampedProgress,
  };
}

export function retargetCameraFlight(
  current: CameraFlightSample,
  toScene: UniverseSceneId,
  incomingTangent: Vector3 = current.tangent,
  toPose: CameraPose = CAMERA_ANCHORS[toScene],
): CameraFlight {
  return createCameraFlight(
    {
      position: current.position,
      target: current.target,
      fov: current.fov,
    },
    current.toScene,
    toScene,
    incomingTangent,
    toPose,
  );
}

export function projectWorldPoint(
  pose: CameraPose,
  point: Vector3,
  viewport: Readonly<{ width: number; height: number }>,
): UniverseProjection | null {
  if (viewport.width <= 0 || viewport.height <= 0) return null;

  const forward = normalize(subtract(pose.target, pose.position));
  if (magnitude(forward) <= Number.EPSILON) return null;

  const referenceUp =
    Math.abs(dot(forward, WORLD_UP)) > 0.999 ? ALTERNATE_UP : WORLD_UP;
  const right = normalize(cross(forward, referenceUp));
  const up = normalize(cross(right, forward));
  const relative = subtract(point, pose.position);
  const depth = dot(relative, forward);
  if (depth <= MINIMUM_DEPTH) return null;

  const fov = clamp(pose.fov, 1, 179);
  const focalLength = viewport.height / (2 * Math.tan((fov * Math.PI) / 360));
  const scale = focalLength / depth;
  return {
    x: viewport.width / 2 + dot(relative, right) * scale,
    y: viewport.height / 2 - dot(relative, up) * scale,
    scale,
    depth,
    bounds: {
      left: viewport.width / 2 + dot(relative, right) * scale,
      top: viewport.height / 2 - dot(relative, up) * scale,
      width: 0,
      height: 0,
    },
  };
}

export function selectUniverseQuality(
  input: Readonly<{
    hardwareConcurrency: number;
    deviceMemory: number;
    devicePixelRatio: number;
    reducedData?: boolean;
  }>,
): UniverseQualityProfile {
  const constrained =
    input.reducedData === true ||
    !Number.isFinite(input.hardwareConcurrency) ||
    input.hardwareConcurrency <= 4 ||
    !Number.isFinite(input.deviceMemory) ||
    input.deviceMemory <= 4;
  const requestedPixelRatio = Number.isFinite(input.devicePixelRatio)
    ? Math.max(1, input.devicePixelRatio)
    : 1;

  return constrained
    ? {
        tier: "low",
        pixelRatio: Math.min(requestedPixelRatio, 1),
        particleCount: 176,
        dustCount: 48,
        projectHaloCount: 24,
        nebulaLayerCount: 4,
        trailCount: 18,
      }
    : {
        tier: "high",
        pixelRatio: Math.min(requestedPixelRatio, 2),
        particleCount: 288,
        dustCount: 96,
        projectHaloCount: 36,
        nebulaLayerCount: 7,
        trailCount: 48,
      };
}
