import { describe, expect, test } from "vitest";
import {
  createProjectTitleTimings,
  PROJECT_TITLE_CHARACTER_MS,
  PROJECT_TITLE_GAP_MS,
  PROJECT_CONSTELLATION_VISUALS,
  resolveProjectConstellation,
} from "../../src/lib/portfolio-universe/project-constellations";

describe("project constellation world placement", () => {
  test("assigns every authored project a distinct stable world offset", () => {
    const visuals = Object.entries(PROJECT_CONSTELLATION_VISUALS);
    const serializedOffsets = visuals.map(([, visual]) =>
      JSON.stringify(visual.worldOffset),
    );

    expect(visuals.map(([projectId]) => projectId)).toEqual([
      "sightline",
      "sleep-wake-model",
      "robotic-card-thrower",
    ]);
    expect(new Set(serializedOffsets).size).toBe(visuals.length);
    expect(
      visuals.every(([, visual]) =>
        Object.values(visual.worldOffset).every(Number.isFinite),
      ),
    ).toBe(true);
  });

  test("keeps generated world placement tied to the project id", () => {
    const first = resolveProjectConstellation("future-project", 0);
    const reordered = resolveProjectConstellation("future-project", 12);
    const other = resolveProjectConstellation("another-project", 0);

    expect(reordered.worldOffset).toEqual(first.worldOffset);
    expect(other.worldOffset).not.toEqual(first.worldOffset);
  });

  test("spreads authored projects while keeping responsive fallbacks on screen", () => {
    const visuals = Object.values(PROJECT_CONSTELLATION_VISUALS);
    const desktopX = visuals.map(({ position }) => position.x);

    expect(
      Math.max(...desktopX) - Math.min(...desktopX),
    ).toBeGreaterThanOrEqual(36);
    expect(
      visuals.every(
        ({ position, mobilePosition }) =>
          position.x >= 10 &&
          position.x <= 90 &&
          position.y >= 10 &&
          position.y <= 80 &&
          mobilePosition.x >= 15 &&
          mobilePosition.x <= 85 &&
          mobilePosition.y >= 15 &&
          mobilePosition.y <= 80,
      ),
    ).toBe(true);
  });
});

describe("project title sequence", () => {
  test("types each title at 45ms per character with 180ms gaps", () => {
    expect(PROJECT_TITLE_CHARACTER_MS).toBe(45);
    expect(PROJECT_TITLE_GAP_MS).toBe(180);
    expect(
      createProjectTitleTimings(["Sightline", "Sleep–Wake Model", "Poker Bot"]),
    ).toEqual([
      { characterCount: 9, delayMs: 0, durationMs: 405 },
      { characterCount: 16, delayMs: 585, durationMs: 720 },
      { characterCount: 9, delayMs: 1_485, durationMs: 405 },
    ]);
  });
});
