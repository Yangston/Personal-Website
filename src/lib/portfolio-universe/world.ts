import {
  SCENE_MANIFEST,
  resolveWorldPlane,
  createCompositionFrame,
} from "./scene-manifest";
import { updateProjectFallback } from "./project-fallback";
import { createProjectConstellationManifest } from "./project-constellations";
import { universeSceneFromHash, type UniverseSceneId } from "./state";
import type { PortfolioUniverseRenderer } from "./renderer";
import { sampleWorldPlate, worldPlateOpacity } from "./artwork-motion";
import { projectedArtworkTransform } from "./artwork-projection";
import {
  CELESTIAL_BODIES,
  bodySize,
  sampleBody,
  bodySceneOpacity,
} from "./body-manifest";
import {
  HOME_EARTH_ROTATION,
  TRAVEL_EARTH_ROTATION,
} from "@/lib/cosmic-transitions/earth";

export type UniverseWorld = {
  host: HTMLElement;
  runtime: PortfolioUniverseRenderer;
  updateLayers: () => void;
  destroy: () => void;
};
let currentWorld: Promise<UniverseWorld> | null = null;

export async function getUniverseWorld(): Promise<UniverseWorld> {
  if (currentWorld) {
    const cachedWorld = currentWorld;
    return cachedWorld.then((world) => {
      if (
        world.host.isConnected &&
        world.host === document.querySelector("[data-universe-world]")
      )
        return world;
      if (cachedWorld !== currentWorld) return getUniverseWorld();
      world.destroy();
      currentWorld = null;
      return getUniverseWorld();
    });
  }
  currentWorld = (async () => {
    const host = document.querySelector<HTMLElement>("[data-universe-world]");
    const canvas = host?.querySelector<HTMLCanvasElement>(
      "[data-universe-renderer]",
    );
    if (!host || !canvas)
      throw new Error("The shared universe shell is missing.");
    const { createPortfolioUniverseRenderer } = await import("./renderer");
    const ids: string[] = JSON.parse(
      host.querySelector("[data-world-projects]")?.textContent ?? "[]",
    );
    const runtime = createPortfolioUniverseRenderer(canvas, undefined, {
      projectManifest: createProjectConstellationManifest(ids),
    });
    const layers = SCENE_MANIFEST.planes.map((plane) => {
      const element = host.querySelector<HTMLElement>(
        `[data-world-plane="${plane.id}"]`,
      );
      const baseWidth = Number(element?.getAttribute("width")) || 1;
      const baseHeight = Number(element?.getAttribute("height")) || 1;
      if (element) {
        element.style.left = "0";
        element.style.top = "0";
        element.style.width = `${baseWidth}px`;
        element.style.height = `${baseHeight}px`;
      }
      return { plane, element, baseWidth, baseHeight };
    });
    const fallback = host.querySelector<HTMLElement>(
      "[data-world-earth-fallback]",
    );
    const transforms = new WeakMap<HTMLElement, string>();
    const writeTransform = (element: HTMLElement, transform: string) => {
      if (transforms.get(element) === transform) return;
      transforms.set(element, transform);
      element.style.transform = transform;
    };
    let effectTimeMs = 0;
    let sceneWeights = { home: 1, about: 0, projects: 0, travel: 0 };
    let liveFlight = false;
    const updateLayers = () => {
      // Hidden fallback artwork needs no per-frame layout writes. Audit captures
      // retain matching geometry; context loss restores it on the next snapshot.
      if (
        host.dataset.artworkReady === "true" &&
        (host.dataset.universeAudit !== "true" || liveFlight)
      )
        return;
      // Audit mode projects cloud planes, but the hidden SVG stars need no
      // writes until WebGL is unavailable (including a context-loss snapshot).
      if (host.dataset.webglReady !== "true")
        updateProjectFallback(
          host,
          (point) => runtime.projectPlane(point, 0, 0),
          createCompositionFrame(
            "home",
            innerWidth,
            innerHeight,
            SCENE_MANIFEST,
          ).projectToWorld,
          innerWidth,
          innerHeight,
        );
      for (const {
        plane: authored,
        element,
        baseWidth,
        baseHeight,
      } of layers) {
        const plane = resolveWorldPlane(
          authored,
          innerWidth,
          innerHeight,
          sceneWeights.travel,
        );
        if (!element) continue;
        const sampled = sampleWorldPlate(
          plane,
          effectTimeMs,
          sceneWeights.about,
        );
        const projection = runtime.projectPlane(
          sampled.position,
          plane.width,
          plane.height,
        );
        if (!projection || (innerWidth <= 700 && !plane.mobile)) {
          if (element.style.visibility !== "hidden")
            element.style.visibility = "hidden";
          if (!projection) writeTransform(element, "matrix(0,0,0,0,0,0)");
          continue;
        }
        if (element.style.visibility !== "visible")
          element.style.visibility = "visible";
        const opacity = String(
          worldPlateOpacity(plane, sceneWeights, projection.depth),
        );
        if (element.style.opacity !== opacity) element.style.opacity = opacity;
        const stack = String(Math.round(1_000_000 - projection.depth * 100));
        if (element.style.zIndex !== stack) element.style.zIndex = stack;
        writeTransform(
          element,
          projectedArtworkTransform(
            projection,
            baseWidth,
            baseHeight,
            sampled.rotation,
          ),
        );
      }
      for (const body of CELESTIAL_BODIES) {
        const element = host.querySelector<HTMLElement>(
          `[data-world-body="${body.id}"]`,
        );
        if (!element) continue;
        const sample = sampleBody(
          body,
          effectTimeMs,
          matchMedia("(prefers-reduced-motion: reduce)").matches,
          innerWidth,
        );
        const projection = runtime.projectPlane(
          sample.position,
          bodySize(body),
          bodySize(body),
        );
        element.style.visibility =
          projection && (innerWidth > 700 || body.mobile) ? "" : "hidden";
        element.style.setProperty(
          "--body-opacity",
          String(
            body.opacity *
              bodySceneOpacity(sceneWeights.about, sceneWeights.projects),
          ),
        );
        if (!projection) continue;
        element.style.left = "0";
        element.style.top = "0";
        element.style.width = "256px";
        element.style.height = "256px";
        element.style.zIndex = String(
          Math.round(1_000_000 - projection.depth * 100),
        );
        writeTransform(
          element,
          projectedArtworkTransform(projection, 256, 256, -sample.roll),
        );
      }
      if (fallback) {
        const projection = runtime.projectPlane(
          SCENE_MANIFEST.anchors.earth,
          SCENE_MANIFEST.earthRadius * 2,
          SCENE_MANIFEST.earthRadius * 2,
        );
        const behindCamera = String(!projection);
        if (fallback.dataset.behindCamera !== behindCamera)
          fallback.dataset.behindCamera = behindCamera;
        if (projection) {
          const stack = String(Math.round(1_000_000 - projection.depth * 100));
          if (fallback.style.zIndex !== stack) fallback.style.zIndex = stack;
          if (fallback.style.width !== "360px") {
            fallback.style.left = "0";
            fallback.style.top = "0";
            fallback.style.width = "360px";
            fallback.style.height = "360px";
          }
          writeTransform(
            fallback,
            `translate3d(${projection.bounds.left.toFixed(2)}px,${projection.bounds.top.toFixed(2)}px,0) scale(${projection.bounds.width / 360})`,
          );
        }
      }
    };
    const initialScene = universeSceneFromHash(location.hash);
    runtime
      .getAtlasEarthBridge()
      ?.setRotation(
        initialScene === "travel" ? TRAVEL_EARTH_ROTATION : HOME_EARTH_ROTATION,
      );
    runtime.jumpTo(initialScene);
    const unsubscribe = runtime.subscribe((snapshot) => {
      effectTimeMs = snapshot.effectTimeMs;
      sceneWeights = snapshot.sceneWeights;
      // Live GPU flights do not need a second, invisible DOM scene. Seeking
      // has no live flight and still synchronizes the audit projection exactly.
      liveFlight = snapshot.flight !== null;
      updateLayers();
    });
    updateLayers();
    host.dataset.runtimeAttached = "true";
    host.dataset.worldInstance = crypto.randomUUID();
    runtime.ready.then(() => updateLayers());
    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) runtime.suspend();
      else destroy();
    };
    const onPageShow = () => {
      if (document.body.dataset.worldMode !== "quiet") runtime.resume();
    };
    const destroy = () => {
      unsubscribe();
      runtime.destroy();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return { host, runtime, updateLayers, destroy };
  })().catch((error: unknown) => {
    currentWorld = null;
    throw error;
  });
  return currentWorld;
}

export function synchronizeWorldPage() {
  const quiet = document.body.dataset.worldMode === "quiet";
  const host = document.querySelector<HTMLElement>("[data-universe-world]");
  if (!host) {
    const staleWorld = currentWorld;
    currentWorld = null;
    staleWorld?.then((world) => world.destroy());
    return;
  }
  host.dataset.worldMode = quiet ? "quiet" : "universe";
  host.dataset.documentHidden = String(document.hidden);
  if (quiet) {
    delete document.documentElement.dataset.universeEnhanced;
    delete document.documentElement.dataset.universeLoading;
    currentWorld?.then(({ runtime }) => runtime.suspend());
  } else {
    // A direct detail visit stays static and does not download the renderer.
    void getUniverseWorld()
      .then(({ runtime }) => runtime.resume())
      .catch(() => {
        host.dataset.rendererType = "fallback";
        host.dataset.webglReady = "false";
      });
  }
}

document.addEventListener("visibilitychange", () => {
  const host = document.querySelector<HTMLElement>("[data-universe-world]");
  if (host) host.dataset.documentHidden = String(document.hidden);
});

export function suspendUniverseWorld() {
  currentWorld?.then(({ runtime }) => runtime.suspend());
}

export async function restoreUniverseWorld(scene: UniverseSceneId) {
  const world = await getUniverseWorld();
  world.host.dataset.worldMode = "universe";
  world.runtime.jumpTo(scene);
  world.runtime.resume();
  world.updateLayers();
  return world;
}
