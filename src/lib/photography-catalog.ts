import photographyConfig from "@/config/photography.json";

export type GalleryCity = {
  id: string;
  regionKey: string;
  country: string;
  region: string;
  name: string;
  description: string;
  center: { latitude: number; longitude: number };
  bounds: { west: number; south: number; east: number; north: number };
  samplePhotoIds: string[];
};

const regions = new Map(
  photographyConfig.regions.map((region) => [region.key, region]),
);

export const galleryCities: GalleryCity[] = photographyConfig.cities.map(
  (city) => {
    const region = regions.get(city.regionKey);
    if (!region)
      throw new Error(
        `Photography city ${city.id} references unknown region ${city.regionKey}.`,
      );
    return {
      ...city,
      country: region.country,
      region: region.id,
    };
  },
);

export function getGalleryCitiesForCountry(country: string) {
  return galleryCities.filter((city) => city.country === country);
}

export function getGalleryCity(country: string, cityId: string) {
  return galleryCities.find(
    (city) => city.country === country && city.id === cityId,
  );
}
