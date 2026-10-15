import { resolveCloudLayout } from "../../src/lib/portfolio-universe/cloud-layout";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  NEBULA_INTEREST_REGIONS,
  nebulaFoldMask,
  placeNebulaRegions,
} from "../../src/lib/portfolio-universe/nebula-regions";
import {
  createNebulaMaterial,
  updateNebulaMaterial,
} from "../../src/lib/portfolio-universe/nebula-material";
import {
  SCENE_MANIFEST,
  resolveWorldPlane,
} from "../../src/lib/portfolio-universe/scene-manifest";
import { sampleWorldPlate } from "../../src/lib/portfolio-universe/artwork-motion";
import { runInNewContext } from "node:vm";

describe("natural nebula folds", () => {
  it("feathers every mask boundary to transparency and retains a substantial interior", async () => {
    for (const region of NEBULA_INTEREST_REGIONS)
      for (const path of [region.middle, region.front]) {
        const svg = decodeURIComponent(nebulaFoldMask(path).split(",")[1]);
        const { data, info } = await sharp(Buffer.from(svg))
          .resize(100, 100)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const alpha = (x: number, y: number) =>
          data[(y * 100 + x) * info.channels + 3];
        for (let i = 0; i < 100; i++)
          expect(
            Math.max(alpha(i, 0), alpha(i, 99), alpha(0, i), alpha(99, i)),
          ).toBeLessThan(8);
        expect(
          Array.from(
            { length: 10000 },
            (_, i) => data[i * info.channels + 3],
          ).filter((a) => a > 200).length,
        ).toBeGreaterThan(800);
      }
  });
  it("uses identical source UV placement in inline markup and the runtime", () => {
    const serialized = runInNewContext(
      `(${placeNebulaRegions.toString()})`,
    ) as typeof placeNebulaRegions;
    const makeRoot = () => {
      const nodes = NEBULA_INTEREST_REGIONS.map(() => {
        const values = new Map<string, string>();
        return {
          dataset: {},
          values,
          style: {
            getPropertyValue: (key: string) => values.get(key) ?? "",
            setProperty: (key: string, value: string) => {
              values.set(key, value);
            },
          },
        };
      });
      return {
        nodes,
        root: {
          querySelector(selector: string) {
            return nodes[
              NEBULA_INTEREST_REGIONS.findIndex((r) => selector.includes(r.id))
            ];
          },
        } as unknown as ParentNode,
      };
    };
    const a = makeRoot(),
      b = makeRoot();
    const projection = {
      bounds: { left: -100, top: 188, width: 560, height: 373 },
    };
    placeNebulaRegions(
      a.root,
      NEBULA_INTEREST_REGIONS,
      projection,
      { width: 390, height: 844 },
      resolveCloudLayout,
    );
    serialized(
      b.root,
      NEBULA_INTEREST_REGIONS,
      projection,
      { width: 390, height: 844 },
      resolveCloudLayout,
    );
    expect(a.nodes.map((n) => [...n.values])).toEqual(
      b.nodes.map((n) => [...n.values]),
    );
    for (const [i, node] of a.nodes.entries()) {
      expect(parseFloat(node.values.get("--nebula-offset-x")!)).toBeCloseTo(
        -NEBULA_INTEREST_REGIONS[i].bounds.x * 560,
      );
    }
  });
  it("isolates About lighting and freezes its background while retaining Home movement", () => {
    const material = createNebulaMaterial();
    updateNebulaMaterial(material, 2000, 0.5, false, 1, 1);
    expect(material.uniforms.uAbout.value).toBe(1);
    expect(material.uniforms.uWarp.value).toBe(0);
    updateNebulaMaterial(material, 2000, 0.5, false, 1, 0);
    expect(material.uniforms.uAbout.value).toBe(0);
    expect(material.uniforms.uWarp.value).toBeGreaterThan(0);
    material.dispose();
    const plane = resolveWorldPlane(
      SCENE_MANIFEST.planes.find((p) => p.id === "nebula")!,
      1440,
      900,
    );
    expect(sampleWorldPlate(plane, 20000, 1)).toEqual(
      sampleWorldPlate(plane, 0, 1),
    );
    expect(sampleWorldPlate(plane, 20000, 0)).not.toEqual(
      sampleWorldPlate(plane, 0, 0),
    );
  });
});
