import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  createCompositionFrame,
  SCENE_MANIFEST,
  resolveWorldPlane,
} from "../../src/lib/portfolio-universe/scene-manifest";
import contour from "../../src/data/nebula-hit-contour.json" with { type: "json" };
import {
  createProjectConstellationManifest,
  createProjectConstellationWorldPoints,
} from "../../src/lib/portfolio-universe/project-constellations";
import {
  projectHomeRegions,
  pointInRegion,
  regionLayout,
} from "../../src/lib/portfolio-universe/home-regions";
import {
  easeInteraction,
  sampleNebulaPatches,
  sampleShootingStar,
  createShootingStarGate,
} from "../../src/lib/portfolio-universe/ambient-effects";
import {
  CELESTIAL_BODIES,
  bodyArtwork,
  sampleBody,
} from "../../src/lib/portfolio-universe/body-manifest";

describe("native celestial regions", () => {
  test.each([
    [1440, 900],
    [1659, 948],
    [390, 844],
    [320, 700],
  ])("silhouettes and all stars are reachable at %i x %i", (width, height) => {
    const frame = createCompositionFrame("home", width, height, SCENE_MANIFEST);
    const nebula = resolveWorldPlane(
      SCENE_MANIFEST.planes.find((p) => p.id === "nebula")!,
      width,
      height,
    );
    const stars = createProjectConstellationManifest([
      "sightline",
      "robotic-card-thrower",
      "sleep-wake-model",
    ]).flatMap((p) =>
      createProjectConstellationWorldPoints(p, SCENE_MANIFEST.anchors.projects),
    );
    const regions = projectHomeRegions(frame.project, frame.pose.position, {
      earth: SCENE_MANIFEST.anchors.earth,
      radius: SCENE_MANIFEST.earthRadius,
      nebula,
      contour,
      stars,
    });
    expect(regions).toHaveLength(3);
    const projects = regions.find((r) => r.id === "projects")!,
      about = regions.find((r) => r.id === "about")!,
      earth = regions.find((r) => r.id === "travel")!;
    for (const point of stars)
      expect(pointInRegion(frame.project(point)!, projects)).toBe(true);
    expect(pointInRegion(frame.project(nebula.position)!, about)).toBe(true);
    expect(pointInRegion({ x: width * 0.86, y: height * 0.86 }, earth)).toBe(
      true,
    );
    for (const region of regions) {
      const bounds = regionLayout(region);
      expect(pointInRegion({ x: bounds.left, y: bounds.top }, region)).toBe(
        false,
      );
      expect(
        region.points.every(
          (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
        ),
      ).toBe(true);
    }
    expect(earth.depth).toBeLessThan(about.depth);
    expect(about.depth).toBeGreaterThan(projects.depth);
  });
});

describe("bounded shared-clock effects", () => {
  test("hover arrival and release reach their targets without overshooting", () => {
    const on = easeInteraction(0, 1, 180);
    expect(on).toBeGreaterThan(0.97);
    expect(on).toBeLessThan(1);
    const off = easeInteraction(1, 0, 280);
    expect(off).toBeLessThan(0.03);
    expect(off).toBeGreaterThan(0);
    expect(easeInteraction(0, 1, 10, true)).toBe(1);
  });
  test("nebula has at most two active folds and stays bounded or frozen", () => {
    for (const t of [0, 1000, 5200, 19400, 99000]) {
      const a = sampleNebulaPatches(t, 0.83);
      expect(sampleNebulaPatches(t, 0.83)).toEqual(a);
      expect(a.weights.filter((n) => n > 0.0001).length).toBeLessThanOrEqual(2);
      expect(a.weights.reduce((s, n) => s + n, 0)).toBeCloseTo(0.83);
      expect(a.warp).toBeLessThanOrEqual(0.01);
    }
    expect(sampleNebulaPatches(0, 0.83, true)).toEqual(
      sampleNebulaPatches(99000, 0.83, true),
    );
    expect(sampleNebulaPatches(0, 1, true).warp).toBe(0);
  });
  test("shooting stars have isolated seeded events and suppress flight-time starts", () => {
    const events = new Map<number, number>();
    let sample = null as ReturnType<typeof sampleShootingStar>;
    for (let t = 0; t < 300000; t += 10) {
      const value = sampleShootingStar(t);
      if (!value) continue;
      expect(value.durationMs).toBeGreaterThanOrEqual(900);
      expect(value.durationMs).toBeLessThanOrEqual(1400);
      expect(sampleShootingStar(t)).toEqual(value);
      if (!events.has(value.event)) events.set(value.event, t);
      sample ??= value;
    }
    const times = [...events.values()];
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(14000);
      expect(times[i] - times[i - 1]).toBeLessThanOrEqual(28010);
    }
    expect(sample).not.toBeNull();
    const gate = createShootingStarGate();
    expect(gate(sample, true)).toBeNull();
    expect(gate(sample, false)).toBeNull();
    gate(null, false);
    expect(gate(sample, false)).toEqual(sample);
    expect(gate(sample, true)).toEqual(sample);
    expect(sampleShootingStar(23000, true)).toBeNull();
  });
});

test("five unique bodies have distinct alpha artwork and stable reduced-motion poses", async () => {
  expect(CELESTIAL_BODIES).toHaveLength(5);
  expect(new Set(CELESTIAL_BODIES.map((b) => b.id)).size).toBe(5);
  const fingerprints = await Promise.all(
    CELESTIAL_BODIES.map(async (body) => {
      const asset = bodyArtwork(body);
      const data = await readFile(`public${asset.source}`);
      const metadata = await sharp(data).metadata();
      expect(metadata.hasAlpha).toBe(true);
      expect(metadata.width).toBe(asset.width);
      if (body.kind === "moon") {
        const alpha = await sharp(data)
          .extractChannel("alpha")
          .raw()
          .toBuffer();
        for (let y = 300; y < 720; y += 7)
          for (let x = 300; x < 720; x += 7)
            expect(alpha[y * asset.width + x]).toBe(255);
      }
      expect(bodyArtwork(body, 390).width).toBeLessThan(asset.width);
      return createHash("sha256").update(data).digest("hex");
    }),
  );
  expect(new Set(fingerprints).size).toBe(5);
  for (const body of CELESTIAL_BODIES)
    expect(sampleBody(body, 0, true)).toEqual(sampleBody(body, 99000, true));
});
