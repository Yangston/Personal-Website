import { describe, expect, test } from "vitest";
import {
  CAMERA_ANCHORS,
  EARTH_WORLD_POSITION,
  EARTH_WORLD_RADIUS,
  RETARGET_CAMERA_FLIGHT_TIMING,
  createCameraFlight,
  flightDurationMs,
  projectWorldPoint,
  resolveCameraFlightTiming,
  resolveCameraPose,
  retargetCameraFlight,
  responsiveCameraPose,
  sampleCameraFlight,
  selectUniverseQuality,
  universeFlightMotionDerivative,
  universeFlightMotionProgress,
} from "../../src/lib/portfolio-universe/camera";

const scenes = ["home", "about", "projects", "travel"] as const;
const journeys = scenes.flatMap((from) =>
  scenes.filter((to) => to !== from).map((to) => ({ from, to })),
);

const expectVectorClose = (
  actual: Readonly<{ x: number; y: number; z: number }>,
  expected: Readonly<{ x: number; y: number; z: number }>,
) => {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.z).toBeCloseTo(expected.z, 10);
};

describe("portfolio universe camera flights", () => {
  test.each(journeys)(
    "$from to $to preserves both camera anchors and starts and ends at rest",
    ({ from, to }) => {
      const flight = createCameraFlight(CAMERA_ANCHORS[from], from, to);
      const timing = resolveCameraFlightTiming(from, to);

      for (const [progress, scene] of [
        [0, from],
        [1, to],
      ] as const) {
        const sample = sampleCameraFlight(
          flight,
          universeFlightMotionProgress(progress, timing),
        );
        const velocityScale = universeFlightMotionDerivative(progress, timing);

        expectVectorClose(sample.position, CAMERA_ANCHORS[scene].position);
        expectVectorClose(sample.target, CAMERA_ANCHORS[scene].target);
        expect(sample.fov).toBe(CAMERA_ANCHORS[scene].fov);
        expect(velocityScale).toBeCloseTo(0, 10);
        expectVectorClose(
          {
            x: sample.tangent.x * velocityScale,
            y: sample.tangent.y * velocityScale,
            z: sample.tangent.z * velocityScale,
          },
          { x: 0, y: 0, z: 0 },
        );
      }
    },
  );

  test("return normalized camera orientations throughout a curved flight", () => {
    const flight = createCameraFlight(CAMERA_ANCHORS.home, "home", "about");

    const midpoint = sampleCameraFlight(flight, 0.5);
    const linearMidpoint = {
      x: (CAMERA_ANCHORS.home.position.x + CAMERA_ANCHORS.about.position.x) / 2,
      y: (CAMERA_ANCHORS.home.position.y + CAMERA_ANCHORS.about.position.y) / 2,
      z: (CAMERA_ANCHORS.home.position.z + CAMERA_ANCHORS.about.position.z) / 2,
    };

    expect(midpoint.position).not.toEqual(linearMidpoint);

    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const { orientation } = sampleCameraFlight(flight, progress);
      expect(
        Math.hypot(orientation.x, orientation.y, orientation.z, orientation.w),
      ).toBeCloseTo(1, 10);
    }
  });

  test("retarget from the sampled pose and preserve its incoming tangent", () => {
    const initial = createCameraFlight(CAMERA_ANCHORS.home, "home", "travel");
    const interrupted = sampleCameraFlight(initial, 0.43);
    const retargeted = retargetCameraFlight(interrupted, "projects");
    const restart = sampleCameraFlight(retargeted, 0);

    expectVectorClose(restart.position, interrupted.position);
    expectVectorClose(restart.target, interrupted.target);
    expect(restart.fov).toBeCloseTo(interrupted.fov, 10);
    expectVectorClose(restart.tangent, interrupted.tangent);
    expect(restart.orientation.x).toBeCloseTo(interrupted.orientation.x, 10);
    expect(restart.orientation.y).toBeCloseTo(interrupted.orientation.y, 10);
    expect(restart.orientation.z).toBeCloseTo(interrupted.orientation.z, 10);
    expect(restart.orientation.w).toBeCloseTo(interrupted.orientation.w, 10);
    expect(restart.toScene).toBe("projects");
  });

  test("uses a monotonic, symmetric clock that accelerates and settles", () => {
    let previous = 0;
    for (let step = 0; step <= 20; step += 1) {
      const progress = step / 20;
      const eased = universeFlightMotionProgress(progress);

      expect(eased).toBeGreaterThanOrEqual(previous);
      expect(eased).toBeLessThanOrEqual(1);
      expect(universeFlightMotionDerivative(progress)).toBeGreaterThanOrEqual(
        0,
      );
      expect(eased + universeFlightMotionProgress(1 - progress)).toBeCloseTo(
        1,
        10,
      );
      previous = eased;
    }
    expect(universeFlightMotionProgress(0)).toBe(0);
    expect(universeFlightMotionProgress(1)).toBe(1);
    expect(universeFlightMotionProgress(0.25)).toBeLessThan(0.25);
    expect(universeFlightMotionProgress(0.75)).toBeGreaterThan(0.75);
    expect(universeFlightMotionDerivative(0)).toBe(0);
    expect(universeFlightMotionDerivative(1)).toBe(0);
  });

  test("eases gently into and out of travel without an acceleration kick", () => {
    const epsilon = 0.00001;
    expect(universeFlightMotionProgress(0.1)).toBeLessThan(0.012);
    expect(universeFlightMotionProgress(0.9)).toBeGreaterThan(0.988);
    expect(universeFlightMotionDerivative(epsilon) / epsilon).toBeLessThan(
      0.001,
    );
    expect(universeFlightMotionDerivative(1 - epsilon) / epsilon).toBeLessThan(
      0.001,
    );
    expect(universeFlightMotionDerivative(0.5)).toBeGreaterThan(
      universeFlightMotionDerivative(0.25),
    );
  });

  test.each(journeys)(
    "$from to $to can retarget without a position or world-velocity jump",
    ({ from, to }) => {
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
      ]) {
        const fromPose = resolveCameraPose(
          from,
          viewport.width,
          viewport.height,
        );
        const toPose = resolveCameraPose(to, viewport.width, viewport.height);
        const timing = resolveCameraFlightTiming(from, to);
        const initial = createCameraFlight(
          fromPose,
          from,
          to,
          undefined,
          toPose,
        );
        const firstDuration = flightDurationMs(
          fromPose.position,
          toPose.position,
          viewport.width,
        );

        for (const rawProgress of [0.1, 0.43, 0.9]) {
          const interrupted = sampleCameraFlight(
            initial,
            universeFlightMotionProgress(rawProgress, timing),
          );
          const firstVelocityScale =
            universeFlightMotionDerivative(rawProgress, timing) / firstDuration;

          for (const destination of scenes.filter((scene) => scene !== to)) {
            const destinationPose = resolveCameraPose(
              destination,
              viewport.width,
              viewport.height,
            );
            const nextDuration = flightDurationMs(
              interrupted.position,
              destinationPose.position,
              viewport.width,
            );
            const nextTiming = resolveCameraFlightTiming(to, destination, true);
            expect(nextTiming).toBe(RETARGET_CAMERA_FLIGHT_TIMING);
            expect(nextTiming.startSlope).toBeGreaterThan(0);
            const tangentScale =
              (firstVelocityScale * nextDuration) / nextTiming.startSlope;
            const retargeted = retargetCameraFlight(
              interrupted,
              destination,
              {
                x: interrupted.tangent.x * tangentScale,
                y: interrupted.tangent.y * tangentScale,
                z: interrupted.tangent.z * tangentScale,
              },
              destinationPose,
            );
            const restart = sampleCameraFlight(retargeted, 0);
            const nextVelocityScale =
              universeFlightMotionDerivative(0, nextTiming) / nextDuration;

            expectVectorClose(restart.position, interrupted.position);
            expectVectorClose(restart.target, interrupted.target);
            expect(restart.fov).toBeCloseTo(interrupted.fov, 10);
            expect(restart.orientation).toEqual(interrupted.orientation);
            expectVectorClose(
              {
                x: restart.tangent.x * nextVelocityScale,
                y: restart.tangent.y * nextVelocityScale,
                z: restart.tangent.z * nextVelocityScale,
              },
              {
                x: interrupted.tangent.x * firstVelocityScale,
                y: interrupted.tangent.y * firstVelocityScale,
                z: interrupted.tangent.z * firstVelocityScale,
              },
            );
            expectVectorClose(
              sampleCameraFlight(retargeted, 1).position,
              destinationPose.position,
            );
            expect(universeFlightMotionDerivative(1, nextTiming)).toBe(0);
          }
        }
      }
    },
  );

  test.each([
    { width: 1440, height: 900, maximum: 1_900 },
    { width: 701, height: 900, maximum: 1_900 },
    { width: 700, height: 844, maximum: 1_800 },
    { width: 390, height: 844, maximum: 1_800 },
  ])(
    "keeps every journey within 1.4s–$maximum ms at $width px",
    ({ width, height, maximum }) => {
      for (const { from, to } of journeys) {
        const start = resolveCameraPose(from, width, height).position;
        const end = resolveCameraPose(to, width, height).position;
        const duration = flightDurationMs(start, end, width);

        expect(duration).toBeGreaterThanOrEqual(1_400);
        expect(duration).toBeLessThanOrEqual(maximum);
        expect(flightDurationMs(start, end, width, true)).toBe(0);
      }

      const durations = [0, 10, 20, 40].map((distance) =>
        flightDurationMs([0, 0, 0], [0, 0, distance], width),
      );
      expect(durations).toEqual([...durations].sort((a, b) => a - b));
      expect(durations[0]).toBeGreaterThanOrEqual(1_400);
      expect(durations[1]).toBeGreaterThan(durations[0]);
      expect(durations[2]).toBe(maximum);
      expect(durations[3]).toBe(maximum);
    },
  );
});

describe("portfolio universe responsive camera", () => {
  test("destination cameras move away from Home and look into their scenes", () => {
    for (const scene of ["about", "projects", "travel"] as const) {
      const pose = CAMERA_ANCHORS[scene];
      expect(
        Math.hypot(
          pose.position.x - CAMERA_ANCHORS.home.position.x,
          pose.position.y - CAMERA_ANCHORS.home.position.y,
          pose.position.z - CAMERA_ANCHORS.home.position.z,
        ),
      ).toBeGreaterThan(1);
      expect(pose.target.z).toBeLessThan(pose.position.z);
    }
    expect(CAMERA_ANCHORS.projects.position.y).toBeGreaterThan(
      CAMERA_ANCHORS.home.position.y,
    );
  });

  test("pulls back the narrow Home camera while retaining its natural field of view", () => {
    const mobile = responsiveCameraPose(CAMERA_ANCHORS.home, "home", 390, 844);
    expect(mobile.position.z).toBeGreaterThan(CAMERA_ANCHORS.home.position.z);
    expect(mobile.fov).toBe(52);
    expect(responsiveCameraPose(CAMERA_ANCHORS.home, "home", 701)).toBe(
      CAMERA_ANCHORS.home,
    );
  });

  test.each([
    { width: 1_440, height: 900, centerX: 0.68, centerY: 0.54 },
    { width: 390, height: 844, centerX: 0.5, centerY: 0.66 },
    { width: 320, height: 700, centerX: 0.5, centerY: 0.66 },
  ])(
    "fits the complete Travel sphere at $width x $height",
    ({ width, height, centerX, centerY }) => {
      const pose = resolveCameraPose("travel", width, height);
      const projection = projectWorldPoint(pose, EARTH_WORLD_POSITION, {
        width,
        height,
      })!;
      const diameter = EARTH_WORLD_RADIUS * 2 * projection.scale;

      expect(projection.x).toBeCloseTo(width * centerX, 8);
      expect(projection.y).toBeCloseTo(height * centerY, 8);
      expect(projection.x - diameter / 2).toBeGreaterThanOrEqual(8);
      expect(projection.x + diameter / 2).toBeLessThanOrEqual(width - 8);
      expect(projection.y - diameter / 2).toBeGreaterThanOrEqual(8);
      expect(projection.y + diameter / 2).toBeLessThanOrEqual(height - 8);
    },
  );
});

describe("portfolio universe projection", () => {
  test("projects the look target to the viewport center", () => {
    const viewport = { width: 1440, height: 900 } as const;
    const projection = projectWorldPoint(
      CAMERA_ANCHORS.home,
      CAMERA_ANCHORS.home.target,
      viewport,
    );

    expect(projection).not.toBeNull();
    expect(projection!.x).toBeCloseTo(viewport.width / 2, 10);
    expect(projection!.y).toBeCloseTo(viewport.height / 2, 10);
    expect(projection!.bounds).toEqual({
      left: viewport.width / 2,
      top: viewport.height / 2,
      width: 0,
      height: 0,
    });
  });

  test("gives near objects greater screen parallax than far objects", () => {
    const viewport = { width: 1200, height: 800 } as const;
    const basePose = {
      position: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: -10 },
      fov: 50,
    } as const;
    const shiftedPose = {
      ...basePose,
      position: { x: 1, y: 0, z: 0 },
      target: { x: 1, y: 0, z: -10 },
    } as const;
    const near = { x: 0, y: 0, z: -8 } as const;
    const far = { x: 0, y: 0, z: -32 } as const;

    const nearBefore = projectWorldPoint(basePose, near, viewport)!;
    const nearAfter = projectWorldPoint(shiftedPose, near, viewport)!;
    const farBefore = projectWorldPoint(basePose, far, viewport)!;
    const farAfter = projectWorldPoint(shiftedPose, far, viewport)!;

    expect(Math.abs(nearAfter.x - nearBefore.x)).toBeGreaterThan(
      Math.abs(farAfter.x - farBefore.x),
    );
    expect(nearBefore.scale).toBeGreaterThan(farBefore.scale);
    expect(
      projectWorldPoint(basePose, { x: 0, y: 0, z: 1 }, viewport),
    ).toBeNull();
  });
});

describe("portfolio universe quality selection", () => {
  test("uses the high tier with a capped device pixel ratio", () => {
    expect(
      selectUniverseQuality({
        hardwareConcurrency: 12,
        deviceMemory: 16,
        devicePixelRatio: 2.5,
      }),
    ).toEqual({
      tier: "high",
      pixelRatio: 2,
      particleCount: 288,
      dustCount: 96,
      projectHaloCount: 36,
      nebulaLayerCount: 7,
      trailCount: 48,
    });
  });

  test("uses the low tier for constrained or reduced-data devices", () => {
    expect(
      selectUniverseQuality({
        hardwareConcurrency: 4,
        deviceMemory: 8,
        devicePixelRatio: 3,
      }),
    ).toEqual({
      tier: "low",
      pixelRatio: 1,
      particleCount: 176,
      dustCount: 48,
      projectHaloCount: 24,
      nebulaLayerCount: 4,
      trailCount: 18,
    });
    expect(
      selectUniverseQuality({
        hardwareConcurrency: 12,
        deviceMemory: 16,
        devicePixelRatio: 1.25,
        reducedData: true,
      }).tier,
    ).toBe("low");
  });
});
