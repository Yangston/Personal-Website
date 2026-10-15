import { describe, expect, it } from "vitest";
import {
  isSurfacePointVisible,
  longitudeLatitudeToVector3,
  normalizeLongitude,
  vector3ToLongitudeLatitude,
  type AtlasLongitudeLatitude,
  type AtlasVector3,
} from "../../src/lib/photography-atlas/three-earth-adapter";

function expectVectorClose(actual: AtlasVector3, expected: AtlasVector3) {
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, 10);
  });
}

function expectCoordinateClose(
  actual: AtlasLongitudeLatitude,
  expected: AtlasLongitudeLatitude,
) {
  expect(actual[0]).toBeCloseTo(expected[0], 10);
  expect(actual[1]).toBeCloseTo(expected[1], 10);
}

describe("Three Earth geographic adapter math", () => {
  it("maps geographic cardinal points into the documented local basis", () => {
    expectVectorClose(longitudeLatitudeToVector3([0, 0]), [-1, 0, 0]);
    expectVectorClose(longitudeLatitudeToVector3([90, 0]), [0, 0, 1]);
    expectVectorClose(longitudeLatitudeToVector3([-90, 0]), [0, 0, -1]);
    expectVectorClose(longitudeLatitudeToVector3([0, 90]), [0, 1, 0]);
    expectVectorClose(longitudeLatitudeToVector3([0, -90]), [0, -1, 0]);
  });

  it("round trips equatorial cardinal points and representative latitudes", () => {
    const coordinates: AtlasLongitudeLatitude[] = [
      [-180, 0],
      [-90, 0],
      [0, 0],
      [90, 0],
      [45, 45],
      [135, -45],
    ];

    coordinates.forEach((coordinate) => {
      expectCoordinateClose(
        vector3ToLongitudeLatitude(longitudeLatitudeToVector3(coordinate)),
        coordinate,
      );
    });
  });

  it("normalizes longitudes into the canonical half-open range", () => {
    expect(normalizeLongitude(180)).toBe(-180);
    expect(normalizeLongitude(-180)).toBe(-180);
    expect(normalizeLongitude(540)).toBe(-180);
    expect(normalizeLongitude(-540)).toBe(-180);
    expect(normalizeLongitude(721)).toBe(1);
    expect(normalizeLongitude(-721)).toBe(-1);
  });

  it("uses the camera position to distinguish front and back surface points", () => {
    expect(isSurfacePointVisible([0, 0, 1], [0, 0, 5])).toBe(true);
    expect(isSurfacePointVisible([0, 0, -1], [0, 0, 5])).toBe(false);
    expect(isSurfacePointVisible([10, -2, 4], [10, -2, 10], [10, -2, 3])).toBe(
      true,
    );
    expect(isSurfacePointVisible([10, -2, 2], [10, -2, 10], [10, -2, 3])).toBe(
      false,
    );
  });

  it("rejects a zero-length inverse coordinate", () => {
    expect(() => vector3ToLongitudeLatitude([0, 0, 0])).toThrow(RangeError);
  });
});
