import { describe, expect, it } from "vitest";
import {
  atlasCanvasPixelRatio,
  atlasLabelLeaderPoints,
  compareAtlasCountryHitPriority,
  countryAtlasId,
  isCoordinateVisible,
  placeAtlasLabels,
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

  it("tests nested country hits with Hong Kong first, then smallest area", () => {
    const candidates = [
      { slug: "china", area: 0.23 },
      { slug: "taiwan", area: 0.00084 },
      { slug: "hong-kong", area: 0.5 },
      { slug: "canada", area: 0.24 },
    ];

    expect(candidates.sort(compareAtlasCountryHitPriority)).toEqual([
      { slug: "hong-kong", area: 0.5 },
      { slug: "taiwan", area: 0.00084 },
      { slug: "china", area: 0.23 },
      { slug: "canada", area: 0.24 },
    ]);
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
    expect(desktop.centerX).toBeCloseTo(1700 * 0.69);
    expect(1700 - (desktop.centerX + desktop.scale)).toBeGreaterThanOrEqual(
      120,
    );

    const compact = placeGlobeAroundHeading(320, 720, 134, {
      left: 16,
      right: 304,
      top: 96,
      bottom: 154,
    });
    expect(compact.centerY - compact.scale * 1.12).toBeGreaterThanOrEqual(182);
  });

  it("keeps projected country labels near their anchors without overlap", () => {
    const labels = placeAtlasLabels(
      [
        {
          id: "china",
          anchorX: 820,
          anchorY: 410,
          width: 72,
          height: 44,
        },
        {
          id: "hong-kong",
          anchorX: 830,
          anchorY: 416,
          width: 96,
          height: 44,
        },
        {
          id: "canada",
          anchorX: 570,
          anchorY: 430,
          width: 82,
          height: 44,
        },
      ],
      1200,
      760,
      { centerX: 760, centerY: 410, scale: 260 },
    );
    const china = labels.find((label) => label.id === "china");
    const hongKong = labels.find((label) => label.id === "hong-kong");
    const canada = labels.find((label) => label.id === "canada");

    expect(china?.side).toBe(1);
    expect(hongKong?.side).toBe(-1);
    expect(canada?.side).toBe(-1);
    expect(Math.abs((china?.x ?? 0) - 820)).toBeLessThan(100);
    expect(Math.abs((hongKong?.x ?? 0) - 830)).toBeLessThan(100);
    expect(Math.abs((canada?.x ?? 0) - 570)).toBeLessThan(100);

    for (const [index, label] of labels.entries()) {
      expect(label.x - label.width / 2).toBeGreaterThanOrEqual(8);
      expect(label.x + label.width / 2).toBeLessThanOrEqual(1_192);
      expect(label.y - label.height / 2).toBeGreaterThanOrEqual(8);
      expect(label.y + label.height / 2).toBeLessThanOrEqual(752);
      for (const other of labels.slice(index + 1)) {
        const separated =
          label.x + label.width / 2 + 8 <= other.x - other.width / 2 ||
          other.x + other.width / 2 + 8 <= label.x - label.width / 2 ||
          label.y + label.height / 2 + 8 <= other.y - other.height / 2 ||
          other.y + other.height / 2 + 8 <= label.y - label.height / 2;
        expect(separated).toBe(true);
      }
    }
  });

  it("clamps labels, avoids obstacles, and keeps the prior candidate slot", () => {
    const seed = {
      id: "taiwan",
      anchorX: 600,
      anchorY: 300,
      width: 80,
      height: 44,
    };
    const obstacle = { left: 620, right: 708, top: 225, bottom: 285 };
    const [first] = placeAtlasLabels(
      [seed],
      1_200,
      760,
      { centerX: 600, centerY: 380, scale: 260 },
      [obstacle],
    );
    const [next] = placeAtlasLabels(
      [{ ...seed, anchorX: 606, side: first.side, slot: first.slot }],
      1_200,
      760,
      { centerX: 600, centerY: 380, scale: 260 },
      [obstacle],
    );
    const [edge] = placeAtlasLabels(
      [{ ...seed, anchorX: 1_195, anchorY: 6, width: 100 }],
      1_200,
      760,
      { centerX: 600, centerY: 380, scale: 260 },
    );

    expect(first.side).toBe(-1);
    expect(next.slot).toBe(first.slot);
    expect(edge.x + edge.width / 2).toBe(1_192);
    expect(edge.y - edge.height / 2).toBe(8);
  });

  it("draws a three-point leader with an 18px horizontal terminal", () => {
    const points = atlasLabelLeaderPoints([830, 416], {
      x: 760,
      y: 340,
      width: 96,
      height: 44,
      side: -1,
    });

    expect(points).toHaveLength(3);
    expect(points[0]).toEqual([830, 416]);
    expect(points[1][1]).toBe(points[2][1]);
    expect(Math.abs(points[2][0] - points[1][0])).toBe(18);
    expect(
      Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]),
    ).toBeGreaterThan(18);
  });

  it("caps the atlas backing store at two device pixels per CSS pixel", () => {
    expect(atlasCanvasPixelRatio(1.25)).toBe(1.25);
    expect(atlasCanvasPixelRatio(3)).toBe(2);
    expect(atlasCanvasPixelRatio(Number.NaN)).toBe(1);
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
