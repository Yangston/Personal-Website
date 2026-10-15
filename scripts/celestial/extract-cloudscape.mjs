import fs from "node:fs/promises";
import sharp from "sharp";

const source = ".private/cloudscape-v3/originals";
const output = "public/media/site/celestial/cloudscape-v3";
// Crops identify real formations in the approved master. RGB is never repainted.
const clusters = [
  ["upper-left", 0, 0, 650, 420],
  ["upper-center", 500, 0, 520, 310],
  ["upper-right", 1120, 0, 552, 480],
  ["left-wall", 0, 200, 410, 580],
  ["lower-left", 0, 420, 690, 521],
  ["lower-center", 480, 580, 650, 361],
  ["right-wall", 1170, 300, 502, 641],
  ["lower-right", 850, 570, 780, 371],
  ["left-bridge", 200, 310, 410, 300],
  ["right-bridge", 1030, 370, 380, 360],
  ["crown-left", 220, 30, 300, 260],
  ["crown-middle", 610, 30, 240, 240],
  ["crown-right", 1400, 10, 272, 280],
  ["puff-left", 20, 400, 250, 240],
  ["puff-midleft", 220, 500, 280, 250],
  ["puff-lowerleft", 320, 700, 350, 241],
  ["puff-bottom", 590, 630, 310, 260],
  ["puff-right", 1390, 350, 282, 360],
  ["puff-lowerright", 1220, 670, 350, 271],
  ["bridge-center", 760, 460, 420, 370],
  ["distant-peak", 905, 620, 245, 245],
  ["mist", 340, 200, 480, 430],
];
const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const assets = {};
function checkerNeighborhood(rgb, width, height) {
  const count = width * height;
  const seen = new Uint8Array(count);
  const seeds = new Uint8Array(count);
  const queue = new Int32Array(count);
  const candidate = (i) => {
    const r = rgb[i * 3],
      g = rgb[i * 3 + 1],
      b = rgb[i * 3 + 2];
    return (
      Math.max(r, g, b) - Math.min(r, g, b) <= 5 &&
      Math.min(r, g, b) >= 210 &&
      Math.max(r, g, b) <= 248
    );
  };
  for (let start = 0; start < count; start++) {
    if (seen[start] || !candidate(start)) continue;
    let head = 0,
      tail = 1;
    queue[0] = start;
    seen[start] = 1;
    while (head < tail) {
      const i = queue[head++],
        x = i % width;
      for (const j of [
        x ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        i - width,
        i + width,
      ]) {
        if (j >= 0 && j < count && !seen[j] && candidate(j)) {
          seen[j] = 1;
          queue[tail++] = j;
        }
      }
    }

    if (tail >= 45) {
      for (let j = 0; j < tail; j++) seeds[queue[j]] = 1;
    }
  }
  const stride = width + 1,
    integral = new Int32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += seeds[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  const nearby = new Uint8Array(count);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const l = Math.max(0, x - 18),
        r = Math.min(width, x + 19),
        t = Math.max(0, y - 18),
        b = Math.min(height, y + 19);
      nearby[y * width + x] =
        integral[b * stride + r] -
          integral[t * stride + r] -
          integral[b * stride + l] +
          integral[t * stride + l] >
        0
          ? 1
          : 0;
    }
  return nearby;
}
await fs.mkdir(output, { recursive: true });
async function publish(id, data, width, height, channels = 4) {
  const variants = [];
  for (const target of [width, Math.max(1, Math.floor(width / 2))]) {
    const path = `${output}/${id}-${target}.webp`;
    const result = await sharp(data, { raw: { width, height, channels } })
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: 89, alphaQuality: 100, effort: 4 })
      .toFile(path);
    variants.push({
      source: `/${path.replace(/^public\//, "")}`,
      width: result.width,
      height: result.height,
    });
  }
  assets[id] = { desktop: variants[0], mobile: variants[1] };
}
async function masked(name, matteName, nebula = false) {
  const { data, info } = await sharp(`${source}/${name}.png`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const matte = await sharp(`${source}/${matteName}.png`)
    .resize(info.width, info.height, { fit: "fill" })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer();
  const rgba = Buffer.alloc(info.width * info.height * 4);
  const checker = nebula
    ? checkerNeighborhood(data, info.width, info.height)
    : null;
  const distance = new Uint16Array(matte.length);
  if (nebula) {
    // Enclosed white highlights remain foreground; suppress checker colors
    // only near the outer silhouette instead of punching holes in the clouds.
    const outside = new Uint8Array(matte.length);
    const queue = new Int32Array(matte.length);
    let head = 0;
    let tail = 0;
    const enqueue = (i) => {
      if (i >= 0 && i < matte.length && !outside[i] && matte[i] < 45) {
        outside[i] = 1;
        queue[tail++] = i;
      }
    };
    for (let x = 0; x < info.width; x++) {
      enqueue(x);
      enqueue((info.height - 1) * info.width + x);
    }
    for (let y = 0; y < info.height; y++) {
      enqueue(y * info.width);
      enqueue((y + 1) * info.width - 1);
    }
    while (head < tail) {
      const i = queue[head++];
      if (i % info.width) enqueue(i - 1);
      if (i % info.width < info.width - 1) enqueue(i + 1);
      enqueue(i - info.width);
      enqueue(i + info.width);
    }
    for (let i = 0; i < matte.length; i++) distance[i] = outside[i] ? 0 : 60000;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const i = y * info.width + x;
        if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
        if (y)
          distance[i] = Math.min(distance[i], distance[i - info.width] + 1);
      }
    for (let y = info.height - 1; y >= 0; y--)
      for (let x = info.width - 1; x >= 0; x--) {
        const i = y * info.width + x;
        if (x < info.width - 1)
          distance[i] = Math.min(distance[i], distance[i + 1] + 1);
        if (y < info.height - 1)
          distance[i] = Math.min(distance[i], distance[i + info.width] + 1);
      }
  }
  for (let i = 0; i < matte.length; i++) {
    const rgb = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    const chroma = Math.max(...rgb) - Math.min(...rgb);
    // Keep bright subject highlights; remove neutral checker pixels outside the
    // confident subject region of the generated matte.
    const a = smooth((matte[i] - (nebula ? 8 : 12)) / (nebula ? 28 : 70));
    rgba.set(rgb, i * 4);
    const core = smooth(distance[i] / 36);
    const edge = smooth((chroma - 3) / 13);
    const grid = checker?.[i] ? smooth((chroma - 4) / 16) : 1;
    // This open pocket is background, not part of the upper-left cloud fold.
    const pocket = Math.hypot(
      ((i % info.width) - 380) / 57,
      (Math.floor(i / info.width) - 264) / 58,
    );
    const clean = grid * (nebula ? smooth((pocket - 0.7) / 0.3) : 1);
    rgba[i * 4 + 3] = Math.round(
      255 *
        clean *
        (nebula ? Math.max(a, core) * (edge + (1 - edge) * core) : a),
    );
  }
  return { data: rgba, width: info.width, height: info.height };
}
const master = await sharp(`${source}/cloudscape.png`)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
await publish(
  "atmosphere",
  master.data,
  master.info.width,
  master.info.height,
  3,
);
const nebula = await masked("nebula", "nebula-matte", true);
await publish("nebula", nebula.data, nebula.width, nebula.height);
const clouds = await masked("cloudscape", "cloud-matte");
for (const [id, left, top, width, height] of clusters) {
  const data = await sharp(clouds.data, {
    raw: { width: clouds.width, height: clouds.height, channels: 4 },
  })
    .extract({ left, top, width, height })
    .raw()
    .toBuffer();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const edge = Math.min(
        x / width,
        (width - 1 - x) / width,
        y / height,
        (height - 1 - y) / height,
      );
      data[(y * width + x) * 4 + 3] *= smooth(edge / 0.14);
    }
  await publish(id, data, width, height);
}
await fs.writeFile(
  "src/data/cloudscape-artwork.json",
  `${JSON.stringify(assets, null, 2)}\n`,
);
console.log(
  `Prepared ${Object.keys(assets).length} assets / ${Object.keys(assets).length * 2} responsive WebPs from the two approved images.`,
);
