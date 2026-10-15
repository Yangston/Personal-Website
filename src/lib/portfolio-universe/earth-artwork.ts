import { geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json";

const topology = countries110m as unknown as {
  objects: { countries: Parameters<typeof feature>[1] };
};
const countries = (
  feature(
    topology as never,
    topology.objects.countries,
  ) as unknown as GeoJSON.FeatureCollection
).features;
const cache = new Map<string, { land: string; visited: string }>();

/** Build-time SVG artwork uses the same public geography and poses as the globe. */
export function earthArtwork(
  rotation: readonly [number, number, number],
  visitedIds: readonly string[],
) {
  const key = `${rotation.join(",")}:${visitedIds.join(",")}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const projection = geoOrthographic()
    .translate([180, 180])
    .scale(164)
    .rotate([...rotation]);
  const path = geoPath(projection);
  const artwork = {
    land: countries.map((country) => path(country) ?? "").join(" "),
    visited: countries
      .filter((country) => visitedIds.includes(String(country.id)))
      .map((country) => path(country) ?? "")
      .join(" "),
  };
  cache.set(key, artwork);
  return artwork;
}
