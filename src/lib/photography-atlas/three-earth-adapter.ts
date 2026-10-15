export type AtlasLongitudeLatitude = readonly [
  longitude: number,
  latitude: number,
];

export type AtlasVector3 = readonly [x: number, y: number, z: number];

export type AtlasEarthRotation = readonly [
  longitude: number,
  latitude: number,
  roll: number,
];

export type AtlasScreenAnchor = Readonly<{
  clientX: number;
  clientY: number;
  visible: boolean;
  /** Cosine between surface normal and the direction to the camera. */
  facing?: number;
  depth: number;
}>;

export type AtlasScreenGlobeRect = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type AtlasEarthCountryFeature = Readonly<{
  slug: string;
  feature: GeoJSON.Feature<GeoJSON.Geometry, { name?: string }>;
}>;

export type AtlasEarthFrameCallback = (
  time: number,
  delta: number,
  automaticMotion?: boolean,
) => void;

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

export function normalizeLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/**
 * Maps geographic coordinates to a unit sphere whose north pole is +Y,
 * longitude 0 is -X, and east is +Z. This matches the local vertex basis used
 * by a standard Three.js sphere without importing Three.js into atlas math.
 */
export function longitudeLatitudeToVector3(
  coordinate: AtlasLongitudeLatitude,
): AtlasVector3 {
  const longitude = normalizeLongitude(coordinate[0]) * DEGREES_TO_RADIANS;
  const latitude = coordinate[1] * DEGREES_TO_RADIANS;
  const cosineLatitude = Math.cos(latitude);

  return [
    -cosineLatitude * Math.cos(longitude),
    Math.sin(latitude),
    cosineLatitude * Math.sin(longitude),
  ];
}

/** Returns longitude in the canonical [-180, 180) range. */
export function vector3ToLongitudeLatitude(
  vector: AtlasVector3,
): AtlasLongitudeLatitude {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length <= Number.EPSILON)
    throw new RangeError("A zero-length vector has no geographic coordinate.");

  const longitude =
    Math.atan2(vector[2] / length, -vector[0] / length) * RADIANS_TO_DEGREES;
  const latitude =
    Math.asin(Math.max(-1, Math.min(1, vector[1] / length))) *
    RADIANS_TO_DEGREES;

  return [normalizeLongitude(longitude), latitude];
}

/**
 * Tests a world-space surface point against a world-space camera position.
 * A point is visible when its outward surface normal faces the camera.
 */
export function isSurfacePointVisible(
  surfacePoint: AtlasVector3,
  cameraPosition: AtlasVector3,
  sphereCenter: AtlasVector3 = [0, 0, 0],
) {
  return surfacePointFacing(surfacePoint, cameraPosition, sphereCenter) > 0;
}

export function surfacePointFacing(
  surfacePoint: AtlasVector3,
  cameraPosition: AtlasVector3,
  sphereCenter: AtlasVector3 = [0, 0, 0],
) {
  const normal: AtlasVector3 = [
    surfacePoint[0] - sphereCenter[0],
    surfacePoint[1] - sphereCenter[1],
    surfacePoint[2] - sphereCenter[2],
  ];
  const toCamera: AtlasVector3 = [
    cameraPosition[0] - surfacePoint[0],
    cameraPosition[1] - surfacePoint[1],
    cameraPosition[2] - surfacePoint[2],
  ];

  return (
    (normal[0] * toCamera[0] +
      normal[1] * toCamera[1] +
      normal[2] * toCamera[2]) /
    Math.max(Number.EPSILON, Math.hypot(...normal) * Math.hypot(...toCamera))
  );
}

/**
 * Renderer-agnostic seam between the semantic photography atlas and its
 * persistent Earth mesh. Screen-space values use viewport/client coordinates.
 */
export interface AtlasEarthBridge {
  subscribeFrame(callback: AtlasEarthFrameCallback): () => void;
  setInteractionEnabled(active: boolean): void;
  getRotation(): AtlasEarthRotation;
  setRotation(rotation: AtlasEarthRotation): void;
  projectCoordinate(
    coordinate: AtlasLongitudeLatitude,
  ): AtlasScreenAnchor | null;
  pickCoordinate(
    clientX: number,
    clientY: number,
  ): AtlasLongitudeLatitude | null;
  getGlobeRect(): AtlasScreenGlobeRect | null;
  setCountryFeatures(features: readonly AtlasEarthCountryFeature[]): void;
  setCountryEmphasis(slug: string | null): void;
  prepareCountryHandoff(
    target: AtlasLongitudeLatitude,
    signal: AbortSignal,
  ): Promise<boolean>;
  setCountryHandoffProgress(progress: number): void;
  cancelCountryHandoff(): void;
}
