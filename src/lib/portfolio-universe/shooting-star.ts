import * as THREE from "three";
import { createShootingStarGate, sampleShootingStar } from "./ambient-effects";

export function createShootingStar(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  const vertices = new Float32Array(6),
    headVertex = new Float32Array(3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  const headGeometry = new THREE.BufferGeometry();
  headGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(headVertex, 3),
  );
  const material = new THREE.LineBasicMaterial({
    color: 0xf6d9a2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const headMaterial = new THREE.PointsMaterial({
    color: 0xfff7df,
    size: 4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const line = new THREE.Line(geometry, material),
    head = new THREE.Points(headGeometry, headMaterial);
  line.name = "ambient-shooting-star-trail";
  head.name = "ambient-shooting-star-head";
  line.frustumCulled = false;
  head.frustumCulled = false;
  scene.add(line, head);
  const admit = createShootingStarGate(),
    start = new THREE.Vector3(),
    end = new THREE.Vector3(),
    point = new THREE.Vector3(),
    tail = new THREE.Vector3();
  let event = -1;
  const screenPoint = (x: number, y: number) => {
    const point = new THREE.Vector3(x * 2 - 1, 1 - y * 2, 0.5)
      .unproject(camera)
      .sub(camera.position);
    const view = point.clone().transformDirection(camera.matrixWorldInverse);
    return camera.position
      .clone()
      .add(point.normalize().multiplyScalar(90 / Math.max(0.1, -view.z)));
  };
  return {
    update(
      timeMs: number,
      width: number,
      reduced: boolean,
      flight: boolean,
      pinned: boolean,
    ) {
      const sample = admit(sampleShootingStar(timeMs, reduced), flight, pinned);
      line.visible = head.visible = Boolean(sample);
      if (!sample) return false;
      if (sample.event !== event || pinned) {
        event = sample.event;
        const y = width <= 700 ? 0.065 + (sample.y - 0.075) * 0.25 : sample.y;
        start.copy(screenPoint(sample.x, y));
        end.copy(
          screenPoint(
            sample.x + sample.direction * 0.18,
            y + (width <= 700 ? 0.025 : 0.055),
          ),
        );
      }
      point.lerpVectors(start, end, sample.progress);
      tail.lerpVectors(start, end, Math.max(0, sample.progress - 0.2));
      point.toArray(vertices, 0);
      tail.toArray(vertices, 3);
      point.toArray(headVertex);
      geometry.attributes.position.needsUpdate = true;
      headGeometry.attributes.position.needsUpdate = true;
      const opacity = Math.sin(sample.progress * Math.PI) * 0.85;
      material.opacity = opacity;
      headMaterial.opacity = opacity;
      line.renderOrder = head.renderOrder = point
        .clone()
        .applyMatrix4(camera.matrixWorldInverse).z;
      return true;
    },
    destroy() {
      scene.remove(line, head);
      geometry.dispose();
      headGeometry.dispose();
      material.dispose();
      headMaterial.dispose();
    },
  };
}
