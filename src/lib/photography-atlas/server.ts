import { geoAlbersUsa, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries50m from "world-atlas/countries-50m.json";
import countries110m from "world-atlas/countries-110m.json";
import { countryAtlasId } from "./data";
import { hongKongAtlasFeature } from "./hong-kong";

type AtlasFeature = GeoJSON.Feature<GeoJSON.Geometry, { name?: string }>;
type AtlasCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { name?: string }
>;
type AtlasTopology = {
  objects: { countries: Parameters<typeof feature>[1] };
};
type Point = [number, number];

function squaredDistanceToSegment(point: Point, start: Point, end: Point) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const ratio =
      ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (ratio > 1) {
      x = end[0];
      y = end[1];
    } else if (ratio > 0) {
      x += dx * ratio;
      y += dy * ratio;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyLine(points: Point[], toleranceSquared: number): Point[] {
  if (points.length <= 2) return points;
  let furthestIndex = -1;
  let furthestDistance = toleranceSquared;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = squaredDistanceToSegment(
      points[index],
      points[0],
      points.at(-1)!,
    );
    if (distance > furthestDistance) {
      furthestIndex = index;
      furthestDistance = distance;
    }
  }
  if (furthestIndex < 0) return [points[0], points.at(-1)!];
  return simplifyLine(points.slice(0, furthestIndex + 1), toleranceSquared)
    .slice(0, -1)
    .concat(simplifyLine(points.slice(furthestIndex), toleranceSquared));
}

function simplifyProjectedPath(path: string, tolerance = 0.6) {
  return path.replace(/M[^Z]+Z/g, (ring) => {
    const points = [...ring.matchAll(/(-?\d+),(-?\d+)/g)]
      .map<Point>((match) => [Number(match[1]), Number(match[2])])
      .filter(
        (point, index, all) =>
          index === 0 ||
          point[0] !== all[index - 1][0] ||
          point[1] !== all[index - 1][1],
      );
    const simplified = simplifyLine(points, tolerance * tolerance);
    if (simplified.length < 3) return "";
    return `M${simplified.map((point) => point.join(",")).join("L")}Z`;
  });
}

function atlasFeatures(topology: object) {
  const typed = topology as AtlasTopology;
  return (
    feature(
      typed as never,
      typed.objects.countries,
    ) as unknown as AtlasCollection
  ).features;
}

const worldFeatures = atlasFeatures(countries50m);
const transitionFeatures = atlasFeatures(countries110m);

function findAtlasFeature(source: AtlasFeature[], slug: string) {
  const atlasId = countryAtlasId(slug);
  if (!atlasId)
    throw new Error(`Photography country ${slug} has no World Atlas ID.`);
  const features = slug === "hong-kong" ? [hongKongAtlasFeature] : source;
  const country = features.find((item) => Number(item.id) === atlasId);
  if (!country)
    throw new Error(
      `Photography country ${slug} could not resolve World Atlas ID ${atlasId}.`,
    );
  return country;
}

export function getAtlasFeature(slug: string): AtlasFeature {
  return findAtlasFeature(worldFeatures, slug);
}

export function getHongKongAtlasFeature() {
  return hongKongAtlasFeature;
}

function countryMapProjection(
  slug: string,
  width: number,
  height: number,
  country: AtlasFeature,
) {
  const projection = slug === "united-states" ? geoAlbersUsa() : geoMercator();
  return projection.fitExtent(
    [
      [width * 0.12, height * 0.16],
      [width * 0.88, height * 0.9],
    ],
    country,
  );
}

export function countrySilhouettePath(slug: string, width = 960, height = 720) {
  const country = getAtlasFeature(slug);
  const projection = countryMapProjection(slug, width, height, country);
  const detailedPath = geoPath(projection).digits(0)(country) ?? "";
  return {
    path: simplifyProjectedPath(detailedPath, slug === "canada" ? 0.8 : 0.6),
    projection: slug === "united-states" ? "albers-usa" : "mercator",
    project: (longitude: number, latitude: number) =>
      projection([longitude, latitude]) ?? [width / 2, height / 2],
  };
}

export function countryTransitionPath(slug: string, width = 960, height = 720) {
  const country = findAtlasFeature(transitionFeatures, slug);
  const projection = countryMapProjection(slug, width, height, country);
  return simplifyProjectedPath(
    geoPath(projection).digits(0)(country) ?? "",
    10,
  );
}
