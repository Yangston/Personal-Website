import { describe, expect, test } from "vitest";
import { bodySceneOpacity } from "../../src/lib/portfolio-universe/body-manifest";
import { runInNewContext } from "node:vm";
import {
  createCompositionFrame,
  resolveWorldPlane,
  SCENE_MANIFEST,
} from "../../src/lib/portfolio-universe/scene-manifest";
import {
  createProjectConstellationWorldPoints,
  PROJECT_CONSTELLATION_VISUALS,
} from "../../src/lib/portfolio-universe/project-constellations";
import { projectWorldPoint } from "../../src/lib/portfolio-universe/camera";

describe("distant project sky", () => {
  test("nearby decorative planets clear the flight corridor smoothly", () => {
    expect(bodySceneOpacity(0, 0)).toBe(1);
    expect(bodySceneOpacity(1, 0)).toBeCloseTo(0.15);
    expect(bodySceneOpacity(0, 0.175)).toBeCloseTo(0.5);
    expect(bodySceneOpacity(0, 0.35)).toBe(0);
    expect(bodySceneOpacity(0, 1)).toBe(0);
  });
  test.each([
    [1440, 900],
    [390, 844],
    [320, 700],
    [701, 900],
  ])("preserves framing while sextupling depth at %i x %i", (width, height) => {
    const home = createCompositionFrame("home", width, height, SCENE_MANIFEST);
    const arrival = createCompositionFrame(
      "projects",
      width,
      height,
      SCENE_MANIFEST,
    );
    const originalPose =
      width <= 700
        ? {
            position: { x: 2.8, y: 17, z: 20 },
            target: { x: 2.8, y: 17, z: -50 },
            fov: 58,
          }
        : SCENE_MANIFEST.cameras.projects;
    for (const visual of Object.values(PROJECT_CONSTELLATION_VISUALS)) {
      for (const point of createProjectConstellationWorldPoints(
        visual,
        SCENE_MANIFEST.anchors.projects,
      )) {
        const distant = home.projectToWorld(point);
        const before = home.project(point)!;
        const after = home.project(distant)!;
        expect(after.x).toBeCloseTo(before.x, 8);
        expect(after.y).toBeCloseTo(before.y, 8);
        expect(after.depth).toBeCloseTo(before.depth * 6, 8);
        const originalArrival = projectWorldPoint(originalPose, point, {
          width,
          height,
        })!;
        if (width <= 700)
          expect(arrival.project(distant)!.x).toBeCloseTo(originalArrival.x, 8);
        else {
          expect(arrival.project(distant)!.x).toBeLessThan(
            originalArrival.x - width * 0.1,
          );
          expect(arrival.project(distant)!.x).toBeGreaterThan(0);
        }
        expect(arrival.project(distant)!.y).toBeCloseTo(originalArrival.y, 8);
      }
    }
    expect(home.pose.position.z - arrival.pose.position.z).toBeGreaterThan(120);
    const stars = home.project(
      home.projectToWorld(SCENE_MANIFEST.anchors.projects),
    )!;
    const nebula = resolveWorldPlane(
      SCENE_MANIFEST.planes.find((plane) => plane.id === "nebula")!,
      width,
      height,
    );
    expect(stars.depth).toBeGreaterThan(
      home.project(nebula.position)!.depth * 2,
    );
    const sky = resolveWorldPlane(
      SCENE_MANIFEST.planes.find((p) => p.projectSpace)!,
      width,
      height,
    );
    expect(home.project(sky.position)!.depth).toBeGreaterThan(stars.depth);
    const clouds = SCENE_MANIFEST.planes
      .filter((p) => p.projectCloud)
      .map((p) => resolveWorldPlane(p, width, height));
    expect(new Set(clouds.map((p) => p.position.z)).size).toBe(9);
    for (const cloud of clouds) {
      expect(home.project(cloud.position)!.depth).toBeLessThan(stars.depth / 3);
      expect(cloud.position.z).toBeGreaterThan(arrival.pose.position.z);
    }
  });

  test("serialized first paint uses the runtime transform without external helpers", () => {
    const create = runInNewContext(`(${createCompositionFrame.toString()})`, {
      resolveWorldPlane,
    }) as typeof createCompositionFrame;
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      const inline = create("projects", width, height, SCENE_MANIFEST);
      const runtime = createCompositionFrame(
        "projects",
        width,
        height,
        SCENE_MANIFEST,
      );
      expect(inline.pose).toEqual(runtime.pose);
      expect(inline.projectToWorld(SCENE_MANIFEST.anchors.projects)).toEqual(
        runtime.projectToWorld(SCENE_MANIFEST.anchors.projects),
      );
    }
  });
});
