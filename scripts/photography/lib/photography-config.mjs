import { readFileSync } from "node:fs";

const configPath = new URL(
  "../../../src/config/photography.json",
  import.meta.url,
);
const config = JSON.parse(readFileSync(configPath, "utf8"));

if (!Array.isArray(config.regions) || !Array.isArray(config.cities))
  throw new Error(
    "Photography configuration requires regions and cities arrays.",
  );

export const photographyRegions = config.regions;
export const photographyRegionByKey = new Map();
export const photographyRegionByArchivePath = new Map();

for (const region of photographyRegions) {
  if (
    !region.key ||
    !region.country ||
    !region.archiveCountry ||
    !region.id ||
    !region.name ||
    region.key !== `${region.country}/${region.id}`
  )
    throw new Error(
      `Invalid photography region configuration: ${JSON.stringify(region)}`,
    );
  if (photographyRegionByKey.has(region.key))
    throw new Error(`Duplicate photography region key: ${region.key}`);
  const archivePath = `${region.archiveCountry}/${region.id}`;
  if (photographyRegionByArchivePath.has(archivePath))
    throw new Error(`Duplicate photography archive path: ${archivePath}`);
  photographyRegionByKey.set(region.key, region);
  photographyRegionByArchivePath.set(archivePath, region);
}

const cityIds = new Set();
export const photographyCities = config.cities.map((city) => {
  const region = photographyRegionByKey.get(city.regionKey);
  if (!region)
    throw new Error(
      `Photography city ${city.id} references unknown region ${city.regionKey}.`,
    );
  if (
    !city.id ||
    !city.name ||
    !city.description ||
    !city.center ||
    !Number.isFinite(city.center.latitude) ||
    !Number.isFinite(city.center.longitude) ||
    !city.bounds ||
    city.bounds.west > city.bounds.east ||
    city.bounds.south > city.bounds.north ||
    !Array.isArray(city.samplePhotoIds) ||
    city.samplePhotoIds.length < 1 ||
    city.samplePhotoIds.length > 2 ||
    new Set(city.samplePhotoIds).size !== city.samplePhotoIds.length
  )
    throw new Error(`Invalid photography city: ${JSON.stringify(city)}`);
  if (cityIds.has(city.id))
    throw new Error(`Duplicate photography city ID: ${city.id}`);
  cityIds.add(city.id);
  return {
    ...city,
    country: region.country,
    archiveCountry: region.archiveCountry,
    region: region.id,
  };
});

const cityRegionKeys = new Set(
  photographyCities.map((city) => `${city.country}/${city.region}`),
);
for (const region of photographyRegions)
  if (!cityRegionKeys.has(region.key))
    throw new Error(`Photography region ${region.key} has no city gallery.`);
