import { describe, expect, test } from "vitest";
import { createAdaptiveQuality } from "../../src/lib/portfolio-universe/adaptive-quality";

const samples = (interval: number, count = 40) =>
  Array.from({ length: count }, () => interval);

describe("adaptive universe rendering quality", () => {
  test("starts at full quality and requires two consecutive slow flights", () => {
    const quality = createAdaptiveQuality();

    expect(quality.scale).toBe(1);
    expect(quality.observeFlight(samples(35))).toBe(1);
    expect(quality.scale).toBe(1);
    expect(quality.observeFlight(samples(35))).toBeCloseTo(0.85, 12);
    expect(quality.scale).toBeCloseTo(0.85, 12);
    expect(quality.observeFlight(samples(35))).toBeCloseTo(0.85, 12);
    expect(quality.observeFlight(samples(35))).toBeCloseTo(0.7225, 12);
  });

  test.each([
    { name: "mean exactly 24ms", values: [...samples(23, 28), 38, 38] },
    { name: "p95 exactly 34ms", values: samples(34) },
    { name: "high mean with healthy p95", values: samples(25) },
    {
      name: "high p95 with healthy mean",
      values: [...samples(20, 28), 35, 35],
    },
  ])("does not reduce quality for $name", ({ values }) => {
    const quality = createAdaptiveQuality();

    expect(quality.observeFlight(values)).toBe(1);
    expect(quality.observeFlight(values)).toBe(1);
  });

  test("reduces quality when both strict thresholds are exceeded", () => {
    const quality = createAdaptiveQuality();
    const justSlow = [...samples(23, 28), 38.01, 38.01];

    expect(quality.observeFlight(justSlow)).toBe(1);
    expect(quality.observeFlight(justSlow)).toBeCloseTo(0.85, 12);
  });

  test("uses nearest-rank p95 after sorting and does not mutate samples", () => {
    const quality = createAdaptiveQuality();
    const twoOutliers = [90, ...samples(23, 38), 90];
    const threeOutliers = [90, ...samples(23, 37), 90, 90];
    const original = [...threeOutliers];

    // The 38th value is 23 with two outliers, and 90 with three.
    expect(quality.observeFlight(twoOutliers)).toBe(1);
    expect(quality.observeFlight(twoOutliers)).toBe(1);
    expect(quality.observeFlight(threeOutliers)).toBe(1);
    expect(quality.observeFlight(threeOutliers)).toBeCloseTo(0.85, 12);
    expect(threeOutliers).toEqual(original);
  });

  test("requires at least thirty valid intervals", () => {
    const quality = createAdaptiveQuality();

    expect(quality.observeFlight(samples(35, 29))).toBe(1);
    expect(quality.observeFlight(samples(35, 29))).toBe(1);
    expect(quality.observeFlight(samples(35, 30))).toBe(1);
    expect(quality.observeFlight(samples(35, 30))).toBeCloseTo(0.85, 12);
  });

  test("accepts exactly eighty percent valid coverage and ignores invalid values", () => {
    const quality = createAdaptiveQuality();
    const intervals = [
      ...samples(35),
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0,
      -1,
      100.01,
      101,
      200,
      1_000,
      -50,
    ];

    expect(quality.observeFlight(intervals)).toBe(1);
    expect(quality.observeFlight(intervals)).toBeCloseTo(0.85, 12);
  });

  test("rejects coverage below eighty percent even with thirty valid samples", () => {
    const quality = createAdaptiveQuality();
    const insufficientCoverage = [...samples(35, 30), ...samples(0, 8)];

    expect(quality.observeFlight(insufficientCoverage)).toBe(1);
    expect(quality.observeFlight(insufficientCoverage)).toBe(1);
  });

  test("includes the valid 100ms upper boundary", () => {
    const quality = createAdaptiveQuality();

    expect(quality.observeFlight(samples(100))).toBe(1);
    expect(quality.observeFlight(samples(100))).toBeCloseTo(0.85, 12);
  });

  test.each([
    { name: "healthy flight", values: samples(16) },
    { name: "empty flight", values: [] },
    { name: "too few valid samples", values: samples(35, 29) },
    {
      name: "invalid coverage",
      values: [...samples(35, 30), ...samples(0, 8)],
    },
  ])("a $name clears the consecutive slowdown streak", ({ values }) => {
    const quality = createAdaptiveQuality();

    expect(quality.observeFlight(samples(35))).toBe(1);
    expect(quality.observeFlight(values)).toBe(1);
    expect(quality.observeFlight(samples(35))).toBe(1);
    expect(quality.observeFlight(samples(35))).toBeCloseTo(0.85, 12);
  });

  test("healthy recovery keeps the lowered scale without automatically upscaling", () => {
    const quality = createAdaptiveQuality();
    quality.observeFlight(samples(35));
    quality.observeFlight(samples(35));

    for (let flight = 0; flight < 5; flight += 1) {
      expect(quality.observeFlight(samples(16))).toBeCloseTo(0.85, 12);
      expect(quality.scale).toBeCloseTo(0.85, 12);
    }
    expect(quality.observeFlight([])).toBeCloseTo(0.85, 12);
    expect(quality.observeFlight(samples(35))).toBeCloseTo(0.85, 12);
    expect(quality.observeFlight(samples(35))).toBeCloseTo(0.7225, 12);
  });

  test("repeated slow flights stop lowering quality at the safety floor", () => {
    const quality = createAdaptiveQuality();
    const scales = Array.from({ length: 12 }, () =>
      quality.observeFlight(samples(35)),
    );

    [1, 0.85, 0.85, 0.7225, 0.7225, 0.7].forEach((expected, index) => {
      expect(scales[index]).toBeCloseTo(expected, 12);
    });
    expect(scales.slice(6)).toEqual(Array.from({ length: 6 }, () => 0.7));
    expect(quality.scale).toBe(0.7);
  });
});
