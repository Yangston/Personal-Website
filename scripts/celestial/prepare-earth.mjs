import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { geoOrthographic } from "d3-geo";

const root = path.resolve(import.meta.dirname, "../..");
const sources = path.join(root, ".private/celestial-sources");
const output = path.join(root, "public/media/site/celestial");
const resources = {
  day: "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/june/world.topo.bathy.200406.3x5400x2700.jpg",
  clouds:
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg",
  night:
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg",
};
await fs.mkdir(sources, { recursive: true });
await fs.mkdir(output, { recursive: true });
for (const [name, url] of Object.entries(resources)) {
  const source = path.join(sources, `earth-${name}.jpg`);
  if (process.argv.includes("--download")) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    await fs.writeFile(source, Buffer.from(await response.arrayBuffer()));
  }
  for (const width of [2048, 1024]) {
    await sharp(source)
      .resize(width, width / 2)
      .webp({ quality: 92, effort: 6 })
      .toFile(path.join(output, `earth-${name}-${width}.webp`));
  }
}

// A deterministic orthographic raster keeps the no-WebGL Earth recognizable.
// Geographic input and rotation match the public atlas; no private photo data.
const { data: surface, info } = await sharp(path.join(sources, "earth-day.jpg"))
  .resize(2048, 1024)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { data: cloudMap } = await sharp(path.join(sources, "earth-clouds.jpg"))
  .resize(2048, 1024)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
for (const [name, rotation] of [
  ["home", [85, 5, 0]],
  ["travel", [-108, -22, 0]],
]) {
  const size = 1024;
  const radius = size / 2 - 2;
  const projection = geoOrthographic()
    .translate([size / 2, size / 2])
    .scale(radius)
    .rotate(rotation);
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - size / 2) / radius;
      const ny = (size / 2 - y) / radius;
      const rr = nx * nx + ny * ny;
      if (rr >= 1) continue;
      const coordinates = projection.invert([x, y]);
      const longitude = (((coordinates[0] + 180) % 360) + 360) % 360;
      const ix = Math.min(
        info.width - 1,
        Math.floor((longitude / 360) * info.width),
      );
      const iy = Math.min(
        info.height - 1,
        Math.max(0, Math.floor(((90 - coordinates[1]) / 180) * info.height)),
      );
      const sourceIndex = (iy * info.width + ix) * info.channels;
      const rgb = [
        surface[sourceIndex],
        surface[sourceIndex + 1],
        surface[sourceIndex + 2],
      ];
      const ocean = rgb[2] > rgb[0] * 1.15 && rgb[2] > rgb[1] * 0.94;
      const tint = ocean ? [153, 168, 172] : [230, 218, 197];
      const mix = ocean ? 0.73 : 0.56;
      const sunlight = Math.max(
        0,
        nx * -0.38 + ny * 0.53 + Math.sqrt(1 - rr) * 0.82,
      );
      const cloud =
        Math.max(0, (cloudMap[sourceIndex] / 255 - 0.1) / 0.8) * 0.42;
      const index = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const base =
          (rgb[channel] * (1 - mix) + tint[channel] * mix) *
          (0.8 + sunlight * 0.23);
        pixels[index + channel] = Math.min(
          255,
          base * (1 - cloud) + [255, 248, 238][channel] * cloud,
        );
      }
      pixels[index + 3] = Math.min(255, (1 - Math.sqrt(rr)) * radius * 255);
    }
  }
  await sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(path.join(output, `earth-${name}-fallback.webp`));
}
console.log(
  "Prepared six NASA texture variants and two orthographic fallback views.",
);
