import * as THREE from "three";
import { geoEquirectangular, geoPath } from "d3-geo";
import { mesh } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json";
import type { AtlasEarthCountryFeature } from "@/lib/photography-atlas/three-earth-adapter";
import { advanceCountryEmphasis } from "@/lib/photography-atlas/motion";
import { EARTH_LONGITUDE_UV_OFFSET } from "./earth-material";

const boundaries = mesh(
  countries110m as never,
  countries110m.objects.countries as never,
  (left, right) => left !== right,
);

/** Static GPU masks: hovering never redraws geography or uploads a texture. */
export function createEarthCountryOverlays(
  group: THREE.Group,
  geometry: THREE.SphereGeometry,
  renderer: THREE.WebGLRenderer,
  highQuality: boolean,
) {
  const width = highQuality ? 2_048 : 1_024;
  const height = width / 2;
  type Layer = ReturnType<typeof makeLayer>;
  let features: readonly AtlasEarthCountryFeature[] = [];
  let layers: { slug: string; layer: Layer; weight: number }[] = [];
  let borders: Layer | null = null;
  let selected: string | null = null;

  function makeLayer(
    paint: (
      context: CanvasRenderingContext2D,
      path: ReturnType<typeof geoPath>,
    ) => void,
    border = false,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "black";
    context.fillRect(0, 0, width, height);
    context.lineJoin = "round";
    context.lineCap = "round";
    const projection = geoEquirectangular()
      .translate([width / 2, height / 2])
      .scale(width / (2 * Math.PI));
    paint(context, geoPath(projection, context));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    // Upload during preparation, including inactive country masks.
    renderer.initTexture(texture);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      toneMapped: false,
      uniforms: {
        uMask: { value: texture },
        uOpacity: { value: 0 },
        uFillOpacity: { value: border ? 0.32 : 0.23 },
        uStrokeOpacity: { value: border ? 0.65 : 0.92 },
        uFill: { value: new THREE.Color(border ? "#725b40" : "#ce814e") },
        uStroke: { value: new THREE.Color(border ? "#b39465" : "#efd4a1") },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          vView = -view.xyz;
          gl_Position = projectionMatrix * view;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMask;
        uniform float uOpacity;
        uniform float uFillOpacity;
        uniform float uStrokeOpacity;
        uniform vec3 uFill;
        uniform vec3 uStroke;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec2 mask = texture2D(uMask, vec2(fract(vUv.x + ${EARTH_LONGITUDE_UV_OFFSET}), vUv.y)).rg;
          float facing = dot(normalize(vNormal), normalize(vView));
          float alpha = max(mask.r * uFillOpacity, mask.g * uStrokeOpacity)
            * uOpacity * smoothstep(0.0, 0.14, facing);
          if (alpha < 0.002) discard;
          gl_FragColor = vec4(mix(uFill, uStroke, mask.g), alpha);
          #include <colorspace_fragment>
        }
      `,
    });
    const surface = new THREE.Mesh(geometry, material);
    surface.name = border ? "earth-country-borders" : "earth-country-highlight";
    surface.visible = false;
    group.add(surface);
    return { surface, material, texture };
  }

  function disposeLayers() {
    for (const layer of [
      ...layers.map((item) => item.layer),
      ...(borders ? [borders] : []),
    ]) {
      group.remove(layer.surface);
      layer.material.dispose();
      layer.texture.dispose();
    }
    layers = [];
    borders = null;
  }

  return {
    setFeatures(next: readonly AtlasEarthCountryFeature[]) {
      if (
        next.length === features.length &&
        next.every(
          (item, i) =>
            item.slug === features[i].slug &&
            item.feature === features[i].feature,
        )
      )
        return;
      disposeLayers();
      features = next;
      if (!next.length) return;
      borders = makeLayer((context, path) => {
        context.beginPath();
        path(boundaries);
        context.strokeStyle = "red";
        context.lineWidth = highQuality ? 1.1 : 0.8;
        context.stroke();
        context.strokeStyle = "#00ff00";
        context.lineWidth = highQuality ? 1.6 : 1;
        for (const item of next) {
          context.beginPath();
          path(item.feature);
          context.stroke();
        }
      }, true);
      layers = next.map((item) => ({
        slug: item.slug,
        weight: 0,
        layer: makeLayer((context, path) => {
          context.beginPath();
          path(item.feature);
          context.fillStyle = "red";
          context.fill();
          context.strokeStyle = "#00ff00";
          context.lineWidth = highQuality ? 2.1 : 1.3;
          context.stroke();
        }),
      }));
    },
    select(slug: string | null) {
      selected = slug;
    },
    order(renderOrder: number) {
      if (borders) borders.surface.renderOrder = renderOrder;
      layers.forEach((item) => {
        item.layer.surface.renderOrder = renderOrder + 0.001;
      });
    },
    update(delta: number, reducedMotion: boolean, opacity: number) {
      let animating = false;
      if (borders) {
        borders.material.uniforms.uOpacity.value = opacity;
        borders.surface.visible = opacity > 0;
      }
      for (const item of layers) {
        item.weight = advanceCountryEmphasis(
          item.weight,
          item.slug === selected,
          delta,
          reducedMotion,
        );
        const eased = item.weight * item.weight * (3 - 2 * item.weight);
        item.layer.material.uniforms.uOpacity.value = opacity * eased;
        item.layer.surface.visible = opacity * eased > 0.001;
        animating ||= item.weight !== (item.slug === selected ? 1 : 0);
      }
      return animating;
    },
    destroy: disposeLayers,
  };
}
