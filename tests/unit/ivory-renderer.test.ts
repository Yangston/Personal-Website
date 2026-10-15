import { describe, expect, test } from "vitest";
import { universeRenderPixelRatio } from "../../src/lib/portfolio-universe/renderer";

describe("ivory universe backing buffer", () => {
  test.each([
    { width: 1440, height: 900, preferred: 2, budget: 2_000_000 },
    { width: 1920, height: 1080, preferred: 2, budget: 2_000_000 },
    { width: 3840, height: 2160, preferred: 2, budget: 2_000_000 },
    { width: 390, height: 844, preferred: 3, budget: 1_000_000 },
    { width: 700, height: 1200, preferred: 3, budget: 1_000_000 },
    { width: 701, height: 1200, preferred: 3, budget: 2_000_000 },
  ])(
    "bounds a $width × $height viewport to $budget pixels",
    ({ width, height, preferred, budget }) => {
      const ratio = universeRenderPixelRatio(width, height, preferred);

      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(preferred);
      expect(
        Math.floor(width * ratio) * Math.floor(height * ratio),
      ).toBeLessThanOrEqual(budget);
      expect(width * height * ratio ** 2).toBeCloseTo(budget, 4);
    },
  );

  test.each([0.5, 1, 1.25, 2, 3])(
    "retains preferred DPR %s when the viewport fits the budget",
    (preferred) => {
      expect(universeRenderPixelRatio(320, 320, preferred)).toBe(preferred);
    },
  );

  test("permits sub-native resolution on a 4K display", () => {
    const ratio = universeRenderPixelRatio(3840, 2160, 1);

    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
    expect(3840 * 2160 * ratio ** 2).toBeCloseTo(2_000_000, 4);
  });

  test("restores preferred resolution after resizing to a smaller viewport", () => {
    const ratios = [
      universeRenderPixelRatio(3840, 2160, 1.5),
      universeRenderPixelRatio(800, 600, 1.5),
      universeRenderPixelRatio(390, 844, 1.5),
    ];

    expect(ratios[0]).toBeLessThan(1);
    expect(ratios.slice(1)).toEqual([1.5, 1.5]);
  });

  test.each([
    { width: 0, height: 0, preferred: 0 },
    { width: -390, height: -844, preferred: -2 },
    { width: Number.NaN, height: 844, preferred: 2 },
    { width: 390, height: Number.NaN, preferred: 2 },
    { width: Number.POSITIVE_INFINITY, height: 844, preferred: 2 },
    { width: 390, height: Number.NEGATIVE_INFINITY, preferred: 2 },
    { width: 390, height: 844, preferred: Number.NaN },
    { width: 390, height: 844, preferred: Number.POSITIVE_INFINITY },
    { width: 390, height: 844, preferred: Number.NEGATIVE_INFINITY },
  ])(
    "returns a usable ratio for invalid inputs $width, $height, $preferred",
    ({ width, height, preferred }) => {
      const ratio = universeRenderPixelRatio(width, height, preferred);

      expect(Number.isFinite(ratio)).toBe(true);
      expect(ratio).toBeGreaterThan(0);
    },
  );
});
