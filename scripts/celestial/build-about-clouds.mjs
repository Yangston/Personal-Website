import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// All layers share a canvas and the source alpha; folds never drift out of registration.
const destination = "public/media/site/about-clouds";
const sources = process.argv.slice(2);
if (sources.length !== 3)
  throw new Error("Pass music, book, and compass PNG paths.");
await mkdir(destination, { recursive: true });
const ids = ["songs", "books", "hobbies"];
for (const [index, source] of sources.entries()) {
  const input = await readFile(source);
  for (const size of [320, 640]) {
    const { data, info } = await sharp(input)
      .resize(size, size)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (const layer of ["rear", "middle", "front", "light"]) {
      const pixels = Buffer.from(data);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const offset = (y * size + x) * 4;
          const u = x / size,
            v = y / size;
          const ridge =
            0.57 + Math.sin(u * 15 + index) * 0.025 + Math.sin(u * 29) * 0.012;
          const threshold = layer === "front" ? ridge : 0.34;
          const t = Math.max(0, Math.min(1, (v - threshold) / 0.035));
          if (layer === "front" || layer === "middle")
            pixels[offset + 3] *= t * t * (3 - 2 * t);
          if (layer === "light") {
            const luminance =
              (data[offset] * 0.3 +
                data[offset + 1] * 0.59 +
                data[offset + 2] * 0.11) /
              255;
            pixels[offset + 3] *= Math.max(0, (luminance - 0.42) / 0.58);
            pixels[offset] = 255;
            pixels[offset + 1] = 231;
            pixels[offset + 2] = 179;
          }
        }
      await sharp(pixels, {
        raw: { width: size, height: size, channels: info.channels },
      })
        .webp({ quality: 88, alphaQuality: 100 })
        .toFile(path.join(destination, `${ids[index]}-${layer}-${size}.webp`));
    }
  }
}
await writeFile(
  path.join(destination, "README.md"),
  "# About cloud artwork\n\nGenerated with the built-in image generator. Responsive, registered layers are exported by `scripts/celestial/build-about-clouds.mjs` from three transparent PNGs (music, book, compass). The source alpha is preserved. Middle and foreground layers isolate feathered folds; the light layer retains source highlights. No original full-resolution PNGs are published. See `docs/ABOUT-CLOUDS.md` for prompts and behavior.\n",
);
