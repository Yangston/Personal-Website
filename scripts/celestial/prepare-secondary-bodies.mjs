import fs from "node:fs/promises";
import sharp from "sharp";

// ImageGen supplies the original artwork and exact opacity mattes. Preserve RGB.
const source = ".private/interactive-world/body-originals";
const output = "public/media/site/celestial/bodies-v1";
const ids = [
  "ringed-planet",
  "crescent-moon",
  "asteroid-chalk",
  "asteroid-iron",
  "asteroid-ice",
];
const catalog = {};
await fs.mkdir(output, { recursive: true });
for (const id of ids) {
  const { data: rgb, info } = await sharp(`${source}/${id}.png`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const matte = await sharp(`${source}/${id}-matte.png`)
    .resize(info.width, info.height, { fit: "fill" })
    .removeAlpha()
    .greyscale()
    .erode(3)
    .blur(0.5)
    .raw()
    .toBuffer();
  if (id !== "ringed-planet") {
    // Craters are opaque surface, not holes. Retain only transparency connected
    // to the outside of these solid bodies; ring openings remain intentional.
    const outside = new Uint8Array(matte.length);
    const queue = new Int32Array(matte.length);
    let head = 0,
      tail = 0;
    const visit = (i) => {
      if (i < 0 || i >= matte.length || outside[i] || matte[i] >= 128) return;
      outside[i] = 1;
      queue[tail++] = i;
    };
    for (let x = 0; x < info.width; x++) {
      visit(x);
      visit((info.height - 1) * info.width + x);
    }
    for (let y = 0; y < info.height; y++) {
      visit(y * info.width);
      visit((y + 1) * info.width - 1);
    }
    while (head < tail) {
      const i = queue[head++],
        x = i % info.width;
      if (x) visit(i - 1);
      if (x < info.width - 1) visit(i + 1);
      visit(i - info.width);
      visit(i + info.width);
    }
    for (let i = 0; i < matte.length; i++) if (!outside[i]) matte[i] = 255;
  }
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < matte.length; i++) {
    const t = Math.max(0, Math.min(1, (matte[i] - 12) / 230));
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  const variants = [];
  for (const width of [1024, 512]) {
    const path = `${output}/${id}-${width}.webp`;
    const result = await sharp(rgba, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100, effort: 5 })
      .toFile(path);
    variants.push({
      source: `/${path.replace(/^public\//, "")}`,
      width: result.width,
      height: result.height,
    });
  }
  catalog[id] = { desktop: variants[0], mobile: variants[1] };
}
await fs.writeFile(
  "src/data/celestial-body-artwork.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(`Published ${ids.length} unique bodies, two alpha WebPs each.`);
