import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  easeCloudLight,
  sampleCloudLight,
  sampleNebulaSwirls,
  nebulaSwirlEnvelope,
  NEBULA_SWIRL_LIMIT,
  sampleNebulaSwirlOffset,
} from "../../src/lib/portfolio-universe/nebula-light";
import {
  NEBULA_INTEREST_REGIONS,
  nebulaFoldMask,
} from "../../src/lib/portfolio-universe/nebula-regions";
import {
  SCENE_MANIFEST,
  resolveWorldPlane,
} from "../../src/lib/portfolio-universe/scene-manifest";
import { worldPlateOpacity } from "../../src/lib/portfolio-universe/artwork-motion";

describe("internal cloud light", () => {
  it("keeps the moving core and spill inside the visible cloud ridge", async () => {
    for (const [i, region] of NEBULA_INTEREST_REGIONS.entries()) {
      const svg = decodeURIComponent(
        nebulaFoldMask(region.middle).split(",")[1],
      );
      const { data, info } = await sharp(Buffer.from(svg))
        .resize(100, 100)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let time = 0; time < 90000; time += 500) {
        const light = sampleCloudLight(time, i, 0);
        for (const [x, y] of [
          [light.x, light.y],
          [light.spillX, light.spillY],
        ])
          expect(
            data[(Math.round(y) * 100 + Math.round(x)) * info.channels + 3],
            `${region.id} ridge at ${x},${y}`,
          ).toBeGreaterThan(90);
      }
    }
  });
  it("moves independently within the fold and doubles energy without changing its path", () => {
    for (let time = 0; time < 90000; time += 500) {
      const samples = [0, 1, 2].map((i) => sampleCloudLight(time, i, 0));
      expect(new Set(samples.map((s) => s.x)).size).toBe(3);
      samples.forEach((idle, i) => {
        const hover = sampleCloudLight(time, i, 1);
        expect(hover).toEqual({ ...idle, intensity: idle.intensity * 2 });
        expect(idle.x).toBeGreaterThanOrEqual(27);
        expect(idle.x).toBeLessThanOrEqual(73);
        expect(idle.y).toBeGreaterThanOrEqual(30);
        expect(idle.y).toBeLessThanOrEqual(70);
      });
    }
  });
  it("freezes motion while retaining interactive emphasis", () => {
    for (let i = 0; i < 3; i++) {
      expect(sampleCloudLight(0, i, 0, true)).toEqual(
        sampleCloudLight(80000, i, 0, true),
      );
      expect(sampleCloudLight(80000, i, 1, true).intensity).toBe(0.6);
    }
    expect(
      sampleNebulaSwirls(80000, true).every((s) => s.dx === 0 && s.dy === 0),
    ).toBe(true);
  });
  it("rises and releases at frame-rate-independent rates with reversible emphasis", () => {
    expect(easeCloudLight(0, 1, 180)).toBeGreaterThan(0.98);
    expect(easeCloudLight(1, 0, 300)).toBeLessThan(0.02);
    const half = easeCloudLight(0, 1, 90);
    expect(easeCloudLight(half, 1, 90)).toBeCloseTo(easeCloudLight(0, 1, 180));
    expect(easeCloudLight(half, 0, 30)).toBeLessThan(half);
  });
});

describe("About peripheral motion and clarity", () => {
  it("curls in opposite directions across a peripheral center without moving protected content", () => {
    const left = sampleNebulaSwirlOffset(0.08, 0.46, 0);
    const right = sampleNebulaSwirlOffset(0.195, 0.46, 0);
    expect(left.y).toBeLessThan(0);
    expect(right.y).toBeGreaterThan(0);
    for (let t = 0; t < 60000; t += 3000) {
      for (let x = 0; x <= 1; x += 0.05) {
        for (let y = 0; y <= 1; y += 0.05) {
          const offset = sampleNebulaSwirlOffset(x, y, t);
          expect(Math.hypot(offset.x, offset.y)).toBeLessThanOrEqual(
            NEBULA_SWIRL_LIMIT + 1e-10,
          );
        }
      }
      for (const { anchor } of NEBULA_INTEREST_REGIONS) {
        const offset = sampleNebulaSwirlOffset(anchor.x, anchor.y, t);
        expect(Math.hypot(offset.x, offset.y)).toBe(0);
      }
      const still = sampleNebulaSwirlOffset(0.1, 0.46, t, true);
      expect(Math.hypot(still.x, still.y)).toBe(0);
    }
    expect(sampleNebulaSwirlOffset(0.1, 0.46, 0)).not.toEqual(
      sampleNebulaSwirlOffset(0.1, 0.46, 9000),
    );
  });
  it("bounds swirl displacement and protects the eye and complete interactive crops", () => {
    for (let t = 0; t < 60000; t += 500)
      for (const s of sampleNebulaSwirls(t))
        expect(Math.hypot(s.dx, s.dy)).toBeLessThanOrEqual(
          NEBULA_SWIRL_LIMIT + 1e-10,
        );
    expect(nebulaSwirlEnvelope(0.465, 0.435)).toBe(0);
    for (const { bounds: b } of NEBULA_INTEREST_REGIONS)
      for (let x = 0; x <= 10; x++)
        for (let y = 0; y <= 10; y++)
          expect(
            nebulaSwirlEnvelope(
              b.x + (b.width * x) / 10,
              b.y + (b.height * y) / 10,
            ),
          ).toBeCloseTo(0);
    expect(nebulaSwirlEnvelope(0.82, 0.7)).toBe(1);
  });
  it("removes foreground haze at arrival while preserving the approach", () => {
    const foreground = SCENE_MANIFEST.planes.filter(
      (p) =>
        !p.approach &&
        !p.projectCloud &&
        p.sceneOpacity?.about === 0 &&
        p.sceneOpacity?.home !== 0 &&
        p.id !== "nebula",
    );
    expect(foreground.length).toBeGreaterThan(0);
    for (const plane of foreground) {
      expect(
        worldPlateOpacity(plane, { home: 0, about: 1, projects: 0, travel: 0 }),
      ).toBe(0);
      expect(
        worldPlateOpacity(plane, {
          home: 0.5,
          about: 0.5,
          projects: 0,
          travel: 0,
        }),
      ).toBeGreaterThan(0);
    }
    const backdropClouds = SCENE_MANIFEST.planes.filter(
      (p) =>
        p.position.z <= SCENE_MANIFEST.anchors.about.z &&
        p.position.z > -90 &&
        p.sceneOpacity?.about === 0.1,
    );
    expect(backdropClouds.length).toBeGreaterThan(0);
  });
  it("removes clouds ahead of the final nebula depth, including formerly distant clouds", () => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
      [320, 700],
    ]) {
      const planes = SCENE_MANIFEST.planes.map((p) =>
        resolveWorldPlane(p, width, height),
      );
      const nebula = planes.find((p) => p.id === "nebula")!;
      const foreground = planes.filter(
        (p) =>
          !p.approach && !p.projectCloud && p.position.z > nebula.position.z,
      );
      expect(foreground.some((p) => p.id === "far-cloud-top")).toBe(true);
      for (const plane of foreground) {
        expect(
          worldPlateOpacity(plane, {
            home: 0,
            about: 1,
            projects: 0,
            travel: 0,
          }),
          plane.id,
        ).toBe(0);
      }
      expect(
        worldPlateOpacity(
          planes.find((p) => p.id === "panorama")!,
          { home: 0, about: 1, projects: 0, travel: 0 },
        ),
      ).toBe(1);
    }
  });
});
