import fs from "node:fs/promises";
import sharp from "sharp";
import catalog from "../../src/data/cloudscape-artwork.json" with { type: "json" };

const { data, info } = await sharp(`public${catalog.nebula.desktop.source}`)
  .ensureAlpha()
  .resize({ width: 192 })
  .raw()
  .toBuffer({ resolveWithObject: true });
const center = [0.49, 0.46];
const points = [];
for (let i = 0; i < 96; i++) {
  const angle = (i / 96) * Math.PI * 2;
  let radius = 0;
  for (let r = 0; r < 0.85; r += 0.003) {
    const x = Math.round((center[0] + Math.cos(angle) * r) * (info.width - 1));
    const y = Math.round((center[1] + Math.sin(angle) * r) * (info.height - 1));
    if (
      x >= 0 &&
      x < info.width &&
      y >= 0 &&
      y < info.height &&
      data[(y * info.width + x) * 4 + 3] > 42
    )
      radius = r;
  }
  points.push([
    Number(
      Math.max(
        0,
        Math.min(1, center[0] + Math.cos(angle) * (radius + 0.012)),
      ).toFixed(5),
    ),
    Number(
      Math.max(
        0,
        Math.min(1, center[1] + Math.sin(angle) * (radius + 0.012)),
      ).toFixed(5),
    ),
  ]);
}
await fs.writeFile(
  "src/data/nebula-hit-contour.json",
  `${JSON.stringify(points)}\n`,
);
console.log(
  `Prepared ${points.length} contour points from the approved nebula alpha.`,
);
