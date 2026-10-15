import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const sources = process.argv.slice(2);
if (sources.length !== 3)
  throw new Error("Pass the music, book, and compass source PNG paths.");
const destination = "public/media/site/about-nebula";
await mkdir(destination, { recursive: true });
for (const [index, id] of ["songs", "books", "hobbies"].entries()) {
  for (const size of [320, 640]) {
    await sharp(sources[index])
      .resize(size, size, { fit: "contain", background: "#00000000" })
      .ensureAlpha()
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(path.join(destination, `${id}-${size}.webp`));
  }
}
