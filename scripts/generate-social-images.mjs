import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDirectory = path.join(root, "public/media/projects");
const sources = [
  path.join(root, "public/og-default.svg"),
  ...(await readdir(projectDirectory))
    .filter((filename) => filename.endsWith(".svg"))
    .map((filename) => path.join(projectDirectory, filename)),
];

for (const source of sources) {
  const destination = source.replace(/\.svg$/, ".png");
  await sharp(source)
    .resize(1200, 630, { fit: "contain", background: "#f5f0e8" })
    .png({ compressionLevel: 9, palette: true })
    .toFile(destination);
  console.log(path.relative(root, destination));
}
