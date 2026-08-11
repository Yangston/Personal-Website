import { describe, expect, it } from "vitest";
import {
  countryAtlasId,
  isCoordinateVisible,
  placeGlobeAroundHeading,
  placeCountryCallouts,
  shortestLongitudeTarget,
} from "../../src/lib/photography-atlas/data";
import {
  easeOutCubic,
  interpolatePoint,
} from "../../src/lib/photography-atlas/transition";
import {
  HOME_EARTH_ROTATION,
  TRAVEL_EARTH_ROTATION,
} from "../../src/lib/cosmic-transitions/earth";
import { countrySilhouettePath } from "../../src/lib/photography-atlas/server";

describe("photography atlas identity and projection", () => {
  it("resolves published countries through stable numeric World Atlas IDs", () => {
    expect(countryAtlasId("united-states")).toBe(840);
    expect(countryAtlasId("china")).toBe(156);
    expect(countryAtlasId("hong-kong")).toBe(344);
    expect(countryAtlasId("not-published")).toBeUndefined();
  });

  it("detects whether a coordinate is on the visible orthographic hemisphere", () => {
    expect(isCoordinateVisible([0, 0], [0, 0])).toBe(true);
    expect(isCoordinateVisible([179, 0], [0, 0])).toBe(false);
    expect(isCoordinateVisible([120, 23], [-120, -23])).toBe(true);
  });

  it("chooses the shortest rotation and interpolates the projection handoff", () => {
    expect(shortestLongitudeTarget(170, -170)).toBe(190);
    expect(shortestLongitudeTarget(-170, 170)).toBe(-190);
    expect(interpolatePoint([10, 20], [30, 60], 0.5)).toEqual([20, 40]);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("uses named Toronto and visited-Asia route rotations", () => {
    expect(HOME_EARTH_ROTATION).toEqual([85, 5, 0]);
    expect(TRAVEL_EARTH_ROTATION).toEqual([-108, -22, 0]);
    expect(
      shortestLongitudeTarget(HOME_EARTH_ROTATION[0], TRAVEL_EARTH_ROTATION[0]),
    ).toBe(252);
  });

  it("places country photo callouts around markers without card overlap", () => {
    const placed = placeCountryCallouts(
      [
        { id: "toronto", markerX: 500, markerY: 420, width: 184, height: 132 },
        { id: "elora", markerX: 506, markerY: 422, width: 184, height: 132 },
      ],
      1200,
      760,
    );
    expect(placed).toHaveLength(2);
    expect(placed[0].left).not.toBe(placed[1].left);
    expect(placed[0].top).not.toBe(placed[1].top);
  });

  it("places the globe beside or below the atlas heading without overlap", () => {
    const desktop = placeGlobeAroundHeading(1700, 950, 427, {
      left: 64,
      right: 690,
      top: 112,
      bottom: 208,
    });
    expect(desktop.centerX - desktop.scale * 1.12).toBeGreaterThanOrEqual(718);

    const compact = placeGlobeAroundHeading(320, 720, 134, {
      left: 16,
      right: 304,
      top: 96,
      bottom: 154,
    });
    expect(compact.centerY - compact.scale * 1.12).toBeGreaterThanOrEqual(182);
  });

  it("keeps detailed country silhouettes within the static HTML budget", () => {
    const canada = countrySilhouettePath("canada").path;
    const china = countrySilhouettePath("china").path;
    expect(canada.length).toBeGreaterThan(20_000);
    expect(canada.length).toBeLessThan(30_000);
    expect(china.length).toBeGreaterThan(7_000);
  });

  it("uses the composite Albers projection for the United States map", () => {
    const unitedStates = countrySilhouettePath("united-states", 1200, 760);
    const sanFrancisco = unitedStates.project(-122.4194, 37.7749);
    expect(unitedStates.projection).toBe("albers-usa");
    expect(sanFrancisco?.[0]).toBeGreaterThan(120);
    expect(sanFrancisco?.[0]).toBeLessThanOrEqual(600);
    expect(sanFrancisco?.[1]).toBeGreaterThan(180);
    expect(sanFrancisco?.[1]).toBeLessThan(700);
  });
});
