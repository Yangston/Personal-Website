export const countryAtlasIds = {
  "united-states": 840,
  thailand: 764,
  taiwan: 158,
  china: 156,
  "hong-kong": 344,
  canada: 124,
} as const;

export type PhotographyCountrySlug = keyof typeof countryAtlasIds;

export type AtlasCitySummary = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type AtlasPreviewImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type AtlasCountrySummary = {
  slug: string;
  name: string;
  isoCode: string;
  atlasId: number;
  latitude: number;
  longitude: number;
  count: number;
  previewImages: AtlasPreviewImage[];
  cities: AtlasCitySummary[];
};

export function countryAtlasId(slug: string) {
  return countryAtlasIds[slug as PhotographyCountrySlug];
}

/** @internal Deterministic ordering for nested geographic hit targets. */
export function compareAtlasCountryHitPriority(
  left: Readonly<{ slug: string; area: number }>,
  right: Readonly<{ slug: string; area: number }>,
) {
  const leftPriority = left.slug === "hong-kong" ? 0 : 1;
  const rightPriority = right.slug === "hong-kong" ? 0 : 1;
  return leftPriority - rightPriority || left.area - right.area;
}

export function isCoordinateVisible(
  coordinate: readonly [number, number],
  rotation: readonly [number, number],
) {
  const radians = Math.PI / 180;
  const longitude = coordinate[0] * radians;
  const latitude = coordinate[1] * radians;
  const centerLongitude = -rotation[0] * radians;
  const centerLatitude = -rotation[1] * radians;
  const cosineDistance =
    Math.sin(latitude) * Math.sin(centerLatitude) +
    Math.cos(latitude) *
      Math.cos(centerLatitude) *
      Math.cos(longitude - centerLongitude);
  return cosineDistance > 0;
}

export function shortestLongitudeTarget(current: number, target: number) {
  const delta = ((((target - current) % 360) + 540) % 360) - 180;
  return current + delta;
}

export type AtlasLayoutBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type AtlasLabelSeed = {
  id: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  side?: -1 | 1;
  slot?: number;
};

export type AtlasLabelPlacement = AtlasLabelSeed & {
  side: -1 | 1;
  slot: number;
  x: number;
  y: number;
};

export function placeGlobeAroundHeading(
  width: number,
  height: number,
  desiredScale: number,
  heading: AtlasLayoutBounds | null,
  gap = 28,
) {
  if (!heading)
    return { centerX: width / 2, centerY: height / 2, scale: desiredScale };

  if (width >= 900 && height >= 620) {
    const centerX = width * 0.69;
    const centerY = height * 0.53;
    const labelReserve = Math.min(132, Math.max(96, width * 0.075));
    const scale = Math.min(
      desiredScale,
      height * 0.42,
      centerX - heading.right - gap,
      width - labelReserve - centerX,
    );
    if (scale >= Math.min(desiredScale * 0.6, height * 0.28))
      return { centerX, centerY, scale };
  }

  const radiusFactor = 1.12;
  const rightScale = Math.min(
    desiredScale,
    Math.max(0, width - heading.right - gap) / (radiusFactor * 2),
  );
  if (rightScale >= desiredScale * 0.72) {
    return {
      centerX: heading.right + gap + rightScale * radiusFactor,
      centerY: height / 2,
      scale: rightScale,
    };
  }

  const belowScale = Math.min(
    desiredScale,
    Math.max(0, height - heading.bottom - gap) / (radiusFactor * 2),
  );
  return {
    centerX: width / 2,
    centerY: Math.max(
      height / 2,
      heading.bottom + gap + belowScale * radiusFactor,
    ),
    scale: belowScale,
  };
}

export function placeAtlasLabels(
  labels: AtlasLabelSeed[],
  width: number,
  height: number,
  globe: { centerX: number; centerY: number; scale: number },
  obstacles: AtlasLayoutBounds[] = [],
): AtlasLabelPlacement[] {
  const margin = 8;
  const collisionGap = 8;
  const horizontalGap = Math.min(44, Math.max(24, globe.scale * 0.075));
  const verticalRise = Math.min(84, Math.max(44, globe.scale * 0.12));
  const placements: AtlasLabelPlacement[] = [];

  const clamp = (value: number, minimum: number, maximum: number) =>
    Math.max(minimum, Math.min(maximum, value));
  const boundsFor = (
    label: AtlasLabelSeed,
    centerX: number,
    centerY: number,
  ): AtlasLayoutBounds => ({
    left: centerX - label.width / 2,
    right: centerX + label.width / 2,
    top: centerY - label.height / 2,
    bottom: centerY + label.height / 2,
  });
  const overlaps = (candidate: AtlasLayoutBounds) =>
    [
      ...obstacles,
      ...placements.map((placement) =>
        boundsFor(placement, placement.x, placement.y),
      ),
    ].some(
      (placed) =>
        candidate.left < placed.right + collisionGap &&
        candidate.right > placed.left - collisionGap &&
        candidate.top < placed.bottom + collisionGap &&
        candidate.bottom > placed.top - collisionGap,
    );

  const orderedLabels = [...labels].sort(
    (left, right) =>
      left.anchorY - right.anchorY ||
      left.anchorX - right.anchorX ||
      left.id.localeCompare(right.id),
  );
  for (const label of orderedLabels) {
    const preferredSide: -1 | 1 =
      label.side ?? (label.anchorX < globe.centerX ? -1 : 1);
    const oppositeSide: -1 | 1 = preferredSide === 1 ? -1 : 1;
    const candidates = [-1, -1.55, -2.1, 0.9, 1.45].flatMap(
      (verticalOffset, slot) =>
        ([preferredSide, oppositeSide] as const).map((side) => ({
          side,
          slot,
          x: clamp(
            label.anchorX + side * (label.width / 2 + horizontalGap),
            margin + label.width / 2,
            width - margin - label.width / 2,
          ),
          y: clamp(
            label.anchorY + verticalRise * verticalOffset,
            margin + label.height / 2,
            height - margin - label.height / 2,
          ),
        })),
    );
    const previousIndex = candidates.findIndex(
      (candidate) =>
        candidate.side === preferredSide && candidate.slot === label.slot,
    );
    const previous = candidates[previousIndex];
    if (previousIndex > 0 && previous) {
      candidates.splice(previousIndex, 1);
      candidates.unshift(previous);
    }
    const target =
      candidates.find(
        (candidate) => !overlaps(boundsFor(label, candidate.x, candidate.y)),
      ) ?? candidates[0];
    placements.push({
      ...label,
      side: target.side,
      slot: target.slot,
      x: target.x,
      y: target.y,
    });
  }

  return placements;
}

export function atlasLabelLeaderPoints(
  anchor: readonly [x: number, y: number],
  placement: Pick<AtlasLabelPlacement, "x" | "y" | "width" | "height" | "side">,
): readonly [
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
] {
  const direction =
    placement.x === anchor[0]
      ? placement.side
      : placement.x > anchor[0]
        ? 1
        : -1;
  const endX = placement.x - direction * (placement.width / 2 - 5);
  const endY = placement.y + placement.height * 0.23;
  const bendX = endX - direction * 18;
  return [anchor, [bendX, endY], [endX, endY]];
}

export function atlasCanvasPixelRatio(devicePixelRatio: number) {
  const ratio = Number.isFinite(devicePixelRatio)
    ? Math.max(1, devicePixelRatio)
    : 1;
  return Math.min(2, ratio);
}

export type CountryCalloutSeed = {
  id: string;
  markerX: number;
  markerY: number;
  width: number;
  height: number;
};

export type CountryCalloutPlacement = CountryCalloutSeed & {
  left: number;
  top: number;
};

export function placeCountryCallouts(
  callouts: CountryCalloutSeed[],
  width: number,
  height: number,
  obstacles: AtlasLayoutBounds[] = [],
): CountryCalloutPlacement[] {
  const margin = 24;
  const gap = 44;
  const placed: CountryCalloutPlacement[] = [];
  const overlaps = (left: number, top: number, item: CountryCalloutSeed) =>
    placed.some(
      (other) =>
        left < other.left + other.width + 14 &&
        left + item.width > other.left - 14 &&
        top < other.top + other.height + 14 &&
        top + item.height > other.top - 14,
    ) ||
    obstacles.some(
      (obstacle) =>
        left < obstacle.right + 14 &&
        left + item.width > obstacle.left - 14 &&
        top < obstacle.bottom + 14 &&
        top + item.height > obstacle.top - 14,
    );
  const clamp = (value: number, minimum: number, maximum: number) =>
    Math.max(minimum, Math.min(maximum, value));

  for (const item of callouts) {
    const outward = item.markerX < width / 2 ? -1 : 1;
    const perimeterCandidates = [
      [margin, height * 0.46],
      [width - margin - item.width, height * 0.46],
      [margin, height - margin - item.height],
      [width / 2 - item.width / 2, height - margin - item.height],
      [width - margin - item.width, height - margin - item.height],
    ].sort(([leftA, topA], [leftB, topB]) => {
      const distanceA = Math.hypot(
        leftA + item.width / 2 - item.markerX,
        topA + item.height / 2 - item.markerY,
      );
      const distanceB = Math.hypot(
        leftB + item.width / 2 - item.markerX,
        topB + item.height / 2 - item.markerY,
      );
      return distanceA - distanceB;
    });
    const candidates = [
      [item.markerX - item.width / 2, item.markerY - item.height - gap],
      [
        item.markerX + outward * (gap + item.width / 2) - item.width / 2,
        item.markerY - item.height * 0.72,
      ],
      [
        item.markerX - outward * (gap + item.width / 2) - item.width / 2,
        item.markerY - item.height * 0.72,
      ],
      [item.markerX - item.width / 2, item.markerY + gap],
      ...perimeterCandidates,
    ].map(([left, top]) => [
      clamp(left, margin, width - margin - item.width),
      clamp(top, margin, height - margin - item.height),
    ]);
    const [left, top] =
      candidates.find(
        ([candidateLeft, candidateTop]) =>
          !overlaps(candidateLeft, candidateTop, item),
      ) ?? candidates[0];
    placed.push({ ...item, left, top });
  }
  return placed;
}
