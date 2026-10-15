import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { runInNewContext } from "node:vm";
import { createWorldArtwork } from "../../src/lib/portfolio-universe/world-artwork";
import { createCelestialBodies } from "../../src/lib/portfolio-universe/celestial-bodies";
import {
  CELESTIAL_BODIES,
  bodyDetailOpacity,
  bodySize,
  sampleBody,
} from "../../src/lib/portfolio-universe/body-manifest";
import {
  SCENE_MANIFEST,
  resolveWorldPlane,
  createCompositionFrame,
} from "../../src/lib/portfolio-universe/scene-manifest";
import {
  createCameraFlight,
  resolveCameraPose,
  sampleCameraFlight,
} from "../../src/lib/portfolio-universe/camera";

describe("cloud-layered Home composition", () => {
  test.each([
    [1440, 900],
    [390, 844],
    [320, 700],
  ])(
    "retains the background planet and carries opaque foreground banks offscreen at %i x %i",
    async (width, height) => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        52,
        width / height,
        0.08,
        1200,
      );
      const texture = new THREE.Texture();
      const artwork = createWorldArtwork(
        scene,
        camera,
        { load: async () => texture, destroy() {} },
        () => {},
      );
      await artwork.select(width);
      const flight = createCameraFlight(
        resolveCameraPose("home", width, height),
        "home",
        "travel",
        undefined,
        resolveCameraPose("travel", width, height),
      );
      for (let step = 0; step <= 100; step++) {
        const progress = step / 100;
        const pose = sampleCameraFlight(flight, progress);
        camera.position.set(pose.position.x, pose.position.y, pose.position.z);
        camera.fov = pose.fov;
        camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        artwork.update(0, true, {
          home: 1 - progress,
          travel: progress,
          about: 0,
          projects: 0,
        });
        if (width > 700)
          expect(
            scene.getObjectByName("world-plate-planet")!.visible,
            `planet at ${progress}`,
          ).toBe(true);
        for (const id of ["foreground-left", "foreground-bottom"]) {
          const mesh = scene.getObjectByName(`world-plate-${id}`) as THREE.Mesh<
            THREE.PlaneGeometry,
            THREE.MeshBasicMaterial
          >;
          expect(mesh.material.opacity).toBeCloseTo(
            SCENE_MANIFEST.planes.find((p) => p.id === id)!.opacity,
            8,
          );
        }
      }
      const frame = createCompositionFrame(
        "travel",
        width,
        height,
        SCENE_MANIFEST,
      );
      const [left, bottom] = ["foreground-left", "foreground-bottom"].map(
        (id) => {
          const plane = resolveWorldPlane(
            SCENE_MANIFEST.planes.find((p) => p.id === id)!,
            width,
            height,
            1,
          );
          return frame.project(plane.position, plane.width, plane.height)!
            .bounds;
        },
      );
      expect(left.left + left.width).toBeLessThan(0);
      expect(bottom.top).toBeGreaterThan(height);
      artwork.destroy();
      texture.dispose();
    },
  );

  test("decorations remain small and translucent, including across adaptive quality changes", async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const texture = new THREE.Texture();
    const bodies = createCelestialBodies(
      scene,
      camera,
      { load: async () => texture, destroy() {} },
      null,
      () => {},
    );
    bodies.update(0, 1440, true, 1);
    await Promise.resolve();
    for (const scale of [1, 0.86, 0.84, 0.7, 0.5]) {
      bodies.update(0, 1440, true, scale);
      for (const body of CELESTIAL_BODIES) {
        const mesh = scene.getObjectByName(`body-${body.id}`) as THREE.Mesh<
          THREE.PlaneGeometry,
          THREE.MeshBasicMaterial
        >;
        expect(mesh.material.depthWrite).toBe(false);
        expect(mesh.material.opacity).toBeLessThanOrEqual(0.7);
        const frame = createCompositionFrame("home", 1440, 900, SCENE_MANIFEST);
        expect(
          frame.project(sampleBody(body, 0, true).position, bodySize(body))!
            .bounds.width,
        ).toBeLessThan(100);
      }
    }
    expect(
      Math.abs(
        bodyDetailOpacity(0.86, "moon") - bodyDetailOpacity(0.84, "moon"),
      ),
    ).toBeLessThan(0.01);
    bodies.destroy();
    texture.dispose();
  });

  test("first-paint resolver includes the same Travel displacement without mutating Home", () => {
    const inline = runInNewContext(
      `(${resolveWorldPlane.toString()})`,
    ) as typeof resolveWorldPlane;
    const before = JSON.stringify(SCENE_MANIFEST.planes);
    for (const plane of SCENE_MANIFEST.planes.filter((p) => p.travelExit)) {
      expect(inline(plane, 390, 844, 1)).toEqual(
        resolveWorldPlane(plane, 390, 844, 1),
      );
      expect(resolveWorldPlane(plane, 1440, 900, 0).position).toEqual(
        plane.position,
      );
    }
    expect(JSON.stringify(SCENE_MANIFEST.planes)).toBe(before);
  });
});
