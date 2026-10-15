import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Originals are intentionally private; display assets retain their generated alpha.
const source = path.resolve(".private/cinematic-refinement/originals");
const output = path.resolve("public/media/site/celestial");
const names = [
  "nebula-eye-v2",
  "cloud-pillows-v2",
  "cloud-crown-v2",
  "cloud-filaments-v2",
];

await fs.mkdir(output, { recursive: true });
for (const name of names) {
  const original = path.join(source, `${name}.png`);
  const metadata = await sharp(original).metadata();
  if (!metadata.hasAlpha) throw new Error(`${name} requires generated alpha`);
  for (const width of [1536, 768]) {
    const destination = path.join(output, `${name}-${width}.webp`);
    await sharp(original)
      .resize(width, Math.round((width * 2) / 3), { fit: "contain" })
      .webp({ quality: 88, alphaQuality: 100, effort: 6 })
      .toFile(destination);
    console.log(
      `${path.relative(process.cwd(), destination)}: ${(await fs.stat(destination)).size} bytes`,
    );
  }
}
