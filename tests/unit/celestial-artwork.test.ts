import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { WORLD_PLANES } from "../../src/lib/portfolio-universe/scene-manifest";
import {
  createWorldArtwork,
  sampleWorldPlate,
  selectWorldPlates,
  translucentRenderOrder,
} from "../../src/lib/portfolio-universe/world-artwork";
import { earthMapUv } from "../../src/lib/portfolio-universe/earth-material";
import { worldPlateOpacity } from "../../src/lib/portfolio-universe/artwork-motion";
import {
  createOrbitalDustData,
  orbitalDustOpacity,
} from "../../src/lib/portfolio-universe/orbital-dust";
import { longitudeLatitudeToVector3 } from "../../src/lib/photography-atlas/three-earth-adapter";

describe("celestial artwork composition", () => {
  test("dissipates decorative clouds continuously while blending into Travel", () => {
    const plane = { ...WORLD_PLANES[0], sceneOpacity: { travel: 0.1 } };
    expect(
      worldPlateOpacity(plane, { home: 1, about: 0, projects: 0, travel: 0 }),
    ).toBe(plane.opacity);
    expect(
      worldPlateOpacity(plane, { home: 0, about: 0, projects: 0, travel: 1 }),
    ).toBeCloseTo(plane.opacity * 0.1);
    expect(
      worldPlateOpacity(plane, {
        home: 0.3,
        about: 0.2,
        projects: 0.1,
        travel: 0.4,
      }),
    ).toBeCloseTo(plane.opacity * 0.64);
  });
  test("keeps first-paint positions at time zero and bounds ambient movement", () => {
    for (const plane of WORLD_PLANES) {
      expect(sampleWorldPlate(plane, 0)).toEqual({
        position: plane.position,
        rotation: plane.rotation,
      });
      const sample = sampleWorldPlate(plane, 95_000);
      expect(sampleWorldPlate(plane, 95_000)).toEqual(sample);
      expect(
        Math.abs(sample.position.x - plane.position.x),
      ).toBeLessThanOrEqual(plane.drift.x * 2 + 0.000001);
      expect(
        Math.abs(sample.position.y - plane.position.y),
      ).toBeLessThanOrEqual(plane.drift.y * 2 + 0.000001);
      expect(sample.position.z).toBe(plane.position.z);
    }
  });

  test("retains the complete authored cloud set for each responsive composition", () => {
    const mobile = selectWorldPlates(WORLD_PLANES, 390);
    const desktop = selectWorldPlates(WORLD_PLANES, 1440);
    expect(mobile).toHaveLength(29);
    expect(desktop).toHaveLength(40);
    expect(
      mobile.every(({ id }) => desktop.some((plane) => plane.id === id)),
    ).toBe(true);
  });

  test("a resize during image loading cannot install the stale desktop plate set", async () => {
    const desktopResolvers: Array<() => void> = [];
    const texture = new THREE.Texture();
    const mobileSources = new Set(
      WORLD_PLANES.filter(({ mobile }) => mobile).map(
        ({ mobileSource }) => mobileSource,
      ),
    );
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const artwork = createWorldArtwork(
      scene,
      camera,
      {
        load: (source: string) =>
          mobileSources.has(source)
            ? Promise.resolve(texture)
            : new Promise((resolve) =>
                desktopResolvers.push(() => resolve(texture)),
              ),
        destroy: () => undefined,
      },
      () => undefined,
    );
    try {
      const desktop = artwork.select(1440);
      expect(artwork.isReady()).toBe(false);
      await artwork.select(390);
      expect(artwork.isReady()).toBe(true);
      expect(artwork.loadedCount()).toBe(29);
      desktopResolvers.forEach((resolve) => resolve());
      await desktop;
      expect(artwork.loadedCount()).toBe(29);
    } finally {
      artwork.destroy();
      texture.dispose();
    }
  });

  test("foreground translucent objects paint after distant objects regardless of art-layer index", () => {
    expect(translucentRenderOrder(55, 100)).toBeLessThan(
      translucentRenderOrder(4, 0),
    );
    expect(translucentRenderOrder(10, 1)).toBeLessThan(
      translucentRenderOrder(10, 2),
    );
  });
});

describe("physical Earth geographic alignment", () => {
  test.each([
    [-75, 45],
    [120, 25],
    [30, -35],
    [0, 0],
  ] as const)(
    "keeps %s°, %s° aligned between atlas picks and equirectangular texture pixels",
    (longitude, latitude) => {
      const geometry = new THREE.SphereGeometry(1, 72, 36);
      try {
        const expectedPoint = new THREE.Vector3(
          ...longitudeLatitudeToVector3([longitude, latitude]),
        );
        const position = geometry.getAttribute("position");
        const uv = geometry.getAttribute("uv");
        const vertex = new THREE.Vector3();
        let closest = 0;
        let distance = Infinity;
        for (let index = 0; index < position.count; index += 1) {
          vertex.fromBufferAttribute(position, index);
          const candidate = vertex.distanceToSquared(expectedPoint);
          if (candidate < distance) {
            closest = index;
            distance = candidate;
          }
        }
        expect(distance).toBeLessThan(0.0000001);
        const [u, v] = earthMapUv(uv.getX(closest), uv.getY(closest));
        expect(u).toBeCloseTo((longitude + 180) / 360, 6);
        expect(v).toBeCloseTo((latitude + 90) / 180, 6);
      } finally {
        geometry.dispose();
      }
    },
  );
});

describe("constellation orbital dust", () => {
  test("retains the complete deterministic orbit in the smaller mobile prefix", () => {
    const desktop = createOrbitalDustData(320);
    const mobile = createOrbitalDustData(120);
    expect(createOrbitalDustData(320)).toEqual(desktop);
    expect(mobile.positions).toEqual(desktop.positions.slice(0, 360));
    expect(mobile.sizes).toEqual(desktop.sizes.slice(0, 120));
    const x = [...mobile.positions].filter((_, index) => index % 3 === 0);
    const y = [...mobile.positions].filter((_, index) => index % 3 === 1);
    expect(Math.min(...x)).toBeLessThan(-17);
    expect(Math.max(...x)).toBeGreaterThan(17);
    expect(Math.min(...y)).toBeLessThan(-6);
    expect(Math.max(...y)).toBeGreaterThan(6);
    expect(Math.max(...desktop.sizes)).toBe(4);
    expect(
      [...desktop.sizes].filter((size) => size === 4).length,
    ).toBeLessThanOrEqual(12);
  });

  test("softly recedes at other destinations without a visibility switch", () => {
    expect(
      orbitalDustOpacity({ home: 1, about: 0, projects: 0, travel: 0 }),
    ).toBe(0.6);
    expect(
      orbitalDustOpacity({ home: 0, about: 0, projects: 0, travel: 1 }),
    ).toBe(0.02);
    expect(
      orbitalDustOpacity({
        home: 0.25,
        about: 0.25,
        projects: 0.25,
        travel: 0.25,
      }),
    ).toBeCloseTo(0.3125);
  });
});
