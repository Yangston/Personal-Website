import { navigate } from "astro:transitions/client";
import type { PhotographyAtlasController } from "@/lib/photography-atlas/controller";

export type CosmicScene = "home" | "travel" | "projects";

type CosmicWindow = Window & {
  __cosmicTransitionsInitialized?: boolean;
  __photographyAtlasController?: PhotographyAtlasController;
};

type VisualRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TransitionState = {
  from: CosmicScene;
  to: CosmicScene;
};

const ROUTES: Record<CosmicScene, string> = {
  home: "/",
  travel: "/photography",
  projects: "/projects",
};
const TRANSITION_ANIMATION_ID = "cosmic-route-transition";
const ARRIVAL_EASING = "cubic-bezier(.16, 1, .3, 1)";
let activeTransition: TransitionState | null = null;
let atlasInitialization: Promise<void> | null = null;
let atlasModule: Promise<
  typeof import("@/lib/photography-atlas/controller")
> | null = null;

const loadAtlasModule = () =>
  (atlasModule ??= import("@/lib/photography-atlas/controller"));

const routeScene = (pathname: string): CosmicScene | null => {
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (normalized === "/") return "home";
  if (normalized === "/photography") return "travel";
  if (normalized === "/projects") return "projects";
  return null;
};

const backdrop = () =>
  document.querySelector<HTMLElement>("[data-cosmic-backdrop]");
const routeEarth = () =>
  document.querySelector<HTMLElement>("[data-cosmic-route-earth]");
const flightLayer = () =>
  document.querySelector<HTMLElement>("[data-cosmic-flight-layer]");

const deadline = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function startAnimation(
  element: Element | null,
  frames: Keyframe[],
  options: KeyframeAnimationOptions,
) {
  if (!element) return null;
  const animation = element.animate(frames, options);
  animation.id = TRANSITION_ANIMATION_ID;
  return animation;
}

async function waitForAnimation(
  animation: Animation | null,
  maximumDuration: number,
) {
  if (!animation) return;
  await Promise.race([
    animation.finished.catch(() => undefined),
    deadline(maximumDuration),
  ]);
}

function readVisualRect(element: Element | null): VisualRect | null {
  if (!element) return null;
  const box = element.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return null;
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    width: box.width,
    height: box.height,
  };
}

function setVisualRect(element: HTMLElement, rect: VisualRect) {
  element.style.left = `${rect.x}px`;
  element.style.top = `${rect.y}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
  element.style.transform = "translate(-50%, -50%)";
}

async function animateVisualTo(
  element: HTMLElement,
  target: VisualRect,
  duration: number,
  easing = ARRIVAL_EASING,
  rotation = 0,
) {
  const source = readVisualRect(element);
  if (!source) {
    setVisualRect(element, target);
    return;
  }
  setVisualRect(element, source);
  const translateX = target.x - source.x;
  const translateY = target.y - source.y;
  const scaleX = target.width / source.width;
  const scaleY = target.height / source.height;
  const animation = startAnimation(
    element,
    [
      {
        opacity: 1,
        transform:
          "translate(-50%, -50%) translate3d(0, 0, 0) scale(1, 1) rotate(0deg)",
      },
      {
        opacity: 1,
        transform: `translate(-50%, -50%) translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY}) rotate(${rotation}deg)`,
      },
    ],
    { duration, easing, fill: "forwards" },
  );
  await waitForAnimation(animation, duration + 140);
  setVisualRect(element, target);
  animation?.cancel();
}

function foregroundElements(scene: CosmicScene) {
  const selector =
    scene === "home"
      ? "[data-home-foreground]"
      : scene === "travel"
        ? ".atlas-heading, .atlas-country-labels, .atlas-city-markers, .atlas-country-leaders, .atlas-country-preview, .atlas-status"
        : ".project-sky-heading, .project-constellations";
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

async function fadeOutgoingForeground(scene: CosmicScene) {
  const animations = foregroundElements(scene).map((element) =>
    startAnimation(
      element,
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-1rem)" },
      ],
      { duration: 240, easing: "ease", fill: "forwards" },
    ),
  );
  await Promise.all(
    animations.map((animation) => waitForAnimation(animation, 340)),
  );
}

function startForegroundReveal(scene: CosmicScene) {
  return foregroundElements(scene).map((element) =>
    startAnimation(
      element,
      [
        { opacity: 0, transform: "translateY(0.8rem)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 420, easing: ARRIVAL_EASING, fill: "forwards" },
    ),
  );
}

function projectDepartureRect(source: VisualRect) {
  const scale = source.width < window.innerWidth ? 4.2 : 2.8;
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    // The final rotation expands the rendered bounding box by roughly 24%.
    // Keep the visual rim, rather than only its unrotated layout box, off-screen.
    x: -width * 0.7 - 8,
    y: source.y + window.innerHeight * 0.08,
    width,
    height,
  };
}

function projectsSourceRect(): VisualRect {
  const diameter = Math.max(window.innerWidth, window.innerHeight) * 2.15;
  return {
    x: -diameter * 0.58,
    y: window.innerHeight * 0.58,
    width: diameter,
    height: diameter,
  };
}

async function prepareMover(from: CosmicScene, to: CosmicScene) {
  if (from === "travel") {
    const atlas = (window as CosmicWindow).__photographyAtlasController;
    const prepared = await atlas?.prepareRouteHandoff(
      to === "projects" ? "projects" : "home",
    );
    return prepared ? flightLayer() : null;
  }

  const earth = routeEarth();
  if (!earth) return null;
  if (from === "home") {
    const localEarth = document.querySelector<HTMLElement>("[data-home-earth]");
    const source = readVisualRect(localEarth);
    if (!localEarth || !source) return null;
    setVisualRect(earth, source);
    earth.dataset.visible = "true";
    localEarth.dataset.cosmicSourceHidden = "true";
    return earth;
  }

  setVisualRect(earth, projectsSourceRect());
  earth.dataset.visible = "true";
  return earth;
}

async function initializeAtlas() {
  const cosmicWindow = window as CosmicWindow;
  const launcher = document.querySelector<HTMLElement>("[data-atlas-launcher]");
  if (!launcher) return;
  if (
    cosmicWindow.__photographyAtlasController &&
    launcher.dataset.atlasReady === "true"
  )
    return;
  if (atlasInitialization) return atlasInitialization;

  atlasInitialization = (async () => {
    cosmicWindow.__photographyAtlasController?.destroy();
    cosmicWindow.__photographyAtlasController = undefined;
    if (launcher.dataset.atlasInitializing === "true") return;
    launcher.dataset.atlasInitializing = "true";
    const countriesData = launcher.querySelector<HTMLScriptElement>(
      "[data-atlas-countries]",
    );
    const hongKongData = launcher.querySelector<HTMLScriptElement>(
      "[data-atlas-hong-kong]",
    );
    const fallback = launcher.querySelector<HTMLElement>(
      "[data-atlas-fallback]",
    );
    try {
      const { createPhotographyAtlas } = await loadAtlasModule();
      if (!launcher.isConnected) return;
      cosmicWindow.__photographyAtlasController = createPhotographyAtlas(
        launcher,
        {
          countries: JSON.parse(countriesData?.textContent ?? "[]"),
          hongKong: JSON.parse(hongKongData?.textContent ?? "null"),
        },
      );
    } catch (error) {
      console.error("The travel atlas could not load.", error);
      launcher.dataset.atlasFailed = "true";
      if (fallback) fallback.hidden = false;
    }
  })().finally(() => {
    atlasInitialization = null;
  });
  return atlasInitialization;
}

async function destinationTarget(scene: "home" | "travel") {
  if (scene === "home") {
    const element = document.querySelector<HTMLElement>("[data-home-earth]");
    const rect = readVisualRect(element);
    return element && rect ? { element, rect } : null;
  }

  await initializeAtlas();
  const atlas = (window as CosmicWindow).__photographyAtlasController;
  const element = document.querySelector<HTMLCanvasElement>(
    "[data-atlas-canvas]",
  );
  const rect = atlas?.getGlobeRect() ?? null;
  return element && rect ? { element, rect } : null;
}

function resetPersistentLayers(scene: CosmicScene) {
  const layer = backdrop();
  if (layer) {
    layer.dataset.scene = scene;
    delete layer.dataset.transitionTarget;
    delete layer.dataset.transitionPhase;
  }
  for (const element of [routeEarth(), flightLayer()]) {
    if (!element) continue;
    element.getAnimations().forEach((animation) => animation.cancel());
    element.dataset.visible = "false";
    element.style.removeProperty("left");
    element.style.removeProperty("top");
    element.style.removeProperty("width");
    element.style.removeProperty("height");
    element.style.removeProperty("transform");
  }
  const flight = flightLayer();
  if (flight) {
    delete flight.dataset.flightPhase;
    delete flight.dataset.flightOpacity;
  }
  document
    .querySelectorAll<HTMLElement>("[data-cosmic-source-hidden]")
    .forEach((element) => delete element.dataset.cosmicSourceHidden);
  document
    .querySelectorAll<HTMLElement>("[data-atlas-launcher]")
    .forEach((launcher) => launcher.removeAttribute("aria-busy"));
  delete document.body.dataset.cosmicTransitionPhase;
  document
    .getAnimations()
    .filter((animation) => animation.id === TRANSITION_ANIMATION_ID)
    .forEach((animation) => animation.cancel());
}

async function onPageLoad() {
  const scene = routeScene(window.location.pathname);
  if (!scene) return;
  document.body.dataset.cosmicScene = scene;
  const layer = backdrop();
  if (layer) layer.dataset.scene = scene;
  if (scene === "travel") await initializeAtlas();
  if (activeTransition?.to === scene) return;
  activeTransition = null;
  resetPersistentLayers(scene);
}

async function performNavigation(to: CosmicScene) {
  const fallbackTimer = window.setTimeout(
    () => window.location.assign(ROUTES[to]),
    10_000,
  );
  try {
    await navigate(ROUTES[to]);
  } catch (error) {
    window.location.assign(ROUTES[to]);
    throw error;
  } finally {
    window.clearTimeout(fallbackTimer);
  }
}

async function transitionToProjects(mover: HTMLElement, from: CosmicScene) {
  let layer = backdrop();
  if (layer) layer.dataset.transitionPhase = "departing";
  const source = readVisualRect(mover);
  if (!source) {
    await performNavigation("projects");
    return;
  }
  const duration = from === "travel" ? 1_080 : 920;
  const exit = animateVisualTo(
    mover,
    projectDepartureRect(source),
    duration,
    "cubic-bezier(.45, .02, .25, 1)",
    -16,
  );
  const navigation = deadline(160).then(() => performNavigation("projects"));
  await navigation;
  layer = backdrop();
  if (layer) {
    layer.dataset.transitionTarget = "projects";
    layer.dataset.transitionPhase = "arriving";
  }
  const reveals = startForegroundReveal("projects");
  await Promise.all([
    exit,
    ...reveals.map((animation) => waitForAnimation(animation, 540)),
  ]);
}

async function transitionToEarthScene(
  mover: HTMLElement,
  from: CosmicScene,
  to: "home" | "travel",
) {
  let layer = backdrop();
  if (layer) layer.dataset.transitionPhase = "departing";
  const source = readVisualRect(mover);
  if (!source) {
    await performNavigation(to);
    return;
  }
  const navigation = deadline(100).then(() => performNavigation(to));
  if (from === "projects") {
    const driftTarget = {
      ...source,
      x: source.x + source.width * 0.25,
    };
    const drift = animateVisualTo(mover, driftTarget, 360);
    await Promise.all([drift, navigation]);
  } else {
    await navigation;
  }
  layer = backdrop();
  if (layer) {
    layer.dataset.transitionTarget = to;
    layer.dataset.transitionPhase = "arriving";
  }

  const target = await destinationTarget(to);
  if (!target) return;
  await animateVisualTo(mover, target.rect, from === "projects" ? 820 : 680);

  if (layer) layer.dataset.transitionPhase = "handoff";
  await nextFrame();
  const moverFade = startAnimation(
    mover,
    [
      { opacity: 1, transform: "translate(-50%, -50%)" },
      { opacity: 0, transform: "translate(-50%, -50%)" },
    ],
    { duration: 180, easing: "ease", fill: "forwards" },
  );
  const destinationFade = startAnimation(
    target.element,
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 180, easing: "ease", fill: "forwards" },
  );
  const reveals = startForegroundReveal(to);
  const atlasArrival =
    to === "travel"
      ? (
          window as CosmicWindow
        ).__photographyAtlasController?.animateRouteArrival()
      : undefined;
  await Promise.all([
    waitForAnimation(moverFade, 280),
    waitForAnimation(destinationFade, 280),
    ...reveals.map((animation) => waitForAnimation(animation, 540)),
    atlasArrival,
  ]);
}

async function runRouteTransition(from: CosmicScene, to: CosmicScene) {
  activeTransition = { from, to };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    await performNavigation(to);
    activeTransition = null;
    resetPersistentLayers(to);
    return;
  }

  const layer = backdrop();
  if (layer) {
    layer.dataset.transitionTarget = to;
    layer.dataset.transitionPhase = "preparing";
  }
  if (to === "travel") void loadAtlasModule();
  document.body.dataset.cosmicTransitionPhase = "preparing";
  const outgoingFade = fadeOutgoingForeground(from);
  const mover = await prepareMover(from, to);
  if (!mover) {
    await outgoingFade;
    await performNavigation(to);
    activeTransition = null;
    resetPersistentLayers(to);
    return;
  }
  try {
    const routeMotion =
      to === "projects"
        ? transitionToProjects(mover, from)
        : transitionToEarthScene(mover, from, to);
    await Promise.all([outgoingFade, routeMotion]);
  } finally {
    activeTransition = null;
    resetPersistentLayers(to);
  }
}

export function initializeCosmicTransitions() {
  const cosmicWindow = window as CosmicWindow;
  if (cosmicWindow.__cosmicTransitionsInitialized) return;
  cosmicWindow.__cosmicTransitionsInitialized = true;

  document.addEventListener("astro:page-load", () => void onPageLoad());
  document.addEventListener("astro:before-swap", () => {
    cosmicWindow.__photographyAtlasController?.destroy();
    cosmicWindow.__photographyAtlasController = undefined;
    atlasInitialization = null;
  });
  document.addEventListener(
    "click",
    (event) => {
      if (!(event instanceof MouseEvent) || event.defaultPrevented) return;
      if (
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.hasAttribute("data-astro-reload")) return;
      const targetUrl = new URL(link.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;
      const from = routeScene(window.location.pathname);
      const to = routeScene(targetUrl.pathname);
      if (!from || !to || from === to) return;
      if (activeTransition) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      void runRouteTransition(from, to).catch((error) => {
        console.error("The route transition could not complete.", error);
        activeTransition = null;
        resetPersistentLayers(to);
      });
    },
    { capture: true },
  );

  void onPageLoad();
}
