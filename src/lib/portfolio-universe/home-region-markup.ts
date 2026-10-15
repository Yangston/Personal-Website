import type {
  createCompositionFrame,
  SCENE_MANIFEST,
  resolveWorldPlane,
  WorldPlane,
} from "./scene-manifest";
import type {
  HomeRegionInputs,
  projectHomeRegions,
  regionLayout,
  applyHomeRegions,
} from "./home-regions";

/** Inline and renderer-independent. The native links exist before any module loads. */
export function initializeHomeRegions(
  createFrame: typeof createCompositionFrame,
  manifest: typeof SCENE_MANIFEST,
  resolve: typeof resolveWorldPlane,
  project: typeof projectHomeRegions,
  layout: typeof regionLayout,
  apply: typeof applyHomeRegions,
) {
  const state = window as Window & { __homeRegionsCleanup?: () => void };
  state.__homeRegionsCleanup?.();
  const root = document.querySelector<HTMLElement>("[data-home-regions]");
  if (!root) return;
  const inputs = JSON.parse(
    root.querySelector("[data-home-region-inputs]")!.textContent!,
  ) as HomeRegionInputs & { nebula: WorldPlane };
  const update = () => {
    if (root.dataset.runtimeAttached === "true") return;
    const frame = createFrame(
      "home",
      innerWidth,
      innerHeight,
      manifest,
      undefined,
      resolve,
    );
    root.inert = location.hash !== "" && location.hash !== "#home";
    apply(
      root,
      project(
        frame.project,
        frame.pose.position,
        {
          ...inputs,
          stars: inputs.stars.map(frame.projectToWorld),
          nebula: resolve(inputs.nebula, innerWidth, innerHeight),
        },
        false,
      ),
      layout,
    );
  };
  update();
  window.addEventListener("resize", update);
  window.addEventListener("hashchange", update);
  state.__homeRegionsCleanup = () => {
    window.removeEventListener("resize", update);
    window.removeEventListener("hashchange", update);
    delete state.__homeRegionsCleanup;
  };
}
