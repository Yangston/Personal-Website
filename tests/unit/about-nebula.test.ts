import { describe, expect, test } from "vitest";
import { runInNewContext } from "node:vm";
import {
  SCENE_MANIFEST,
  resolveWorldPlane,
  createCompositionFrame,
} from "../../src/lib/portfolio-universe/scene-manifest";
import { ABOUT_PILLARS } from "../../src/lib/portfolio-universe/about-pillars";
import { NEBULA_INTEREST_REGIONS } from "../../src/lib/portfolio-universe/nebula-regions";
import { worldPlateOpacity } from "../../src/lib/portfolio-universe/artwork-motion";

describe("distant About destination", () => {
  test.each([
    [1440, 900],
    [1659, 948],
    [390, 844],
    [320, 700],
    [701, 900],
  ])(
    "preserves Home framing and centers arrival at %i x %i",
    (width, height) => {
      const authored = SCENE_MANIFEST.planes.find(
        (plane) => plane.id === "nebula",
      )!;
      const baseline =
        width <= 700 ? { ...authored, ...authored.mobilePlacement } : authored;
      const resolved = resolveWorldPlane(authored, width, height);
      const home = createCompositionFrame(
        "home",
        width,
        height,
        SCENE_MANIFEST,
      );
      const before = home.project(
        baseline.position,
        baseline.width,
        baseline.height,
      )!;
      const after = home.project(
        resolved.position,
        resolved.width,
        resolved.height,
      )!;
      expect(after.x).toBeCloseTo(before.x, 8);
      expect(after.y).toBeCloseTo(before.y, 8);
      expect(after.bounds.width).toBeCloseTo(before.bounds.width, 8);
      expect(after.depth).toBeCloseTo(before.depth * 3, 8);
      const about = createCompositionFrame(
        "about",
        width,
        height,
        SCENE_MANIFEST,
      );
      const arrival = about.project(
        resolved.position,
        resolved.width,
        resolved.height,
      )!;
      const focal = SCENE_MANIFEST.nebulaFocalPoint;
      expect(arrival.bounds.left + focal.x * arrival.bounds.width).toBeCloseTo(
        width / 2,
        8,
      );
      expect(arrival.bounds.top + focal.y * arrival.bounds.height).toBeCloseTo(
        height / 2,
        8,
      );
      for (const region of NEBULA_INTEREST_REGIONS) {
        const x =
          arrival.bounds.left + region.labelPoint.x * arrival.bounds.width;
        const y =
          arrival.bounds.top + region.labelPoint.y * arrival.bounds.height;
        expect(x - 38).toBeGreaterThan(0);
        expect(x + 38).toBeLessThan(width);
        expect(y - 22).toBeGreaterThan(height * 0.24);
        expect(y + 22).toBeLessThan(height - 65);
      }
      const background = resolveWorldPlane(
        SCENE_MANIFEST.planes[0],
        width,
        height,
      );
      expect(background.position.z).toBeLessThan(resolved.position.z);
    },
  );

  test("inline resolver matches runtime and never mutates authored planes", () => {
    const standalone = runInNewContext(
      `(${resolveWorldPlane.toString()})`,
    ) as typeof resolveWorldPlane;
    const before = JSON.stringify(SCENE_MANIFEST);
    for (const plane of SCENE_MANIFEST.planes)
      expect(standalone(plane, 390, 844)).toEqual(
        resolveWorldPlane(plane, 390, 844),
      );
    expect(JSON.stringify(SCENE_MANIFEST)).toBe(before);
  });

  test("three authored interests retain unique identities", () => {
    expect(new Set(ABOUT_PILLARS.map((pillar) => pillar.id)).size).toBe(3);
    expect(
      SCENE_MANIFEST.planes.some((plane) => plane.id.startsWith("orb-")),
    ).toBe(false);
  });

  test("approach clouds only appear during Home and About journeys", () => {
    const approach = SCENE_MANIFEST.planes.filter((plane) => plane.approach);
    expect(new Set(approach.map((plane) => plane.nebulaLocal!.z)).size).toBe(6);
    for (const plane of approach) {
      expect(
        worldPlateOpacity(plane, { home: 1, about: 0, projects: 0, travel: 0 }),
      ).toBe(0);
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
      expect(
        worldPlateOpacity(plane, {
          home: 0,
          about: 0.5,
          projects: 0.5,
          travel: 0,
        }),
      ).toBe(0);
    }
  });
});
