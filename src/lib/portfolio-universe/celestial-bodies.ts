import * as THREE from "three";
import {
  CELESTIAL_BODIES,
  sampleBody,
  bodySize,
  bodyArtwork,
  bodySceneOpacity,
  bodyDetailOpacity,
} from "./body-manifest";
import type { UniverseTextureLoader } from "./world-artwork";

/** Unique artwork billboards share the world's texture cache, clock and depth. */
export function createCelestialBodies(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  textures: UniverseTextureLoader,
  root: HTMLElement | null,
  onChange: () => void,
) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  let destroyed = false;
  const entries = CELESTIAL_BODIES.map((body) => {
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      alphaTest: 0.001,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `body-${body.id}`;
    mesh.scale.setScalar(bodySize(body));
    mesh.visible = false;
    scene.add(mesh);
    return {
      body,
      material,
      mesh,
      loaded: false,
      selected: false,
      source: "",
      fallback: root?.querySelector<HTMLElement>(
        `[data-world-body="${body.id}"]`,
      ),
    };
  });
  const view = new THREE.Vector3();
  return {
    update(
      timeMs: number,
      width: number,
      reduced: boolean,
      detailScale = 1,
      aboutWeight = 0,
      projectsWeight = 0,
    ) {
      for (const entry of entries) {
        const { body, mesh, material } = entry;
        entry.selected = width > 700 || body.mobile;
        const source = bodyArtwork(body, width).source;
        if (entry.selected && entry.source !== source) {
          entry.source = source;
          void textures.load(source).then((texture) => {
            if (destroyed || entry.source !== source || !texture) return;
            material.map = texture;
            material.needsUpdate = true;
            entry.loaded = true;
            if (entry.fallback) entry.fallback.dataset.bodyReady = "true";
            onChange();
          });
        }
        mesh.visible = entry.selected && entry.loaded;
        const sample = sampleBody(body, timeMs, reduced, width);
        mesh.position.set(
          sample.position.x,
          sample.position.y,
          sample.position.z,
        );
        mesh.quaternion.copy(camera.quaternion);
        mesh.rotateZ(sample.roll);
        material.opacity =
          body.opacity *
          bodySceneOpacity(aboutWeight, projectsWeight) *
          bodyDetailOpacity(detailScale, body.kind);
        mesh.visible = mesh.visible && material.opacity > 0.005;
        mesh.renderOrder = view
          .copy(mesh.position)
          .applyMatrix4(camera.matrixWorldInverse).z;
      }
    },
    count: () => entries.filter((entry) => entry.selected).length,
    destroy() {
      destroyed = true;
      for (const { mesh, material, fallback } of entries) {
        scene.remove(mesh);
        material.dispose();
        if (fallback) delete fallback.dataset.bodyReady;
      }
      geometry.dispose();
    },
  };
}
