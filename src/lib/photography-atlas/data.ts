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

export function placeGlobeAroundHeading(
  width: number,
  height: number,
  desiredScale: number,
  heading: AtlasLayoutBounds | null,
  gap = 28,
) {
  if (!heading)
    return { centerX: width / 2, centerY: height / 2, scale: desiredScale };

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
