import * as THREE from "three";
import { NEBULA_PATCHES, sampleNebulaPatches } from "./ambient-effects";
import {
  NEBULA_GRADE,
  NEBULA_SWIRL_LIMIT,
  NEBULA_SWIRL_EXCLUSIONS,
  sampleNebulaSwirls,
} from "./nebula-light";

export function createNebulaMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    uniforms: {
      uTexture: { value: null },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
      uWarp: { value: 0 },
      uEdge: { value: 0.18 },
      uAbout: { value: 0 },
      uSwirls: {
        value: sampleNebulaSwirls(0, true).map(
          ({ x, y, dx, dy }) => new THREE.Vector4(x, y, dx, dy),
        ),
      },
      uPatches: {
        value: NEBULA_PATCHES.map(([x, y, r]) => new THREE.Vector4(x, y, r, 0)),
      },
    },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity, uTime, uWarp, uEdge, uAbout;
      uniform vec4 uPatches[6];
      uniform vec4 uSwirls[3];
      varying vec2 vUv;
      float rectangleDistance(vec2 p, vec4 b) {
        return length(max(max(b.xy-p,p-b.zw),vec2(0.0)));
      }
      void main(){
        vec4 base=texture2D(uTexture,vUv);
        vec2 offset=vec2(0.0);float glow=0.0;
        for(int i=0;i<6;i++){
          vec2 center=vec2(uPatches[i].x,1.0-uPatches[i].y);
          vec2 d=vUv-center;
          float falloff=exp(-dot(d,d)/(uPatches[i].z*uPatches[i].z)*2.8)*uPatches[i].w;
          glow+=falloff;
          offset+=(d+vec2(sin(uTime*0.2+float(i)),cos(uTime*0.17+float(i)))*0.08)*falloff*uWarp*18.0;
        }
        offset*=smoothstep(0.15,0.8,base.a);
        float lengthOffset=length(offset);
        offset*=min(1.0,0.01/max(lengthOffset,0.00001));
        vec2 topUv=vec2(vUv.x,1.0-vUv.y);
        float clearance=length(topUv-vec2(0.465,0.435))-0.13;
        ${NEBULA_SWIRL_EXCLUSIONS.map((bounds) => `clearance=min(clearance,rectangleDistance(topUv,vec4(${bounds.map((v) => v.toFixed(5)).join(",")})));`).join("\n")}
        vec2 swirl=vec2(0.0);float total=0.0;
        for(int i=0;i<3;i++){
          vec2 d=topUv-uSwirls[i].xy;
          float weight=exp(-dot(d,d)/0.025);
          float curl=uSwirls[i].z+uSwirls[i].w*0.35;
          swirl+=vec2(-d.y,d.x)*weight*curl/max(0.06,length(d));total+=weight;
        }
        swirl/=max(max(1.0,total),length(swirl)/${NEBULA_SWIRL_LIMIT.toFixed(5)});
        swirl*=smoothstep(0.0,0.035,clearance)*uAbout*smoothstep(0.0,0.25,base.a);
        vec2 uv=clamp(vUv+offset+swirl*vec2(1.0,-1.0),0.0,1.0);
        vec4 texel=texture2D(uTexture,uv);
        vec3 rgb=texel.rgb;
        float rim=base.a*(1.0-base.a)*4.0;
        vec3 home=rgb*(1.0+glow*0.60)+vec3(0.14,0.075,0.025)*glow;
        home=mix(home,vec3(1.0,0.87,0.65),rim*uEdge);
        // Only the small stellar hotspot is compressed in About. The cloud
        // folds retain source color, matching their masked HTML foreground.
        vec2 coreDelta=vUv-vec2(0.465,0.565);
        float core=exp(-dot(coreDelta,coreDelta)*700.0);
        float bright=smoothstep(0.68,1.0,dot(rgb,vec3(0.2126,0.7152,0.0722)));
        // Grade in display space, matching CSS contrast/saturate/brightness.
        // Clamp between operations as CSS does, so foreground crops stay aligned.
        vec3 display=sRGBTransferOETF(vec4(rgb,1.0)).rgb;
        display=clamp((display*${NEBULA_GRADE.brightness}-0.5)*${NEBULA_GRADE.contrast}+0.5,0.0,1.0);
        float luminance=dot(display,vec3(0.213,0.715,0.072));
        display=clamp(mix(vec3(luminance),display,${NEBULA_GRADE.saturation}),0.0,1.0);
        vec3 about=sRGBTransferEOTF(vec4(display,1.0)).rgb;
        about+=vec3(0.11,0.07,0.035)*glow*(1.0-bright)*(1.0-core);
        about*=1.0-0.22*core*bright;
        rgb=mix(home,about,uAbout);
        gl_FragColor=vec4(rgb,mix(base.a,texel.a,uAbout)*uOpacity);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function updateNebulaMaterial(
  material: THREE.ShaderMaterial,
  timeMs: number,
  strength: number,
  reduced: boolean,
  opacity: number,
  about = 0,
) {
  const sample = sampleNebulaPatches(timeMs, strength, reduced);
  material.uniforms.uTime.value = timeMs / 1000;
  material.uniforms.uAbout.value = about;
  material.uniforms.uWarp.value = sample.warp * (1 - about);
  material.uniforms.uOpacity.value = opacity;
  material.uniforms.uEdge.value = Math.min(0.7, 0.2 + strength * 0.23);
  const swirls = material.uniforms.uSwirls.value as THREE.Vector4[];
  sampleNebulaSwirls(timeMs, reduced).forEach(({ x, y, dx, dy }, i) =>
    swirls[i].set(x, y, dx, dy),
  );
  const patches = material.uniforms.uPatches.value as THREE.Vector4[];
  sample.weights.forEach((value, i) => {
    patches[i].w = value;
  });
}
