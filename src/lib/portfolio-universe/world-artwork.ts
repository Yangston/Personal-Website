import * as THREE from "three";
import { WORLD_PLANES, resolveWorldPlane } from "./scene-manifest";
import {
  billboardIntersectsView,
  sampleWorldPlate,
  selectWorldPlates,
  translucentRenderOrder,
  worldPlateOpacity,
} from "./artwork-motion";
import type { UniverseSceneId } from "./state";
import { createNebulaMaterial, updateNebulaMaterial } from "./nebula-material";
export {
  sampleWorldPlate,
  selectWorldPlates,
  translucentRenderOrder,
} from "./artwork-motion";

export type UniverseTextureLoader = ReturnType<
  typeof createUniverseTextureLoader
>;

/** Cache source textures across repeated plates and dispose late network results. */
export function createUniverseTextureLoader() {
  const loader = new THREE.TextureLoader();
  const pending = new Map<string, Promise<THREE.Texture | null>>();
  const textures = new Set<THREE.Texture>();
  let disposed = false;
  return {
    load(source: string, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
      const key = `${source}:${colorSpace}`;
      const previous = pending.get(key);
      if (previous) return previous;
      const result = new Promise<THREE.Texture | null>((resolve) => {
        if (disposed) {
          resolve(null);
          return;
        }
        loader.load(
          source,
          (texture) => {
            if (disposed) {
              texture.dispose();
              resolve(null);
              return;
            }
            texture.colorSpace = colorSpace;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true;
            texture.anisotropy = 2;
            textures.add(texture);
            resolve(texture);
          },
          undefined,
          () => resolve(null),
        );
      });
      pending.set(key, result);
      return result;
    },
    destroy() {
      disposed = true;
      textures.forEach((texture) => texture.dispose());
      textures.clear();
      pending.clear();
    },
  };
}

export function createWorldArtwork(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  textures: UniverseTextureLoader,
  onChange: () => void,
) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const plates = WORLD_PLANES.map((plane) => {
    const material =
      plane.id === "nebula"
        ? createNebulaMaterial()
        : new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest: true,
            depthWrite: false,
            opacity: plane.opacity,
            toneMapped: false,
            side: THREE.FrontSide,
          });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `world-plate-${plane.id}`;
    mesh.visible = false;
    mesh.scale.set(plane.width, plane.height, 1);
    scene.add(mesh);
    return { plane, mesh, material, source: "", loaded: false };
  });
  const viewPosition = new THREE.Vector3();
  let selection = new Set<string>();
  let requestedSelection = "";
  let generation = 0;
  let destroyed = false;
  let ready = false;
  let failed = 0;
  let completion: Promise<void> = Promise.resolve();
  let viewportWidth = 1440;

  const select = (width: number) => {
    viewportWidth = width;
    // Adaptive quality may lower raster resolution, but never exchange cloud
    // layers. Their silhouettes are part of the persistent scene composition.
    const selected = selectWorldPlates(WORLD_PLANES, width);
    const sources = selected.map((plane) => ({
      plane,
      source: width <= 700 ? plane.mobileSource : plane.source,
    }));
    const signature = sources
      .map(({ plane, source }) => `${plane.id}:${source}`)
      .join("|");
    if (signature === requestedSelection) return completion;
    requestedSelection = signature;
    // A responsive replacement must not blank the last complete composition.
    // The new textures are committed together after every request has settled.
    const token = ++generation;
    completion = Promise.all(
      sources.map(async ({ plane, source }) => ({
        id: plane.id,
        source,
        texture: await textures.load(source),
      })),
    ).then((results) => {
      if (destroyed || token !== generation) return;
      failed = results.filter(({ texture }) => texture === null).length;
      const loaded = new Map(results.map((result) => [result.id, result]));
      selection = new Set(loaded.keys());
      for (const plate of plates) {
        const result = loaded.get(plate.plane.id);
        if (!result) {
          plate.loaded = false;
          continue;
        }
        // If a responsive variant fails, the already decoded texture is still
        // useful. Retain it rather than making a previously visible cloud vanish.
        if (!result.texture) continue;
        plate.loaded = true;
        plate.source = result.source;
        if (plate.material instanceof THREE.ShaderMaterial)
          plate.material.uniforms.uTexture.value = result.texture;
        else plate.material.map = result.texture;
        plate.material.needsUpdate = true;
      }
      ready = true;
      onChange();
    });
    return completion;
  };

  return {
    select,
    isReady: () => ready,
    failedCount: () => failed,
    loadedCount: () =>
      plates.filter(({ plane, loaded }) => selection.has(plane.id) && loaded)
        .length,
    visibleCount: () => plates.filter(({ mesh }) => mesh.visible).length,
    update(
      timeMs: number,
      visible: boolean,
      sceneWeights: Readonly<Record<UniverseSceneId, number>>,
      nebulaStrength = 0.18,
      reduced = false,
    ) {
      for (const { plane: authored, mesh, material, loaded } of plates) {
        const plane = resolveWorldPlane(
          authored,
          viewportWidth,
          viewportWidth / camera.aspect,
          sceneWeights.travel,
        );
        mesh.scale.set(plane.width, plane.height, 1);
        const sample = sampleWorldPlate(plane, timeMs, sceneWeights.about);
        mesh.position.set(
          sample.position.x,
          sample.position.y,
          sample.position.z,
        );
        mesh.quaternion.copy(camera.quaternion);
        mesh.rotateZ(sample.rotation);
        const depth = -viewPosition
          .copy(mesh.position)
          .applyMatrix4(camera.matrixWorldInverse).z;
        material.opacity = worldPlateOpacity(plane, sceneWeights, depth);
        if (material instanceof THREE.ShaderMaterial)
          updateNebulaMaterial(
            material,
            timeMs,
            nebulaStrength,
            reduced,
            material.opacity,
            sceneWeights.about,
          );
        mesh.visible =
          visible &&
          loaded &&
          selection.has(plane.id) &&
          depth > 0.35 &&
          depth < camera.far &&
          material.opacity > 0.005 &&
          billboardIntersectsView(
            {
              x: viewPosition.x,
              y: viewPosition.y,
              width: plane.width,
              height: plane.height,
              rotation: sample.rotation,
            },
            {
              width: (depth * 2) / camera.projectionMatrix.elements[0],
              height: (depth * 2) / camera.projectionMatrix.elements[5],
            },
          );
        mesh.renderOrder = translucentRenderOrder(depth, plane.layer);
      }
    },
    destroy() {
      destroyed = true;
      generation += 1;
      plates.forEach(({ mesh, material }) => {
        scene.remove(mesh);
        material.dispose();
      });
      geometry.dispose();
    },
  };
}
