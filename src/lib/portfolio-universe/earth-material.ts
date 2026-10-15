import * as THREE from "three";
import type { UniverseTextureLoader } from "./world-artwork";

// SphereGeometry longitude zero is -X; standard geographic maps begin at -180°.
// Keep this correction in texture space so picking and atlas markers never move.
export const EARTH_LONGITUDE_UV_OFFSET = 0.5;

export function earthMapUv(sphereU: number, sphereV: number) {
  return [
    (((sphereU + EARTH_LONGITUDE_UV_OFFSET) % 1) + 1) % 1,
    sphereV,
  ] as const;
}

export function createCelestialEarthMaterial(
  geographicMask: THREE.Texture,
  textures: UniverseTextureLoader,
  resolution: 1024 | 2048,
  palette: Readonly<{
    ocean: string;
    land: string;
    visited: string;
    active: string;
  }>,
) {
  const blackTexture = new THREE.DataTexture(
    new Uint8Array([0, 0, 0, 255]),
    1,
    1,
  );
  blackTexture.needsUpdate = true;
  const uniforms = {
    uMap: { value: geographicMask },
    uDay: { value: blackTexture as THREE.Texture },
    uNight: { value: blackTexture as THREE.Texture },
    uPhysicalReady: { value: 0 },
    uOpacity: { value: 1 },
    uTravelMix: { value: 0 },
    uInteraction: { value: 0 },
    uOceanReference: { value: new THREE.Color(palette.ocean) },
    uVisitedReference: { value: new THREE.Color(palette.visited) },
    uActiveReference: { value: new THREE.Color(palette.active) },
    uLandTint: { value: new THREE.Color("#dfd3be") },
    uOceanTint: { value: new THREE.Color("#8297a0") },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: false,
    depthWrite: true,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;
      void main() {
        vUv = uv;
        vViewNormal = normalize(normalMatrix * normal);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDirection = -viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform sampler2D uDay;
      uniform sampler2D uNight;
      uniform float uPhysicalReady;
      uniform float uOpacity;
      uniform float uTravelMix;
      uniform float uInteraction;
      uniform vec3 uOceanReference;
      uniform vec3 uVisitedReference;
      uniform vec3 uActiveReference;
      uniform vec3 uLandTint;
      uniform vec3 uOceanTint;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;

      void main() {
        vec2 mapUv = vec2(fract(vUv.x + ${EARTH_LONGITUDE_UV_OFFSET.toFixed(1)}), vUv.y);
        vec3 geography = texture2D(uMap, mapUv).rgb;
        float ocean = 1.0 - smoothstep(0.025, 0.16, distance(geography, uOceanReference));
        float visited = 1.0 - smoothstep(0.025, 0.16, distance(geography, uVisitedReference));
        float selectedMask = 1.0 - smoothstep(0.025, 0.16, distance(geography, uActiveReference));
        vec3 day = texture2D(uDay, mapUv).rgb;
        vec3 night = texture2D(uNight, mapUv).rgb;
        float luminance = dot(day, vec3(0.2126, 0.7152, 0.0722));
        float blueDominance = (day.b - max(day.r, day.g)) / max(0.0001, day.r + day.g + day.b);
        float physicalOcean = smoothstep(0.035, 0.17, blueDominance);
        float waterMask = mix(ocean, physicalOcean, uPhysicalReady);
        float landRelief = pow(max(0.001, luminance), 0.27);
        float oceanRelief = pow(max(0.001, day.b), 0.33);
        vec3 landSurface = mix(day, uLandTint * (0.28 + landRelief * 1.15), 0.86);
        vec3 oceanSurface = mix(day, uOceanTint * (0.63 + oceanRelief * 0.76), 0.93);
        vec3 surface = mix(landSurface, oceanSurface, waterMask);
        vec3 normal = normalize(vViewNormal);
        float sunlight = max(0.0, dot(normal, normalize(vec3(-0.38, 0.53, 0.82))));
        surface *= 0.62 + sunlight * 0.46;
        // Reject the blue terrain in the night photograph; only warm city
        // lights may emit, including their genuinely bright coastal clusters.
        float warmLights = max(0.0, max(night.r, night.g) - night.b * 0.86);
        float cityLights = smoothstep(0.012, 0.10, warmLights) * sqrt(warmLights);
        surface += vec3(1.0, 0.72, 0.34) * cityLights * (1.35 + (1.0 - sunlight) * 0.45);
        vec3 color = mix(geography, surface, uPhysicalReady);
        color = mix(color, mix(color, uVisitedReference, 0.30), visited * uTravelMix);
        color = mix(color, mix(color, uActiveReference, 0.62), selectedMask * uTravelMix);
        float facing = max(0.0, dot(normal, normalize(vViewDirection)));
        float rim = pow(1.0 - facing, 5.0);
        color += vec3(0.16, 0.12, 0.065) * pow(1.0 - facing, 2.5) * sunlight * uInteraction;
        color = mix(color, vec3(1.0, 0.955, 0.86), smoothstep(0.52, 1.0, rim) * 0.91);
        color += vec3(0.34, 0.29, 0.25) * rim * (0.14 + uInteraction * 0.65);
        gl_FragColor = vec4(color, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const cloudUniforms = {
    uMap: { value: blackTexture as THREE.Texture },
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uTravelMix: { value: 0 },
  };
  const cloudMaterial = new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.FrontSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vViewNormal;
      void main() {
        vUv = uv;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uTravelMix;
      varying vec2 vUv;
      varying vec3 vViewNormal;
      void main() {
        vec3 texel = texture2D(uMap, vec2(fract(vUv.x + ${EARTH_LONGITUDE_UV_OFFSET.toFixed(1)} + uTime * 0.00022), vUv.y)).rgb;
        float density = dot(texel, vec3(0.2126, 0.7152, 0.0722));
        float alpha = smoothstep(0.055, 0.77, density) * uOpacity * mix(0.50, 0.31, uTravelMix);
        if (alpha < 0.003) discard;
        float light = 0.88 + max(0.0, dot(normalize(vViewNormal), normalize(vec3(-0.38, 0.53, 0.82)))) * 0.12;
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.91) * light, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  let cloudReady = false;
  let disposed = false;
  const ready = Promise.all([
    textures.load(`/media/site/celestial/earth-day-${resolution}.webp`),
    textures.load(`/media/site/celestial/earth-night-${resolution}.webp`),
    textures.load(
      `/media/site/celestial/earth-clouds-${resolution}.webp`,
      THREE.NoColorSpace,
    ),
  ]).then(([day, night, clouds]) => {
    if (disposed) return false;
    if (day) {
      day.wrapS = THREE.RepeatWrapping;
      uniforms.uDay.value = day;
      uniforms.uPhysicalReady.value = 1;
    }
    if (night) {
      night.wrapS = THREE.RepeatWrapping;
      uniforms.uNight.value = night;
    }
    if (clouds) {
      clouds.wrapS = THREE.RepeatWrapping;
      cloudUniforms.uMap.value = clouds;
      cloudReady = true;
    }
    return Boolean(day);
  });
  return {
    material,
    cloudMaterial,
    ready,
    uniforms,
    update(timeMs: number, opacity: number, travelMix: number) {
      uniforms.uOpacity.value = opacity;
      uniforms.uTravelMix.value = travelMix;
      cloudUniforms.uTime.value = timeMs / 1_000;
      cloudUniforms.uOpacity.value = cloudReady ? opacity : 0;
      cloudUniforms.uTravelMix.value = travelMix;
      const transparent = opacity < 0.999;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.depthWrite = !transparent;
        material.needsUpdate = true;
      }
    },
    destroy() {
      disposed = true;
      blackTexture.dispose();
      material.dispose();
      cloudMaterial.dispose();
    },
  };
}

/** The existing atmosphere draw becomes a perspective-correct, thin shell. */
export function createEarthAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.48 } },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: false,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vDirection;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vDirection = -viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vDirection;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vDirection)));
        float glow = pow(1.0 - facing, 3.8);
        gl_FragColor = vec4(vec3(1.0, 0.965, 0.88), glow * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
