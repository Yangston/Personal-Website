import { describe, expect, test } from "vitest";
import { shouldScheduleUniverseFrame } from "../../src/lib/portfolio-universe/render-scheduling";

const resting = {
  effectsPinned: true,
  reducedMotion: false,
  flight: false,
  renderRequested: false,
  activeInput: false,
};

describe("universe pinned-effect scheduling", () => {
  test("stops repeated audit frames while preserving production ambient rendering", () => {
    expect(shouldScheduleUniverseFrame(resting)).toBe(false);
    expect(
      shouldScheduleUniverseFrame({ ...resting, effectsPinned: false }),
    ).toBe(true);
    expect(
      shouldScheduleUniverseFrame({
        ...resting,
        effectsPinned: false,
        reducedMotion: true,
      }),
    ).toBe(false);
  });

  test("runs complete flights while their decorative clock is pinned", () => {
    expect(shouldScheduleUniverseFrame({ ...resting, flight: true })).toBe(
      true,
    );
    expect(shouldScheduleUniverseFrame(resting)).toBe(false);
  });

  test("renders drag, inertia and state changes until their last requested frame", () => {
    expect(shouldScheduleUniverseFrame({ ...resting, activeInput: true })).toBe(
      true,
    );
    expect(
      shouldScheduleUniverseFrame({ ...resting, renderRequested: true }),
    ).toBe(true);
    expect(shouldScheduleUniverseFrame(resting)).toBe(false);
    // Production reduced-motion input already requests individual frames;
    // an idle pointer must not introduce a new loop in that existing mode.
    expect(
      shouldScheduleUniverseFrame({
        ...resting,
        effectsPinned: false,
        reducedMotion: true,
        activeInput: true,
      }),
    ).toBe(false);
  });
});
