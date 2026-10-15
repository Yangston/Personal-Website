import { describe, expect, test } from "vitest";
import { createFrameCadence } from "../../src/lib/portfolio-universe/frame-cadence";

const monitorRates = [60, 90, 120, 144, 165] as const;
const targets = [30, 60] as const;

describe("universe frame cadence", () => {
  test.each(
    ([60, 144] as const).flatMap((monitorHz) =>
      targets.flatMap((targetFps) =>
        ["rounded", "jittered", "dropped"].map((sampling) => ({
          monitorHz,
          targetFps,
          sampling,
        })),
      ),
    ),
  )(
    "maintains $targetFps fps with $sampling timestamps on $monitorHz Hz",
    ({ monitorHz, targetFps, sampling }) => {
      const cadence = createFrameCadence();
      const jitter = [0, 0.2, -0.3, 0.1, -0.2, 0.3, -0.1];
      let callbacks = 0;
      let rendered = 0;

      for (let tick = 0; tick <= monitorHz * 5; tick += 1) {
        // Drop an occasional callback, never the initial one. A scheduler must
        // preserve cadence without inventing callbacks that the browser lost.
        if (sampling === "dropped" && tick > 0 && tick % 47 === 0) continue;
        const offset =
          sampling === "rounded" ? 0 : jitter[tick % jitter.length];
        const time =
          Math.round(((tick * 1_000) / monitorHz + offset) * 10) / 10;
        callbacks += 1;
        if (cadence.shouldRender(time, targetFps)) rendered += 1;
      }

      const expected = monitorHz === targetFps ? callbacks : targetFps * 5 + 1;
      expect(Math.abs(rendered - expected)).toBeLessThanOrEqual(2);
      expect(rendered).toBeLessThanOrEqual(callbacks);
    },
  );

  test.each(
    monitorRates.flatMap((monitorHz) =>
      targets.map((targetFps) => ({ monitorHz, targetFps })),
    ),
  )(
    "maintains $targetFps fps on a $monitorHz Hz monitor over five seconds",
    ({ monitorHz, targetFps }) => {
      const cadence = createFrameCadence();
      const rendered: number[] = [];
      const duration = 5_000;

      for (let tick = 0; tick <= monitorHz * 5; tick += 1) {
        const time = (tick * 1_000) / monitorHz;
        if (cadence.shouldRender(time, targetFps)) rendered.push(time);
      }

      expect(rendered[0]).toBe(0);
      expect(
        Math.abs(rendered.length - (targetFps * 5 + 1)),
      ).toBeLessThanOrEqual(2);
      expect(duration - rendered.at(-1)!).toBeLessThanOrEqual(
        1_000 / targetFps + 1_000 / monitorHz,
      );
      expect(new Set(rendered).size).toBe(rendered.length);
    },
  );

  test.each(targets)("renders the first %s fps frame once", (targetFps) => {
    const cadence = createFrameCadence();

    expect(cadence.shouldRender(123, targetFps)).toBe(true);
    expect(cadence.shouldRender(123, targetFps)).toBe(false);
    expect(cadence.shouldRender(124, targetFps)).toBe(false);
  });

  test.each([
    { before: 30, after: 60 },
    { before: 60, after: 30 },
  ] as const)(
    "renders immediately when changing from $before to $after fps",
    ({ before, after }) => {
      const cadence = createFrameCadence();
      expect(cadence.shouldRender(0, before)).toBe(true);
      expect(cadence.shouldRender(1, before)).toBe(false);
      expect(cadence.shouldRender(2, after)).toBe(true);
      expect(cadence.shouldRender(2, after)).toBe(false);
      expect(cadence.shouldRender(3, after)).toBe(false);
      expect(cadence.shouldRender(2 + 1_000 / after, after)).toBe(true);
    },
  );

  test.each(targets)(
    "reset resumes %s fps immediately with a fresh deadline",
    (targetFps) => {
      const cadence = createFrameCadence();
      expect(cadence.shouldRender(0, targetFps)).toBe(true);
      expect(cadence.shouldRender(1, targetFps)).toBe(false);
      cadence.reset();
      expect(cadence.shouldRender(2, targetFps)).toBe(true);
      expect(cadence.shouldRender(2, targetFps)).toBe(false);
      expect(cadence.shouldRender(3, targetFps)).toBe(false);
      cadence.reset();
      expect(cadence.shouldRender(60_000, targetFps)).toBe(true);
      expect(cadence.shouldRender(60_001, targetFps)).toBe(false);
    },
  );

  test.each(targets)(
    "a long stall at %s fps renders once and does not burst to catch up",
    (targetFps) => {
      const cadence = createFrameCadence();
      expect(cadence.shouldRender(0, targetFps)).toBe(true);
      expect(cadence.shouldRender(5_000, targetFps)).toBe(true);
      expect(cadence.shouldRender(5_000, targetFps)).toBe(false);
      for (const offset of [0.1, 1, 2, 5]) {
        expect(cadence.shouldRender(5_000 + offset, targetFps)).toBe(false);
      }
      expect(cadence.shouldRender(5_000 + 1_000 / targetFps, targetFps)).toBe(
        true,
      );
    },
  );

  test("restarts after the clock moves backwards", () => {
    const cadence = createFrameCadence();

    expect(cadence.shouldRender(100, 60)).toBe(true);
    expect(cadence.shouldRender(50, 60)).toBe(true);
    expect(cadence.shouldRender(50, 60)).toBe(false);
    expect(cadence.shouldRender(51, 60)).toBe(false);
    expect(cadence.shouldRender(50 + 1_000 / 60, 60)).toBe(true);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "ignores nonfinite timestamp %s without poisoning the next deadline",
    (time) => {
      const cadence = createFrameCadence();

      expect(cadence.shouldRender(time, 60)).toBe(false);
      expect(cadence.shouldRender(0, 60)).toBe(true);
      expect(cadence.shouldRender(time, 60)).toBe(false);
      expect(cadence.shouldRender(1, 60)).toBe(false);
      expect(cadence.shouldRender(1_000 / 60, 60)).toBe(true);
    },
  );
});
