import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { createWorldArtwork } from "../../src/lib/portfolio-universe/world-artwork";
import { WORLD_PLANES } from "../../src/lib/portfolio-universe/scene-manifest";
import {
  billboardIntersectsView,
  worldPlateOpacity,
} from "../../src/lib/portfolio-universe/artwork-motion";
import {
  createCameraFlight,
  resolveCameraPose,
  sampleCameraFlight,
} from "../../src/lib/portfolio-universe/camera";

describe("cloud continuity", () => {
  test("reveals project transit veils progressively as their physical depth approaches", () => {
    const plane = WORLD_PLANES.find((item) => item.projectCloud?.transitOnly)!;
    const weights = { home: 0.5, projects: 0.5, about: 0, travel: 0 };
    expect(worldPlateOpacity(plane, weights, 64)).toBe(0);
    expect(worldPlateOpacity(plane, weights, 52)).toBeCloseTo(
      plane.opacity / 2,
    );
    expect(worldPlateOpacity(plane, weights, 40)).toBe(plane.opacity);
    expect(worldPlateOpacity(plane, weights, 24)).toBe(plane.opacity);
    expect(worldPlateOpacity(plane, weights, 5)).toBe(0);
    expect(worldPlateOpacity(plane, weights, 63.99)).toBeLessThan(0.000001);
    expect(
      plane.opacity - worldPlateOpacity(plane, weights, 40.01),
    ).toBeLessThan(0.000001);
  });
  test("culls offscreen rotated corners without discarding intersecting artwork", () => {
    const view = { width: 10, height: 10 };
    const plate = { x: 7, y: 7, width: 10, height: 1, rotation: -Math.PI / 4 };
    expect(billboardIntersectsView(plate, view)).toBe(false);
    expect(
      billboardIntersectsView({ ...plate, rotation: Math.PI / 4 }, view),
    ).toBe(true);
    expect(
      billboardIntersectsView(
        { x: 6, y: 0, width: 2, height: 2, rotation: 0 },
        view,
      ),
    ).toBe(true);
    expect(
      billboardIntersectsView(
        { x: 6.01, y: 0, width: 2, height: 2, rotation: 0 },
        view,
      ),
    ).toBe(false);
  });
  test("keeps decoded clouds when replacement resolution assets fail", async () => {
    const texture = new THREE.Texture();
    let fail = false;
    const artwork = createWorldArtwork(
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      { load: async () => (fail ? null : texture), destroy() {} },
      () => {},
    );
    await artwork.select(1440);
    fail = true;
    await artwork.select(390);
    expect(artwork.isReady()).toBe(true);
    expect(artwork.failedCount()).toBe(29);
    expect(artwork.loadedCount()).toBe(29);
    artwork.destroy();
    texture.dispose();
  });

  test("scene emphasis does not reorder unchanged physical cloud depths", async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1440 / 900, 0.08, 1200);
    const pose = resolveCameraPose("home", 1440, 900);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    camera.updateMatrixWorld();
    const texture = new THREE.Texture();
    const artwork = createWorldArtwork(
      scene,
      camera,
      {
        load: async () => texture,
        destroy() {},
      },
      () => {},
    );
    await artwork.select(1440);
    artwork.update(0, true, { home: 1, about: 0, projects: 0, travel: 0 });
    const nebula = scene.getObjectByName("world-plate-nebula")!;
    const order = nebula.renderOrder;
    artwork.update(0, true, { home: 0.5, about: 0, projects: 0, travel: 0.5 });
    expect(nebula.renderOrder).toBe(order);
    artwork.destroy();
    texture.dispose();
  });

  test("keeps the last completed artwork drawable while a replacement loads", async () => {
    const texture = new THREE.Texture();
    const mobileSources = new Set(
      WORLD_PLANES.map((plane) => plane.mobileSource),
    );
    const pending: Array<() => void> = [];
    const artwork = createWorldArtwork(
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      {
        load: (source) =>
          mobileSources.has(source)
            ? new Promise((resolve) => pending.push(() => resolve(texture)))
            : Promise.resolve(texture),
        destroy() {},
      },
      () => {},
    );
    // A few shared SVGs use the same source at both resolutions.
    const initial = artwork.select(1440);
    pending.splice(0).forEach((resolve) => resolve());
    await initial;
    const replacement = artwork.select(390);
    expect(artwork.isReady()).toBe(true);
    pending.splice(0).forEach((resolve) => resolve());
    await replacement;
    artwork.destroy();
    texture.dispose();
  });

  test.each([
    [1440, 900],
    [390, 844],
    [320, 700],
  ])(
    "does not evict an opaque in-view cloud during Home to Travel at %ix%i",
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
        {
          load: async () => texture,
          destroy() {},
        },
        () => {},
      );
      await artwork.select(width);
      const curve = createCameraFlight(
        resolveCameraPose("home", width, height),
        "home",
        "travel",
        undefined,
        resolveCameraPose("travel", width, height),
      );
      const position = new THREE.Vector3();
      const rotations = new Map(
        WORLD_PLANES.map((plane) => [
          `world-plate-${plane.id}`,
          plane.rotation,
        ]),
      );
      const previous = new Set<string>();
      const evicted: { id: string; progress: number; opacity: number }[] = [];
      for (let step = 0; step <= 400; step++) {
        const progress = step / 400;
        const pose = sampleCameraFlight(curve, progress);
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
        for (const object of scene.children) {
          const mesh = object as THREE.Mesh<
            THREE.PlaneGeometry,
            THREE.MeshBasicMaterial
          >;
          mesh.updateMatrixWorld();
          const depth = -position
            .copy(mesh.position)
            .applyMatrix4(camera.matrixWorldInverse).z;
          if (
            previous.has(mesh.name) &&
            !mesh.visible &&
            mesh.material.opacity > 0.05 &&
            depth > 0.35 &&
            billboardIntersectsView(
              {
                x: position.x,
                y: position.y,
                width: mesh.scale.x,
                height: mesh.scale.y,
                rotation: rotations.get(mesh.name)!,
              },
              {
                width: (depth * 2) / camera.projectionMatrix.elements[0],
                height: (depth * 2) / camera.projectionMatrix.elements[5],
              },
            )
          ) {
            evicted.push({
              id: mesh.name,
              progress,
              opacity: mesh.material.opacity,
            });
          }
          if (mesh.visible) previous.add(mesh.name);
          else previous.delete(mesh.name);
        }
      }
      expect(evicted).toEqual([]);
      artwork.destroy();
      texture.dispose();
    },
  );
});
