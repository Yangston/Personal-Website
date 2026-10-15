import { describe, expect, it } from "vitest";
import {
  advanceCountryEmphasis,
  atlasAnchorOpacity,
  coordinateFacing,
  createAtlasSpin,
} from "../../src/lib/photography-atlas/motion";
import { surfacePointFacing } from "../../src/lib/photography-atlas/three-earth-adapter";

describe("travel motion", () => {
  it.each([30, 60, 120])("turns three degrees per second at %i fps", (fps) => {
    const spin = createAtlasSpin();
    let angle = 0;
    for (let i = 1; i <= fps; i++)
      angle += spin.advance((i * 1_000) / fps, 1_000 / fps, false);
    expect(angle).toBeCloseTo(3, 8);
  });
  it("resumes immediately after a controlled suspension, with no idle delay", () => {
    const spin = createAtlasSpin();
    expect(spin.advance(100, 16, true)).toBe(0);
    expect(spin.advance(200, 100, false)).toBeCloseTo(0.3);
    expect(spin.advance(400, 200, false)).toBeCloseTo(0.6);
    expect(spin.advance(500, -100, false)).toBe(0);
  });
  it("keeps disabled motion still indefinitely", () => {
    const spin = createAtlasSpin();
    for (let time = 0; time < 20_000; time += 100)
      expect(spin.advance(time, 100, true)).toBe(0);
  });
  it("crossfades interrupted emphasis continuously in 180/140ms", () => {
    const entering = advanceCountryEmphasis(0, true, 90, false);
    expect(entering).toBe(0.5);
    const leaving = advanceCountryEmphasis(entering, false, 35, false);
    expect(leaving).toBe(0.25);
    expect(advanceCountryEmphasis(leaving, true, 135, false)).toBe(1);
    expect(advanceCountryEmphasis(1, false, 140, false)).toBe(0);
    expect(advanceCountryEmphasis(0.4, false, 0, true)).toBe(0);
    expect(advanceCountryEmphasis(0.4, true, 0, true)).toBe(1);
  });
});

describe("travel horizon", () => {
  it("fades only on the front hemisphere and disappears at the horizon", () => {
    expect(atlasAnchorOpacity(1, [50, 50], 100, 100)).toBe(1);
    expect(atlasAnchorOpacity(0.08, [50, 50], 100, 100)).toBeCloseTo(0.5);
    expect(atlasAnchorOpacity(0, [50, 50], 100, 100)).toBe(0);
    expect(atlasAnchorOpacity(-0.01, [50, 50], 100, 100)).toBe(0);
    expect(atlasAnchorOpacity(1, [101, 50], 100, 100)).toBe(0);
    expect(atlasAnchorOpacity(1, [NaN, 50], 100, 100)).toBe(0);
    expect(atlasAnchorOpacity(1, null, 100, 100)).toBe(0);
  });
  it("uses perspective horizon rather than the orthographic hemisphere", () => {
    const point = [Math.sqrt(0.99), 0, 0.1] as const;
    expect(surfacePointFacing(point, [0, 0, 5])).toBeLessThan(0);
    expect(surfacePointFacing([0, 0, 1], [0, 0, 5])).toBe(1);
    expect(surfacePointFacing([0, 0, -1], [0, 0, 5])).toBe(-1);
    expect(surfacePointFacing([10, -2, 4], [10, -2, 10], [10, -2, 3])).toBe(1);
  });
  it("matches geographic rotation in the canvas fallback", () => {
    expect(coordinateFacing([108, 22], [-108, -22])).toBeCloseTo(1);
    expect(coordinateFacing([-72, -22], [-108, -22])).toBeCloseTo(-1);
  });
});
