import * as THREE from "three";
import type { WorldPoint } from "./scene-manifest";
import type { UniverseSceneId } from "./state";

export function createOrbitalDustData(count = 320) {
  let seed = 5_917;
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return (seed - 1) / 2_147_483_646;
  };
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    // Every prefix covers the complete arc, including the 120-point mobile
    // draw range. This avoids truncating the orbit when quality changes.
    const fraction = (index * 0.61803398875) % 1;
    const angle = -0.22 * Math.PI + fraction * Math.PI * 1.89;
    const spread = (random() - 0.5) * 0.95;
    const interior = index % 3 ? Math.sqrt(random()) : 1;
    positions[index * 3] = Math.cos(angle) * (18 + spread) * interior;
    positions[index * 3 + 1] = Math.sin(angle) * (7 + spread * 0.6) * interior;
    positions[index * 3 + 2] = Math.sin(angle) * 3.1 + (random() - 0.5) * 0.8;
    sizes[index] = index % 29 === 0 ? 4 : 1.1 + random() * 1.9;
    phases[index] = random() * Math.PI * 2;
  }
  return { positions, sizes, phases };
}

export function orbitalDustOpacity(
  weights: Readonly<Record<UniverseSceneId, number>>,
) {
  return Math.max(
    0,
    Math.min(
      1,
      weights.home * 0.6 +
        weights.projects * 0.55 +
        weights.about * 0.08 +
        weights.travel * 0.02,
    ),
  );
}

export function createOrbitalDust(origin: WorldPoint) {
  const data = createOrbitalDustData();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(data.positions, 3),
  );
  geometry.setAttribute("aSize", new THREE.BufferAttribute(data.sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(data.phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: 1 },
      uTime: { value: 0 },
      uOpacity: { value: 0.6 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      uniform float uPixelRatio;
      uniform float uTime;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float breath = 0.82 + sin(uTime * 0.38 + aPhase) * 0.18;
        vAlpha = uOpacity * breath;
        gl_PointSize = aSize * uPixelRatio * clamp(420.0 / max(72.0, -viewPosition.z), 0.72, 1.5);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float radius = length(gl_PointCoord * 2.0 - 1.0);
        float alpha = (1.0 - smoothstep(0.10, 0.95, radius)) * vAlpha;
        if (alpha < 0.01) discard;
        vec3 champagne = mix(vec3(1.0, 0.97, 0.83), vec3(0.94, 0.67, 0.31), min(1.0, radius));
        gl_FragColor = vec4(champagne, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "constellation-orbital-dust";
  points.position.set(origin.x, origin.y, origin.z);
  points.rotation.z = -0.31;
  return { points, geometry, material };
}
