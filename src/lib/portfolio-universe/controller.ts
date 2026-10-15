import type { PhotographyAtlasController } from "@/lib/photography-atlas/controller";
import {
  HOME_EARTH_ROTATION,
  TRAVEL_EARTH_ROTATION,
} from "@/lib/cosmic-transitions/earth";
import {
  flightDurationMs,
  resolveCameraFlightTiming,
  resolveCameraPose,
  universeFlightMotionProgress,
} from "./camera";
import type { AtlasEarthRotation } from "@/lib/photography-atlas/three-earth-adapter";
import { createProjectPreviews } from "./project-previews";
import { createScenePanels } from "./scene-panels";
import {
  SCENE_MANIFEST,
  createCompositionFrame,
  resolveWorldPlane,
  type WorldPlane,
} from "./scene-manifest";
import { createAboutClouds } from "./about-clouds";
import { sampleWorldPlate } from "./artwork-motion";
import {
  projectHomeRegions,
  regionLayout,
  applyHomeRegions,
  type HomeRegionInputs,
} from "./home-regions";
import { getUniverseWorld, suspendUniverseWorld } from "./world";
import {
  isUniverseSceneId,
  universeSceneFromHash,
  universeSceneHref,
  type UniverseSceneId,
  type UniverseHistoryMode,
} from "./state";
import type { UniverseRuntimeSnapshot } from "./renderer";

type UniverseWindow = Window & {
  __portfolioUniverseCleanup?: () => void;
  __portfolioUniverseInitializing?: HTMLElement;
  __photographyAtlasController?: PhotographyAtlasController;
  __portfolioUniverseAudit?: unknown;
  __homeRegionsCleanup?: () => void;
};

function sceneFromLink(link: HTMLAnchorElement) {
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname !== "/") return null;
  const candidate = url.hash.slice(1) || "home";
  return isUniverseSceneId(candidate) ? candidate : null;
}

export async function initializePortfolioUniverse() {
  const universeWindow = window as UniverseWindow;
  const initialFragment = location.hash.slice(1);
  if (
    initialFragment &&
    !isUniverseSceneId(initialFragment) &&
    initialFragment !== "main-content"
  )
    return;
  const root = document.querySelector<HTMLElement>("[data-portfolio-universe]");
  if (
    !root ||
    root.dataset.enhanced === "true" ||
    universeWindow.__portfolioUniverseInitializing === root
  )
    return;
  universeWindow.__portfolioUniverseCleanup?.();
  universeWindow.__portfolioUniverseInitializing = root;
  const world = await getUniverseWorld().catch(() => null);
  if (!root.isConnected || !world) {
    delete universeWindow.__portfolioUniverseInitializing;
    return;
  }
  const { runtime, host } = world;
  const panels = createScenePanels(root);
  const projectPreviews = createProjectPreviews(root);
  const aboutClouds = createAboutClouds(root, runtime);
  const scenes = new Map<UniverseSceneId, HTMLElement>();
  root
    .querySelectorAll<HTMLElement>("[data-universe-scene]")
    .forEach((section) => {
      if (isUniverseSceneId(section.dataset.universeScene ?? ""))
        scenes.set(section.dataset.universeScene as UniverseSceneId, section);
    });
  const homeRegions = root.querySelector<HTMLElement>("[data-home-regions]");
  const regionInputs = homeRegions
    ? (JSON.parse(
        homeRegions.querySelector("[data-home-region-inputs]")!.textContent!,
      ) as HomeRegionInputs & { nebula: WorldPlane })
    : null;
  if (homeRegions) {
    homeRegions.dataset.runtimeAttached = "true";
    universeWindow.__homeRegionsCleanup?.();
  }
  let hoveredTarget: string | null = null;
  let focusedTarget: string | null = null;
  let pressedTarget: string | null = null;
  let interactionSource: "pointer" | "focus" = "pointer";
  let current = universeSceneFromHash(location.hash);
  let requested = current;
  let travelRotation: AtlasEarthRotation =
    current === "travel"
      ? (runtime.getAtlasEarthBridge()?.getRotation() ?? TRAVEL_EARTH_ROTATION)
      : TRAVEL_EARTH_ROTATION;
  let sequence = 0;
  let disposed = false;
  let userFocusVersion = 0;
  let pendingFocusFrame: number | null = null;
  let flight: {
    from: UniverseSceneId;
    to: UniverseSceneId;
    startOpacity: number;
    earthStart: AtlasEarthRotation;
  } | null = null;
  let atlas: PhotographyAtlasController | null = null;
  let atlasPromise: Promise<PhotographyAtlasController | null> | null = null;
  let atlasGeneration = 0;
  const atlasHost = root.querySelector<HTMLElement>("[data-atlas-launcher]");
  const announcer = root.querySelector<HTMLElement>(
    "[data-universe-announcer]",
  );
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const auditEnabled =
    new URLSearchParams(location.search).has("universeAudit") ||
    host.dataset.universeAudit === "true";
  const projectNodes = [
    ...root.querySelectorAll<HTMLElement>(
      "[data-project-id][data-universe-anchor]",
    ),
  ];

  let lastReadiness = "";
  const mirroredAttributes = new Set<string>();
  const readinessAttributes = [
    "data-renderer-type",
    "data-renderer-ready",
    "data-renderer-failure",
    "data-webgl-ready",
    "data-earth-mesh-count",
  ];
  const copyDiagnostic = (name: string, value: string | null) => {
    if (value === null) {
      if (root.hasAttribute(name)) root.removeAttribute(name);
      mirroredAttributes.delete(name);
    } else {
      if (root.getAttribute(name) !== value) root.setAttribute(name, value);
      mirroredAttributes.add(name);
    }
  };
  const mirrorDiagnostics = (force = false) => {
    if (disposed) return;
    if (!auditEnabled && !force) {
      const readiness = readinessAttributes
        .map((name) => host.getAttribute(name))
        .join("|");
      if (readiness === lastReadiness) return;
      lastReadiness = readiness;
      for (const name of readinessAttributes)
        copyDiagnostic(name, host.getAttribute(name));
      return;
    }
    for (const { name, value } of [...host.attributes]) {
      if (
        !/^data-(renderer|webgl|earth|camera|flight|quality|nebula|constellation|interaction|loaded-cloud|project-count|trail)/.test(
          name,
        )
      )
        continue;
      copyDiagnostic(name, value);
    }
    for (const name of mirroredAttributes)
      if (!host.hasAttribute(name)) copyDiagnostic(name, null);
  };
  const writeStyle = (element: HTMLElement, name: string, value: string) => {
    if (element.style.getPropertyValue(name) !== value)
      element.style.setProperty(name, value);
  };
  const rotationForScene = (scene: UniverseSceneId): AtlasEarthRotation =>
    scene === "travel" ? travelRotation : HOME_EARTH_ROTATION;
  const interpolateEarth = (
    from: AtlasEarthRotation,
    to: AtlasEarthRotation,
    progress: number,
  ): AtlasEarthRotation => {
    const longitudeDelta = ((((to[0] - from[0]) % 360) + 540) % 360) - 180;
    return [
      from[0] + longitudeDelta * progress,
      from[1] + (to[1] - from[1]) * progress,
      from[2] + (to[2] - from[2]) * progress,
    ];
  };
  const setActive = (scene: UniverseSceneId, staging?: UniverseSceneId) => {
    for (const [id, section] of scenes) {
      const active = id === scene;
      section.dataset.sceneActive = String(active);
      if (id === staging) section.dataset.sceneStaging = "true";
      else delete section.dataset.sceneStaging;
      section.inert = !active;
      section.setAttribute("aria-hidden", String(!active));
    }
  };
  const setDestination = (scene: UniverseSceneId) => {
    root.dataset.activeScene = scene;
    document.body.dataset.universeScene = scene;
    document.documentElement.dataset.worldScene = scene;
    host.dataset.activeScene = scene;
    document
      .querySelectorAll<HTMLAnchorElement>('a[href^="/#"], a[href^="#"]')
      .forEach((link) => {
        const target = sceneFromLink(link);
        if (!target) return;
        if (target === scene) link.setAttribute("aria-current", "location");
        else if (link.getAttribute("aria-current") === "location")
          link.removeAttribute("aria-current");
      });
  };
  const projectInterface = () => {
    if (homeRegions && regionInputs) {
      homeRegions.inert = current !== "home" || Boolean(flight);
      if (!homeRegions.inert) {
        const snapshot = runtime.getSnapshot();
        const plane = resolveWorldPlane(
          regionInputs.nebula,
          innerWidth,
          innerHeight,
        );
        const sample = sampleWorldPlate(plane, snapshot.effectTimeMs);
        const [x, y, z] = snapshot.camera.position;
        const regions = projectHomeRegions(
          (point, w = 0, h = w) => runtime.projectPlane(point, w, h),
          { x, y, z },
          {
            ...regionInputs,
            stars: regionInputs.stars.map(
              createCompositionFrame(
                "home",
                innerWidth,
                innerHeight,
                SCENE_MANIFEST,
              ).projectToWorld,
            ),
            nebula: { ...plane, ...sample },
          },
          snapshot.webglReady,
        );
        applyHomeRegions(homeRegions, regions, regionLayout);
      }
    }
    if (
      current !== "projects" &&
      flight?.from !== "projects" &&
      flight?.to !== "projects"
    )
      return;
    for (const node of projectNodes) {
      const projection = runtime.projectAnchor(
        node.dataset.universeAnchor ?? "",
      );
      if (!projection) {
        delete node.dataset.universeAnchorProjected;
        continue;
      }
      writeStyle(node, "--universe-anchor-x", `${projection.x.toFixed(2)}px`);
      writeStyle(node, "--universe-anchor-y", `${projection.y.toFixed(2)}px`);
      writeStyle(
        node,
        "--universe-anchor-scale",
        Math.min(1.2, Math.max(0.7, projection.scale / 26)).toFixed(4),
      );
      const bounds = projection.bounds;
      writeStyle(node, "--universe-anchor-left", `${bounds.left.toFixed(2)}px`);
      writeStyle(node, "--universe-anchor-top", `${bounds.top.toFixed(2)}px`);
      writeStyle(
        node,
        "--universe-anchor-width",
        `${Math.max(44, bounds.width).toFixed(2)}px`,
      );
      writeStyle(
        node,
        "--universe-anchor-height",
        `${Math.max(44, bounds.height).toFixed(2)}px`,
      );
      writeStyle(
        node,
        "--universe-anchor-local-x",
        `${(projection.x - bounds.left).toFixed(2)}px`,
      );
      writeStyle(
        node,
        "--universe-anchor-local-y",
        `${(projection.y - bounds.top).toFixed(2)}px`,
      );
      writeStyle(
        node,
        "--constellation-mobile-viewport-x",
        `${bounds.left.toFixed(2)}px`,
      );
      node.dataset.universeAnchorProjected = "true";
    }
  };
  const cancelDeferredFocus = () => {
    if (pendingFocusFrame !== null) cancelAnimationFrame(pendingFocusFrame);
    pendingFocusFrame = null;
  };
  const onUserFocusIntent = () => {
    userFocusVersion += 1;
    cancelDeferredFocus();
  };
  const focusHeading = (
    scene: UniverseSceneId,
    token = sequence,
    focusVersion = userFocusVersion,
    originalFocus: Element | null = document.activeElement,
  ) => {
    cancelDeferredFocus();
    const heading = scenes.get(scene)?.querySelector<HTMLElement>("h1,h2");
    if (!heading) return;
    const mayFocus = () => {
      const focused = document.activeElement;
      return (
        !disposed &&
        root.isConnected &&
        token === sequence &&
        focusVersion === userFocusVersion &&
        current === scene &&
        requested === scene &&
        !flight &&
        (focused === heading ||
          focused === originalFocus ||
          focused === document.body ||
          focused === document.documentElement)
      );
    };
    if (!mayFocus()) return;
    heading.focus({ preventScroll: true });
    // Native history focus restoration can follow the popstate handler.
    pendingFocusFrame = requestAnimationFrame(() => {
      pendingFocusFrame = requestAnimationFrame(() => {
        pendingFocusFrame = null;
        if (mayFocus()) heading.focus({ preventScroll: true });
      });
    });
  };
  const settle = (scene: UniverseSceneId, alignEarth = false) => {
    if (alignEarth)
      runtime.getAtlasEarthBridge()?.setRotation(rotationForScene(scene));
    flight = null;
    current = scene;
    setActive(scene);
    setDestination(scene);
    scenes.forEach((section) => {
      section.style.removeProperty("opacity");
      section.style.removeProperty("transform");
    });
    delete root.dataset.transitionPhase;
    delete root.dataset.transitionFrom;
    delete root.dataset.transitionTo;
    root.removeAttribute("aria-busy");
    if (announcer) announcer.textContent = SCENE_MANIFEST.labels[scene];
    projectInterface();
    mirrorDiagnostics(true);
  };
  const initializeAtlas = () => {
    if (atlasPromise) return atlasPromise;
    if (!atlasHost) return Promise.resolve(null);
    const generation = ++atlasGeneration;
    atlasHost.dataset.atlasInitializing = "true";
    atlasPromise = import("@/lib/photography-atlas/controller")
      .then(async ({ createPhotographyAtlas }) => {
        await runtime.ready;
        if (disposed || generation !== atlasGeneration) return null;
        const earthBridge = runtime.getAtlasEarthBridge();
        atlas = createPhotographyAtlas(atlasHost, {
          countries: JSON.parse(
            atlasHost.querySelector("[data-atlas-countries]")?.textContent ??
              "[]",
          ),
          hongKong: JSON.parse(
            atlasHost.querySelector("[data-atlas-hong-kong]")?.textContent ??
              "null",
          ),
          earthBridge: earthBridge ?? undefined,
          startPose: "travel",
          startRotation:
            requested === "travel" && !flight
              ? (earthBridge?.getRotation() ?? travelRotation)
              : travelRotation,
          startActive: requested === "travel" && !flight,
          onSelectCountry: (country, trigger) =>
            panels.open(`country-preview-${country.slug}`, trigger),
        });
        atlasHost.dataset.sharedEarth = String(Boolean(earthBridge));
        host.dataset.atlasFallbackReady = String(!earthBridge);
        universeWindow.__photographyAtlasController = atlas;
        return atlas;
      })
      .catch((error: unknown) => {
        if (disposed || generation !== atlasGeneration) return null;
        console.error("The atlas could not be enhanced.", error);
        atlasHost.dataset.atlasFailed = "true";
        const fallback = atlasHost.querySelector<HTMLElement>(
          "[data-atlas-fallback]",
        );
        if (fallback) fallback.hidden = false;
        return null;
      })
      .finally(() => {
        if (generation === atlasGeneration)
          delete atlasHost.dataset.atlasInitializing;
      });
    return atlasPromise;
  };
  const renderForeground = (progress: number, motionProgress: number) => {
    if (!flight) return;
    runtime
      .getAtlasEarthBridge()
      ?.setRotation(
        interpolateEarth(
          flight.earthStart,
          rotationForScene(flight.to),
          motionProgress,
        ),
      );
    const outgoing = scenes.get(flight.from);
    const incoming = scenes.get(flight.to);
    if (outgoing && outgoing === incoming) {
      writeStyle(
        outgoing,
        "opacity",
        String(
          flight.startOpacity + (1 - flight.startOpacity) * motionProgress,
        ),
      );
      return;
    }
    if (outgoing && outgoing !== incoming)
      writeStyle(
        outgoing,
        "opacity",
        String(flight.startOpacity * Math.max(0, 1 - progress / 0.22)),
      );
    if (incoming)
      writeStyle(
        incoming,
        "opacity",
        String(Math.max(0, Math.min(1, (progress - 0.38) / 0.62))),
      );
  };
  const renderFlight = (snapshot: UniverseRuntimeSnapshot) => {
    mirrorDiagnostics();
    aboutClouds.update(snapshot);
    projectInterface();
    if (snapshot.flight)
      renderForeground(
        snapshot.flight.progress,
        snapshot.flight.motionProgress,
      );
  };
  const unsubscribe = runtime.subscribe(renderFlight);
  const visit = async (
    scene: UniverseSceneId,
    mode: UniverseHistoryMode = "push",
    focus = true,
  ) => {
    if (disposed) return;
    const focusVersion = userFocusVersion;
    panels.close(false);
    // Native dialog.close() may restore its opener even when our panel manager
    // suppresses explicit restoration. That focus belongs to this navigation.
    const originalFocus = document.activeElement;
    if (mode === "push" && scene === requested) {
      if (!flight && focus) focusHeading(scene);
      return;
    }
    const token = ++sequence;
    if (current === "travel" && !flight)
      travelRotation =
        runtime.getAtlasEarthBridge()?.getRotation() ?? travelRotation;
    root
      .querySelectorAll<HTMLDetailsElement>("details[open]")
      .forEach((details) => {
        details.open = false;
      });
    requested = scene;
    if (homeRegions) homeRegions.inert = true;
    hoveredTarget = focusedTarget = pressedTarget = null;
    runtime.setInteractionTarget(null);
    if (mode !== "none") {
      const sceneUrl = new URL(universeSceneHref(scene), location.href);
      sceneUrl.search = location.search;
      history[mode === "replace" ? "replaceState" : "pushState"](
        { ...history.state, universeScene: scene },
        "",
        sceneUrl,
      );
    }
    if (scene === "travel") void initializeAtlas();
    atlas?.setActive(false);
    const immediate =
      reducedMotion.matches || host.dataset.webglReady !== "true";
    if (immediate || (!flight && scene === current)) {
      runtime.jumpTo(scene);
      settle(scene, true);
    } else {
      const from = flight
        ? Number(scenes.get(flight.to)?.style.opacity ?? 0) > 0.5
          ? flight.to
          : flight.from
        : current;
      const startOpacity = Number(scenes.get(from)?.style.opacity || 1);
      flight = {
        from,
        to: scene,
        startOpacity,
        earthStart:
          runtime.getAtlasEarthBridge()?.getRotation() ??
          rotationForScene(from),
      };
      setActive(from, scene);
      setDestination(scene);
      root.dataset.transitionPhase = "travelling";
      root.dataset.transitionFrom = from;
      root.dataset.transitionTo = scene;
      root.setAttribute("aria-busy", "true");
      if (scene !== from) scenes.get(scene)?.style.setProperty("opacity", "0");
      const pose = runtime.getSnapshot().camera.position;
      const destination = resolveCameraPose(
        scene,
        innerWidth,
        innerHeight,
      ).position;
      await runtime.retarget(
        scene,
        flightDurationMs(pose, destination, innerWidth),
      );
      if (token !== sequence || disposed) return;
      settle(scene, true);
    }
    if (scene === "travel") {
      const readyAtlas = await initializeAtlas();
      if (token !== sequence || disposed) return;
      readyAtlas?.setActive(true);
    }
    if (token === sequence && !disposed && focus)
      focusHeading(scene, token, focusVersion, originalFocus);
  };
  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
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
    if (
      !link ||
      link.hasAttribute("data-astro-reload") ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    )
      return;
    const scene = sceneFromLink(link);
    if (!scene) return;
    event.preventDefault();
    void visit(scene);
  };
  const onHistory = () => {
    if (disposed || location.pathname !== "/") return;
    const hash = location.hash.slice(1);
    if (hash && !isUniverseSceneId(hash)) return;
    const next = universeSceneFromHash(location.hash);
    // popstate and hashchange may describe the same traversal; requested updates
    // synchronously so the second event cannot restart the flight or steal focus.
    if (next !== requested) void visit(next, "none");
  };
  const onMotionChange = () => {
    // Settled scenes stop their own ambient motion; revisiting would reset the globe and focus.
    if (reducedMotion.matches && flight) void visit(requested, "none");
  };
  const interactionFor = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : null;
    const project =
      element?.closest<HTMLElement>("[data-project-id]")?.dataset.projectId;
    return project
      ? `project:${project}`
      : (element?.closest<HTMLElement>("[data-universe-interaction]")?.dataset
          .universeInteraction ?? null);
  };
  const syncInteraction = () =>
    runtime.setInteractionTarget(
      pressedTarget ??
        (interactionSource === "focus"
          ? (focusedTarget ?? hoveredTarget)
          : (hoveredTarget ?? focusedTarget)),
    );
  const onInteraction = (event: PointerEvent | FocusEvent) => {
    interactionSource = event.type === "focusin" ? "focus" : "pointer";
    if (event.type === "focusin") focusedTarget = interactionFor(event.target);
    else hoveredTarget = interactionFor(event.target);
    syncInteraction();
  };
  const onInteractionLeave = (event: PointerEvent | FocusEvent) => {
    if (event.type === "focusout")
      focusedTarget = interactionFor(event.relatedTarget);
    else hoveredTarget = interactionFor(event.relatedTarget);
    syncInteraction();
  };
  const onPress = (event: PointerEvent) => {
    pressedTarget = interactionFor(event.target);
    syncInteraction();
  };
  const onRelease = () => {
    pressedTarget = null;
    syncInteraction();
  };
  const onContextLoss = () => {
    sequence += 1;
    atlasGeneration += 1;
    panels.close(false);
    runtime.jumpTo(requested);
    world.updateLayers();
    settle(requested, true);
    atlas?.destroy();
    atlas = null;
    atlasPromise = null;
    delete universeWindow.__photographyAtlasController;
    if (requested === "travel")
      void initializeAtlas().then((fallback) => {
        if (!disposed && requested === "travel" && !flight)
          fallback?.setActive(true);
      });
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerdown", onUserFocusIntent, true);
  document.addEventListener("keydown", onUserFocusIntent, true);
  window.addEventListener("popstate", onHistory);
  window.addEventListener("hashchange", onHistory);
  reducedMotion.addEventListener("change", onMotionChange);
  root.addEventListener("pointerover", onInteraction);
  root.addEventListener("pointerdown", onPress);
  document.addEventListener("pointerup", onRelease);
  document.addEventListener("pointercancel", onRelease);
  root.addEventListener("pointerout", onInteractionLeave);
  root.addEventListener("focusin", onInteraction);
  root.addEventListener("focusout", onInteractionLeave);
  host.addEventListener("universe:contextlost", onContextLoss);
  root.dataset.enhanced = "true";
  document.documentElement.dataset.universeEnhanced = "true";
  delete universeWindow.__portfolioUniverseInitializing;
  runtime.jumpTo(current);
  runtime.resume();
  settle(current);
  scrollTo(0, 0);
  if (isUniverseSceneId(location.hash.slice(1)))
    focusHeading(current, sequence, userFocusVersion, null);
  if (current === "travel")
    void initializeAtlas().then((readyAtlas) => {
      if (!disposed && requested === "travel" && !flight)
        readyAtlas?.setActive(true);
    });
  runtime.ready.then(() => mirrorDiagnostics(true));
  if (auditEnabled) {
    universeWindow.__portfolioUniverseAudit = {
      ...runtime,
      seekFlight(from: UniverseSceneId, to: UniverseSceneId, progress: number) {
        sequence += 1;
        panels.close(false);
        atlas?.setActive(false);
        flight = {
          from,
          to,
          startOpacity: 1,
          earthStart: rotationForScene(from),
        };
        current = from;
        requested = to;
        setActive(from, to);
        setDestination(to);
        root.dataset.transitionPhase = "audit";
        const boundedProgress = Math.max(0, Math.min(1, progress));
        renderForeground(
          boundedProgress,
          universeFlightMotionProgress(
            boundedProgress,
            resolveCameraFlightTiming(from, to),
          ),
        );
        const snapshot = runtime.seekFlight(from, to, boundedProgress);
        projectInterface();
        mirrorDiagnostics(true);
        world.updateLayers();
        if (progress >= 1) {
          settle(to, true);
          if (to === "travel") atlas?.setActive(true);
        }
        return snapshot;
      },
    };
  }
  universeWindow.__portfolioUniverseCleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelDeferredFocus();
    sequence += 1;
    atlasGeneration += 1;
    panels.destroy();
    projectPreviews.destroy();
    aboutClouds.destroy();
    atlas?.destroy();
    unsubscribe();
    runtime.cancel();
    suspendUniverseWorld();
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerdown", onUserFocusIntent, true);
    document.removeEventListener("keydown", onUserFocusIntent, true);
    window.removeEventListener("popstate", onHistory);
    window.removeEventListener("hashchange", onHistory);
    reducedMotion.removeEventListener("change", onMotionChange);
    root.removeEventListener("pointerover", onInteraction);
    root.removeEventListener("pointerdown", onPress);
    document.removeEventListener("pointerup", onRelease);
    document.removeEventListener("pointercancel", onRelease);
    root.removeEventListener("pointerout", onInteractionLeave);
    root.removeEventListener("focusin", onInteraction);
    root.removeEventListener("focusout", onInteractionLeave);
    host.removeEventListener("universe:contextlost", onContextLoss);
    delete universeWindow.__portfolioUniverseAudit;
    delete universeWindow.__photographyAtlasController;
    delete document.documentElement.dataset.universeEnhanced;
    root.dataset.enhanced = "false";
  };
}
