import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";
import {
  createCompositionFrame,
  SCENE_MANIFEST,
  resolveWorldPlane,
} from "../../src/lib/portfolio-universe/scene-manifest";
import {
  projectWorldPoint,
  resolveCameraPose,
} from "../../src/lib/portfolio-universe/camera";
import { universeSceneIds } from "../../src/lib/portfolio-universe/state";

const viewports = [
  { width: 320, height: 568 },
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 700, height: 900 },
  { width: 701, height: 900 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1659, height: 948 },
  { width: 2560, height: 1440 },
];

const scenarios = universeSceneIds.flatMap((scene) =>
  viewports.map((viewport) => ({ scene, ...viewport })),
);

describe("shared ivory composition", () => {
  test("stages the original world with approach layers and DOM interest clouds", () => {
    expect(SCENE_MANIFEST.planes).toHaveLength(40);
    expect(new Set(SCENE_MANIFEST.planes.map(({ id }) => id)).size).toBe(40);
    const mobile = SCENE_MANIFEST.planes.filter((plane) => plane.mobile);
    expect(mobile).toHaveLength(29);
    for (const planes of [SCENE_MANIFEST.planes, mobile]) {
      expect(
        new Set(planes.map(({ layer }) => layer)).size,
      ).toBeGreaterThanOrEqual(8);
      expect(
        new Set(planes.map(({ position }) => position.z)).size,
      ).toBeGreaterThanOrEqual(8);
    }
    expect(mobile.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "nebula",
        "project-sky",
        "planet",
        "foreground-left",
        "foreground-bottom",
      ]),
    );
  });

  test("matches the three Home landmarks in the supplied desktop reference", () => {
    const frame = createCompositionFrame("home", 1659, 948, SCENE_MANIFEST);
    const earth = frame.project(
      SCENE_MANIFEST.anchors.earth,
      SCENE_MANIFEST.earthRadius * 2,
    )!;
    expect(earth.x / 1659).toBeCloseTo(0.84, 6);
    expect(earth.y / 948).toBeCloseTo(0.96, 6);
    expect(earth.bounds.width).toBeCloseTo(948, 6);
    expect(earth.bounds.height).toBeCloseTo(948, 6);

    for (const [landmark, x, y] of [
      [SCENE_MANIFEST.anchors.about, 0.73, 0.22],
      [SCENE_MANIFEST.anchors.projects, 0.48, 0.4],
    ] as const) {
      const point = frame.project(landmark)!;
      expect(Math.abs(point.x / 1659 - x)).toBeLessThan(0.025);
      expect(Math.abs(point.y / 948 - y)).toBeLessThan(0.025);
    }
  });

  test("shifts the project field and its label together without moving the camera", () => {
    const frame = createCompositionFrame("home", 1440, 900, SCENE_MANIFEST);
    const previousField = frame.project({ x: 2.8, y: 6.8, z: -50 })!;
    const previousLabel = frame.project({ x: 9.3, y: 8.2, z: -50 })!;
    const field = frame.project(SCENE_MANIFEST.anchors.projects)!;
    const label = frame.project(SCENE_MANIFEST.homeLabels.projects)!;
    const shift = previousField.x - field.x;
    expect(shift / 1440).toBeGreaterThan(0.045);
    expect(shift / 1440).toBeLessThan(0.055);
    expect(previousLabel.x - label.x).toBeCloseTo(shift, 8);
    expect(field.y).toBe(previousField.y);
  });

  test.each([
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 700 },
  ])(
    "retains both corner cloud banks at $width × $height",
    ({ width, height }) => {
      const frame = createCompositionFrame(
        "home",
        width,
        height,
        SCENE_MANIFEST,
      );
      const cornerPlanes = ["foreground-left", "far-cloud-right"].map((id) =>
        resolveWorldPlane(
          SCENE_MANIFEST.planes.find((plane) => plane.id === id)!,
          width,
          height,
        ),
      );
      const [lower, upper] = cornerPlanes.map((plane) => {
        expect(plane.mobile).toBe(true);
        return frame.project(plane.position, plane.width, plane.height)!.bounds;
      });
      expect(lower.left).toBeLessThan(width * 0.25);
      expect(lower.left + lower.width).toBeGreaterThan(width * 0.25);
      expect(lower.top).toBeLessThan(height * 0.9);
      expect(lower.top + lower.height).toBeGreaterThan(height);
      expect(upper.left).toBeLessThan(width);
      expect(upper.left + upper.width).toBeGreaterThan(width * 0.8);
      expect(upper.top).toBeLessThan(height * 0.15);
      expect(upper.top + upper.height).toBeGreaterThan(0);
    },
  );

  test.each(scenarios)(
    "the distant sky covers $scene at $width x $height",
    ({ scene, width, height }) => {
      const panorama = resolveWorldPlane(
        SCENE_MANIFEST.planes[0],
        width,
        height,
      );
      const frame = createCompositionFrame(
        scene,
        width,
        height,
        SCENE_MANIFEST,
      );
      const bounds = frame.project(
        panorama.position,
        panorama.width,
        panorama.height,
      )!.bounds;
      expect(bounds.left).toBeLessThanOrEqual(0);
      expect(bounds.top).toBeLessThanOrEqual(0);
      expect(bounds.left + bounds.width).toBeGreaterThanOrEqual(width);
      expect(bounds.top + bounds.height).toBeGreaterThanOrEqual(height);
      expect(panorama.priority).toBe("structural");
    },
  );

  test.each([
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ])(
    "composes a separate mobile Home with reachable landmarks at $width × $height",
    ({ width, height }) => {
      const frame = createCompositionFrame(
        "home",
        width,
        height,
        SCENE_MANIFEST,
      );
      const earth = frame.project(
        SCENE_MANIFEST.anchors.earth,
        SCENE_MANIFEST.earthRadius * 2,
      )!;
      expect(earth.x / width).toBeCloseTo(0.88, 6);
      expect(earth.y / height).toBeCloseTo(0.94, 6);
      expect(earth.bounds.width).toBeGreaterThan(width);
      expect(earth.bounds.width).toBeLessThanOrEqual(width * 1.16);
      expect(earth.bounds.top).toBeGreaterThan(height * 0.6);
      const nebula = frame.project(SCENE_MANIFEST.anchors.about)!;
      expect(nebula.y).toBeLessThan(earth.bounds.top);
      for (const anchor of Object.values(SCENE_MANIFEST.mobileHomeLabels)) {
        const label = frame.project(anchor)!;
        expect(label.x).toBeGreaterThan(24);
        expect(label.x).toBeLessThan(width - 24);
        expect(label.y).toBeGreaterThan(height * 0.25);
        expect(label.y).toBeLessThan(height - 48);
      }
    },
  );

  test.each(scenarios)(
    "$scene has matching first-paint and live-camera projections at $width × $height",
    ({ scene, width, height }) => {
      const frame = createCompositionFrame(
        scene,
        width,
        height,
        SCENE_MANIFEST,
      );
      const pose = resolveCameraPose(scene, width, height);
      expect(frame.pose).toEqual(pose);

      for (const plane of SCENE_MANIFEST.planes) {
        const initial = frame.project(
          plane.position,
          plane.width,
          plane.height,
        );
        const live = projectWorldPoint(pose, plane.position, { width, height });
        if (!initial || !live) {
          expect(initial).toBe(live);
          continue;
        }
        for (const value of [
          initial.x,
          initial.y,
          initial.depth,
          initial.scale,
          ...Object.values(initial.bounds),
        ])
          expect(Number.isFinite(value)).toBe(true);
        expect(initial.depth).toBeGreaterThan(0);
        expect(initial.scale).toBeGreaterThan(0);
        expect(initial.x).toBeCloseTo(live.x, 8);
        expect(initial.y).toBeCloseTo(live.y, 8);
        expect(initial.scale).toBeCloseTo(live.scale, 8);
        expect(initial.bounds.width).toBeCloseTo(plane.width * live.scale, 8);
        expect(initial.bounds.height).toBeCloseTo(plane.height * live.scale, 8);
        expect(initial.bounds.left + initial.bounds.width / 2).toBeCloseTo(
          live.x,
          8,
        );
        expect(initial.bounds.top + initial.bounds.height / 2).toBeCloseTo(
          live.y,
          8,
        );
      }
    },
  );

  test.each(viewports)(
    "Travel keeps its complete Earth inside $width × $height",
    ({ width, height }) => {
      const frame = createCompositionFrame(
        "travel",
        width,
        height,
        SCENE_MANIFEST,
      );
      const earth = frame.project(
        SCENE_MANIFEST.anchors.earth,
        SCENE_MANIFEST.earthRadius * 2,
      );
      expect(earth).not.toBeNull();
      expect(earth!.bounds.left).toBeGreaterThanOrEqual(24 - 0.000001);
      expect(earth!.bounds.top).toBeGreaterThanOrEqual(0);
      expect(earth!.bounds.left + earth!.bounds.width).toBeLessThanOrEqual(
        width - 24 + 0.000001,
      );
      expect(earth!.bounds.top + earth!.bounds.height).toBeLessThanOrEqual(
        height,
      );
    },
  );

  test("the serialized frame function works without module imports or browser globals", () => {
    const standalone = runInNewContext(
      `(${createCompositionFrame.toString()})`,
      Object.create(null),
    ) as typeof createCompositionFrame;
    const manifest = JSON.parse(
      JSON.stringify(SCENE_MANIFEST),
    ) as typeof SCENE_MANIFEST;

    for (const { scene, width, height } of scenarios) {
      const expected = createCompositionFrame(
        scene,
        width,
        height,
        SCENE_MANIFEST,
      );
      const actual = standalone(
        scene,
        width,
        height,
        manifest,
        undefined,
        runInNewContext(`(${resolveWorldPlane.toString()})`),
      );
      expect(actual.pose).toEqual(expected.pose);
      for (const plane of manifest.planes)
        expect(
          actual.project(plane.position, plane.width, plane.height),
        ).toEqual(expected.project(plane.position, plane.width, plane.height));
    }
  });

  test("framing leaves the authored manifest unchanged across scenes and breakpoints", () => {
    const original = JSON.stringify(SCENE_MANIFEST);
    for (const { scene, width, height } of scenarios)
      createCompositionFrame(scene, width, height, SCENE_MANIFEST);
    expect(JSON.stringify(SCENE_MANIFEST)).toBe(original);
  });

  test("point anchors have zero-size bounds and points behind the camera are excluded", () => {
    const frame = createCompositionFrame("home", 1440, 900, SCENE_MANIFEST);
    const anchor = frame.project(SCENE_MANIFEST.anchors.projects);
    expect(anchor?.bounds.width).toBe(0);
    expect(anchor?.bounds.height).toBe(0);
    const { position, target } = frame.pose;
    expect(
      frame.project({
        x: 2 * position.x - target.x,
        y: 2 * position.y - target.y,
        z: 2 * position.z - target.z,
      }),
    ).toBeNull();
  });
});
