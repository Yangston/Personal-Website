import type {
  createCompositionFrame,
  SCENE_MANIFEST,
  resolveWorldPlane,
} from "./scene-manifest";
import type { UniverseSceneId } from "./state";
import type { projectedArtworkTransform } from "./artwork-projection";
import type { updateProjectFallback } from "./project-fallback";

// Called inline before the page is painted; no renderer or network request needed.
export function initializeWorldMarkup(
  createFrame: typeof createCompositionFrame,
  manifest: typeof SCENE_MANIFEST,
  plateTransform: typeof projectedArtworkTransform,
  resolvePlane: typeof resolveWorldPlane,
  projectFallback: typeof updateProjectFallback,
) {
  (
    window as Window & { __ivoryBootCleanup?: () => void }
  ).__ivoryBootCleanup?.();
  const root = document.querySelector<HTMLElement>("[data-universe-world]");
  if (!root) return;
  const apply = () => {
    const hash = location.hash.slice(1);
    const scene = (
      Object.keys(manifest.cameras).includes(hash) ? hash : "home"
    ) as UniverseSceneId;
    const quiet = document.body.dataset.worldMode === "quiet";
    root.dataset.worldMode = quiet ? "quiet" : "universe";
    if (root.dataset.runtimeAttached === "true") return;
    if (hash && !Object.keys(manifest.cameras).includes(hash)) {
      delete document.documentElement.dataset.worldScene;
      queueMicrotask(() => document.getElementById(hash)?.scrollIntoView());
      return;
    }
    document.documentElement.dataset.worldScene = scene;
    const frame = createFrame(
      scene,
      innerWidth,
      innerHeight,
      manifest,
      undefined,
      resolvePlane,
    );
    projectFallback(
      root,
      frame.project,
      frame.projectToWorld,
      innerWidth,
      innerHeight,
    );
    for (const authored of manifest.planes) {
      const plane = resolvePlane(
        authored,
        innerWidth,
        innerHeight,
        scene === "travel" ? 1 : 0,
      );
      const element = root.querySelector<HTMLElement>(
        `[data-world-plane="${plane.id}"]`,
      );
      const projected = frame.project(
        plane.position,
        plane.width,
        plane.height,
      );
      if (!element) continue;
      const near = Math.max(0, Math.min(1, ((projected?.depth ?? 0) - 5) / 19));
      element.style.opacity = String(
        plane.opacity *
          (plane.sceneOpacity?.[scene] ?? 1) *
          (plane.projectCloud ? near * near * (3 - 2 * near) : 1),
      );
      element.style.visibility =
        projected && (innerWidth > 700 || plane.mobile) ? "visible" : "hidden";
      const baseWidth = Number(element.getAttribute("width")) || 1;
      const baseHeight = Number(element.getAttribute("height")) || 1;
      element.style.left = "0";
      element.style.top = "0";
      element.style.width = `${baseWidth}px`;
      element.style.height = `${baseHeight}px`;
      if (!projected) {
        element.style.transform = "matrix(0,0,0,0,0,0)";
        continue;
      }
      element.style.zIndex = String(
        Math.round(1_000_000 - projected.depth * 100),
      );
      element.style.transform = plateTransform(
        projected,
        baseWidth,
        baseHeight,
        plane.rotation,
      );
    }
    const earth = root.querySelector<HTMLElement>(
      "[data-world-earth-fallback]",
    );
    const bodies = JSON.parse(
      root.querySelector("[data-world-bodies]")?.textContent ?? "[]",
    ) as Array<{
      id: string;
      position: { x: number; y: number; z: number };
      mobilePosition: { x: number; y: number; z: number };
      size: number;
      opacity: number;
      mobile: boolean;
    }>;
    for (const body of bodies) {
      const element = root.querySelector<HTMLElement>(
        `[data-world-body="${body.id}"]`,
      );
      if (!element) continue;
      const projected = frame.project(
        innerWidth <= 700 ? body.mobilePosition : body.position,
        body.size,
        body.size,
      );
      element.style.setProperty(
        "--body-opacity",
        String(
          body.opacity *
            (scene === "projects" ? 0 : scene === "about" ? 0.15 : 1),
        ),
      );
      element.style.visibility =
        projected && (innerWidth > 700 || body.mobile) ? "" : "hidden";
      if (!projected) continue;
      element.style.left = "0";
      element.style.top = "0";
      element.style.width = "256px";
      element.style.height = "256px";
      element.style.zIndex = String(
        Math.round(1_000_000 - projected.depth * 100),
      );
      element.style.transform = plateTransform(projected, 256, 256, 0);
    }
    const globe = frame.project(
      manifest.anchors.earth,
      manifest.earthRadius * 2,
    );
    if (earth) earth.dataset.behindCamera = String(!globe);
    if (earth && globe) {
      earth.style.zIndex = String(Math.round(1_000_000 - globe.depth * 100));
      document.documentElement.style.setProperty(
        "--home-travel-size",
        `${globe.bounds.width}px`,
      );
      earth.style.left = "0";
      earth.style.top = "0";
      earth.style.width = "360px";
      earth.style.height = "360px";
      earth.style.transform = `translate3d(${globe.bounds.left}px,${globe.bounds.top}px,0) scale(${globe.bounds.width / 360})`;
    }
    for (const sceneId of ["about", "projects", "travel"] as const) {
      const anchors =
        innerWidth <= 700 ? manifest.mobileHomeLabels : manifest.homeLabels;
      const projected = frame.project(anchors[sceneId]);
      if (!projected) continue;
      document.documentElement.style.setProperty(
        `--home-${sceneId}-x`,
        `${projected.x}px`,
      );
      document.documentElement.style.setProperty(
        `--home-${sceneId}-y`,
        `${projected.y}px`,
      );
    }
  };
  const onHash = () => {
    apply();
    if (root.dataset.runtimeAttached !== "true") scrollTo(0, 0);
  };
  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("hashchange", onHash);
  document.addEventListener("astro:page-load", apply);
  (window as Window & { __ivoryBootCleanup?: () => void }).__ivoryBootCleanup =
    () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("astro:page-load", apply);
    };
}
