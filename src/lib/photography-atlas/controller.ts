import {
  geoAlbersUsa,
  geoArea,
  geoContains,
  geoMercator,
  geoOrthographic,
  geoPath,
  geoTransform,
  type GeoPermissibleObjects,
  type GeoProjection,
} from "d3-geo";
import { feature, mesh } from "topojson-client";
import { prefetch } from "astro:prefetch";
import { navigate } from "astro:transitions/client";
import countries110m from "world-atlas/countries-110m.json";
import {
  HOME_EARTH_ROTATION,
  TRAVEL_EARTH_ROTATION,
} from "@/lib/cosmic-transitions/earth";
import {
  atlasCanvasPixelRatio,
  atlasLabelLeaderPoints,
  compareAtlasCountryHitPriority,
  placeAtlasLabels,
  placeGlobeAroundHeading,
  shortestLongitudeTarget,
  type AtlasCountrySummary,
  type AtlasLayoutBounds,
} from "./data";
import type {
  AtlasEarthBridge,
  AtlasEarthRotation,
} from "./three-earth-adapter";
import { easeOutCubic, interpolatePoint } from "./transition";
import {
  createAtlasSpin,
  advanceCountryEmphasis,
  coordinateFacing,
  atlasAnchorOpacity,
} from "./motion";

type AtlasFeature = GeoJSON.Feature<GeoJSON.Geometry, { name?: string }>;
type AtlasCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { name?: string }
>;

export type AtlasStartPose = "home" | "travel";

export type PhotographyAtlasEarthBridge = Pick<
  AtlasEarthBridge,
  | "cancelCountryHandoff"
  | "getGlobeRect"
  | "pickCoordinate"
  | "prepareCountryHandoff"
  | "projectCoordinate"
  | "setCountryEmphasis"
  | "setCountryFeatures"
  | "setCountryHandoffProgress"
  | "setInteractionEnabled"
  | "setRotation"
  | "subscribeFrame"
>;

export type AtlasOptions = {
  countries: AtlasCountrySummary[];
  hongKong: AtlasFeature;
  earthBridge?: PhotographyAtlasEarthBridge;
  startPose?: AtlasStartPose;
  startRotation?: AtlasEarthRotation;
  startActive?: boolean;
  onSelectCountry?: (
    country: AtlasCountrySummary,
    trigger?: HTMLElement,
  ) => void;
};

export interface PhotographyAtlasController {
  animateRouteArrival(): Promise<void>;
  destroy(): void;
  getGlobeRect(): AtlasGlobeRect | null;
  prepareRouteHandoff(destination: "home" | "projects"): Promise<boolean>;
  setActive(active: boolean): void;
  setAutoSpinPaused(paused: boolean): void;
}

export type AtlasGlobeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BridgeGlobeRect = NonNullable<
  ReturnType<PhotographyAtlasEarthBridge["getGlobeRect"]>
>;

function isUsableBridgeGlobeRect(
  rect: ReturnType<PhotographyAtlasEarthBridge["getGlobeRect"]> | undefined,
): rect is BridgeGlobeRect {
  return (
    rect !== null &&
    rect !== undefined &&
    [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

type Rotation = [number, number, number];

type AtlasPalette = {
  atmosphereHighlight: string;
  atmosphereMid: string;
  atmosphereFade: string;
  oceanFill: string;
  oceanStroke: string;
  landFill: string;
  landStroke: string;
  countryFill: string;
  countryDepth: string;
  countryStroke: string;
  countryActiveFill: string;
  countryActiveStroke: string;
  countryGlow: string;
  countryGlowStroke: string;
};

const COUNTRY_MORPH_DURATION = 460;

const topology = countries110m as unknown as {
  objects: { countries: Parameters<typeof feature>[1] };
};
const baseFeatures = (
  feature(
    topology as never,
    topology.objects.countries,
  ) as unknown as AtlasCollection
).features;

const countryBoundaries = mesh(
  topology as never,
  topology.objects.countries as never,
  (a, b) => a !== b,
);

function readCssColor(
  styles: CSSStyleDeclaration,
  properties: string[],
  fallback: string,
) {
  for (const property of properties) {
    const value = styles.getPropertyValue(property).trim();
    if (value && CSS.supports("color", value)) return value;
  }
  return fallback;
}

function readAtlasPalette(host: HTMLElement): AtlasPalette {
  const styles = getComputedStyle(host);
  return {
    atmosphereHighlight: readCssColor(
      styles,
      ["--atlas-atmosphere-highlight"],
      "rgba(206, 226, 232, .74)",
    ),
    atmosphereMid: readCssColor(
      styles,
      ["--atlas-atmosphere-mid"],
      "rgba(199, 184, 255, .3)",
    ),
    atmosphereFade: readCssColor(
      styles,
      ["--atlas-atmosphere-fade"],
      "rgba(239, 69, 41, 0)",
    ),
    oceanFill: readCssColor(styles, ["--atlas-ocean-fill"], "#dce9ec"),
    oceanStroke: readCssColor(
      styles,
      ["--atlas-ocean-stroke"],
      "rgba(23, 22, 21, .28)",
    ),
    landFill: readCssColor(
      styles,
      ["--atlas-land-fill", "--universe-paper", "--color-paper"],
      "#f5f0e8",
    ),
    landStroke: readCssColor(
      styles,
      ["--atlas-land-stroke"],
      "rgba(23, 22, 21, .2)",
    ),
    countryFill: readCssColor(
      styles,
      ["--atlas-country-fill", "--universe-signal", "--color-signal"],
      "#ff8d6d",
    ),
    countryDepth: readCssColor(styles, ["--atlas-country-depth"], "#c74b38"),
    countryStroke: readCssColor(styles, ["--atlas-country-stroke"], "#f5f0e8"),
    countryActiveFill: readCssColor(
      styles,
      ["--atlas-country-active-fill"],
      "#b7cf69",
    ),
    countryActiveStroke: readCssColor(
      styles,
      ["--atlas-country-active-stroke"],
      "#ff8d6d",
    ),
    countryGlow: readCssColor(
      styles,
      ["--atlas-country-glow"],
      "rgba(199, 184, 255, .88)",
    ),
    countryGlowStroke: readCssColor(
      styles,
      ["--atlas-country-glow-stroke"],
      "rgba(239, 69, 41, .66)",
    ),
  };
}

function drawGeometry(
  context: CanvasRenderingContext2D,
  projection: GeoProjection,
  geometry: GeoPermissibleObjects,
) {
  context.beginPath();
  geoPath(projection, context)(geometry);
}

function isPlainActivation(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

async function navigateWithFallback(targetUrl: string) {
  const target = new URL(targetUrl, window.location.href);
  const hasReachedTarget = () =>
    window.location.pathname === target.pathname &&
    window.location.hash === target.hash;
  const fallbackTimer = window.setTimeout(() => {
    if (!hasReachedTarget()) window.location.assign(target.href);
  }, 1_600);
  try {
    await navigate(targetUrl);
    if (!hasReachedTarget()) window.location.assign(target.href);
  } catch (error) {
    window.location.assign(target.href);
    throw error;
  } finally {
    window.clearTimeout(fallbackTimer);
  }
}

function createCountryMapProjection(
  slug: string,
  width: number,
  height: number,
  country: AtlasFeature,
) {
  const target = slug === "united-states" ? geoAlbersUsa() : geoMercator();
  return target.fitExtent(
    [
      [width * 0.12, height * 0.16],
      [width * 0.88, height * 0.9],
    ],
    country,
  );
}

export function createPhotographyAtlas(
  host: HTMLElement,
  options: AtlasOptions,
): PhotographyAtlasController {
  const atlasShell = host.closest<HTMLElement>(".photography-atlas");
  const canvas = host.querySelector<HTMLCanvasElement>("[data-atlas-canvas]");
  const overlay = host.querySelector<SVGSVGElement>("[data-atlas-overlay]");
  const handoffShape = host.querySelector<SVGPathElement>(
    "[data-atlas-handoff-shape]",
  );
  const status = host.querySelector<HTMLElement>("[data-atlas-status]");
  if (!canvas || !overlay || !handoffShape)
    throw new Error("The atlas shell is incomplete.");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  const countryById = new Map(
    options.countries.map((country) => [country.atlasId, country]),
  );
  const activeFeatures = baseFeatures
    .filter((item) => countryById.has(Number(item.id)))
    .concat(options.hongKong);
  const countryBySlug = new Map(
    options.countries.map((country) => [country.slug, country]),
  );
  const featureBySlug = new Map(
    activeFeatures.map((item) => {
      const country = countryById.get(Number(item.id));
      return [country?.slug ?? "", item] as const;
    }),
  );
  const bridgeCountryFeatures = [...featureBySlug]
    .filter(([slug]) => Boolean(slug))
    .map(([slug, countryFeature]) => ({ slug, feature: countryFeature }));
  const countryHitTargets = options.countries
    .flatMap((country) => {
      const countryFeature = featureBySlug.get(country.slug);
      return countryFeature
        ? [
            {
              country,
              countryFeature,
              slug: country.slug,
              area: geoArea(countryFeature),
            },
          ]
        : [];
    })
    .sort(compareAtlasCountryHitPriority);
  const labelLinks = [
    ...host.querySelectorAll<HTMLAnchorElement>("[data-atlas-country]"),
  ];
  host.dataset.atlasLabelLayout = "projected";
  const labelBySlug = new Map(
    labelLinks.map((link) => [link.dataset.atlasCountry ?? "", link]),
  );
  const leaderBySlug = new Map(
    [...host.querySelectorAll<SVGPolylineElement>("[data-atlas-leader]")].map(
      (leader) => [leader.dataset.atlasLeader ?? "", leader],
    ),
  );
  const cityLinks = [
    ...host.querySelectorAll<HTMLAnchorElement>("[data-atlas-city]"),
  ].flatMap((link) => {
    const country = countryBySlug.get(link.dataset.atlasCityCountry ?? "");
    const city = country?.cities.find(
      (candidate) => candidate.id === link.dataset.atlasCity,
    );
    return country && city ? [{ link, country, city }] : [];
  });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const projection = geoOrthographic().clipAngle(90).precision(0.4);
  const startPose = options.startPose ?? "travel";
  const rotation: Rotation = options.startRotation
    ? [...options.startRotation]
    : startPose === "home"
      ? [...HOME_EARTH_ROTATION]
      : [...TRAVEL_EARTH_ROTATION];
  if (startPose === "travel")
    host.dataset.atlasRouteRotation = rotation.join(",");
  let active = options.startActive ?? true;
  let palette = readAtlasPalette(host);
  let width = 1;
  let height = 1;
  let hostBounds = host.getBoundingClientRect();
  let canvasBounds = canvas.getBoundingClientRect();
  let scale = 1;
  let renderRatio = 1;
  let globeCenter: [number, number] = [0.5, 0.5];
  let frame: number | null = null;
  let lastTime = performance.now();
  let lastCanvasFrame = -Infinity;
  let hoveredSlug: string | null = null;
  let focusedSlug: string | null = null;
  let pointerDown = false;
  let pointerMoved = false;
  let pointerId = -1;
  let previousPointer = { x: 0, y: 0 };
  let velocity = { longitude: 0, latitude: 0 };
  let documentVisible = !document.hidden;
  let transitionSlug: string | null = null;
  let transitionZoom = 0;
  let transitionWorldFade = 0;
  let transitionMorph = -1;
  let transitionFeature: AtlasFeature | null = null;
  let transitionTarget: GeoProjection | null = null;
  let spaceTransition = false;
  let homeTransition = false;
  let routeArrivalPending = startPose === "home";
  let routeArrival: Promise<void> | null = null;
  let arrivalGeneration = 0;
  let flightFrozen = false;
  let destroyed = false;
  let handoffGeneration = 0;
  let countryTransitionGeneration = 0;
  let sharedEarthLayoutActive = false;
  let countryHandoffAbort: AbortController | null = null;
  let countryFadeAnimation: Animation | null = null;
  let countryTransitionStartRotation: Rotation | null = null;
  let bridgeCountryHandoffPrepared = false;
  let labelObstacles: AtlasLayoutBounds[] = [];
  let unsubscribeEarthFrame: (() => void) | null = null;
  const transitionFrames = new Set<number>();
  const labelPlacements = new Map<
    string,
    {
      x: number;
      y: number;
      side: -1 | 1;
      slot: number;
    }
  >();
  const labelMetrics = new Map<string, { width: number; height: number }>();

  const spin = createAtlasSpin();
  let autoSpinPaused = false;
  let canvasPointer: { x: number; y: number } | null = null;
  const emphasisWeights = new Map<string, number>();
  const overlayNavigation = [
    ...host.querySelectorAll<HTMLElement>(
      ".atlas-country-labels, .atlas-city-markers",
    ),
  ];
  const setOverlaysReady = (ready: boolean) => {
    if (host.dataset.atlasOverlaysReady !== String(ready))
      host.dataset.atlasOverlaysReady = String(ready);
    overlayNavigation.forEach((nav) => {
      if (nav.inert === ready) nav.inert = !ready;
    });
  };
  setOverlaysReady(false);

  const setHover = (slug: string | null) => {
    options.earthBridge?.setCountryEmphasis(focusedSlug ?? slug);
    if (hoveredSlug === slug) return;
    hoveredSlug = slug;
    host.dataset.hoverCountry = slug ?? "";
    const country = slug ? countryBySlug.get(slug) : undefined;
    if (status)
      status.textContent = country
        ? `${country.name}, ${country.count} photographs`
        : "Drag to turn the atlas";
    startFrame();
  };

  const writeStyle = (
    element: HTMLElement,
    property: string,
    value: string,
  ) => {
    if (element.style.getPropertyValue(property) !== value)
      element.style.setProperty(property, value);
  };
  const writeData = (
    element: HTMLElement | SVGElement,
    key: string,
    value: string,
  ) => {
    if (element.dataset[key] !== value) element.dataset[key] = value;
  };
  const writeAttribute = (element: Element, name: string, value: string) => {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };
  const writeGlobeLayout = () => {
    writeStyle(host, "--atlas-globe-x", `${globeCenter[0].toFixed(2)}px`);
    writeStyle(host, "--atlas-globe-y", `${globeCenter[1].toFixed(2)}px`);
    writeStyle(host, "--atlas-globe-scale", `${scale.toFixed(2)}px`);
  };

  const syncBridgeGlobeLayout = (bounds: DOMRect) => {
    const bridgeRect = options.earthBridge?.getGlobeRect();
    if (!isUsableBridgeGlobeRect(bridgeRect)) {
      sharedEarthLayoutActive = false;
      return false;
    }

    const wasShared = sharedEarthLayoutActive;
    sharedEarthLayoutActive = true;
    globeCenter = [
      bridgeRect.left - bounds.left + bridgeRect.width / 2,
      bridgeRect.top - bounds.top + bridgeRect.height / 2,
    ];
    scale = Math.min(bridgeRect.width, bridgeRect.height) / 2;
    projection.translate(globeCenter).scale(scale);
    writeGlobeLayout();
    if (!wasShared) context.clearRect(0, 0, width, height);
    return true;
  };

  const resize = () => {
    // Collect layout before writing canvas dimensions or projected CSS variables.
    const bounds = host.getBoundingClientRect();
    const measuredCanvas = canvas.getBoundingClientRect();
    const heading = host
      .closest(".photography-atlas")
      ?.querySelector<HTMLElement>(".atlas-heading");
    const headingBounds = heading?.getBoundingClientRect();
    const measuredLabels = labelLinks.map((link) => ({
      slug: link.dataset.atlasCountry ?? "",
      bounds: link.getBoundingClientRect(),
    }));
    hostBounds = bounds;
    width = Math.max(320, bounds.width);
    height = Math.max(480, bounds.height);
    canvasBounds = DOMRect.fromRect({
      x: measuredCanvas.left,
      y: measuredCanvas.top,
      width,
      height,
    });
    renderRatio = atlasCanvasPixelRatio(window.devicePixelRatio || 1);
    const backingWidth = Math.round(width * renderRatio);
    const backingHeight = Math.round(height * renderRatio);
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    writeStyle(canvas, "width", `${width}px`);
    writeStyle(canvas, "height", `${height}px`);
    context.setTransform(renderRatio, 0, 0, renderRatio, 0, 0);
    writeData(host, "atlasRenderRatio", String(renderRatio));
    writeAttribute(overlay, "viewBox", `0 0 ${width} ${height}`);
    labelObstacles = headingBounds
      ? [
          {
            left: headingBounds.left - bounds.left - 12,
            right: headingBounds.right - bounds.left + 12,
            top: headingBounds.top - bounds.top - 12,
            bottom: headingBounds.bottom - bounds.top + 12,
          },
        ]
      : [];
    if (!syncBridgeGlobeLayout(bounds)) {
      const layout = placeGlobeAroundHeading(
        width,
        height,
        Math.min(width * 0.42, height * 0.45),
        headingBounds
          ? {
              left: headingBounds.left - bounds.left,
              right: headingBounds.right - bounds.left,
              top: headingBounds.top - bounds.top,
              bottom: headingBounds.bottom - bounds.top,
            }
          : null,
      );
      scale = layout.scale;
      globeCenter = [layout.centerX, layout.centerY];
      projection.translate(globeCenter).scale(scale);
      writeGlobeLayout();
    }
    labelMetrics.clear();
    for (const { slug, bounds: labelBounds } of measuredLabels)
      labelMetrics.set(slug, {
        width: labelBounds.width,
        height: labelBounds.height,
      });
    if (transitionFeature && transitionSlug)
      transitionTarget = createCountryMapProjection(
        transitionSlug,
        width,
        height,
        transitionFeature,
      );
    labelPlacements.clear();
  };

  const renderLabels = () => {
    const currentRotation = projection.rotate() as Rotation;
    const bridgeBounds = sharedEarthLayoutActive ? hostBounds : null;
    const visibleLabels: {
      id: string;
      anchorX: number;
      anchorY: number;
      width: number;
      height: number;
      side: -1 | 1;
      slot?: number;
    }[] = [];
    const projectedBySlug = new Map<string, [number, number]>();

    for (const link of labelLinks) {
      const slug = link.dataset.atlasCountry ?? "";
      const country = countryBySlug.get(slug);
      const leader = leaderBySlug.get(slug);
      if (!country) continue;
      const coordinate: [number, number] = [
        country.longitude,
        country.latitude,
      ];
      const bridgeAnchor = bridgeBounds
        ? options.earthBridge?.projectCoordinate(coordinate)
        : null;
      const projected = bridgeAnchor
        ? ([
            bridgeAnchor.clientX - bridgeBounds!.left,
            bridgeAnchor.clientY - bridgeBounds!.top,
          ] as [number, number])
        : projection(coordinate);
      const facing = bridgeAnchor
        ? bridgeAnchor.visible
          ? (bridgeAnchor.facing ?? 1)
          : 0
        : coordinateFacing(coordinate, [
            currentRotation[0],
            currentRotation[1],
          ]);
      const opacity = atlasAnchorOpacity(facing, projected, width, height);
      const previous = labelPlacements.get(slug);
      const labelVisible = opacity > 0;
      writeStyle(link, "--atlas-anchor-opacity", opacity.toFixed(3));
      if (leader)
        leader.style.setProperty("--atlas-anchor-opacity", opacity.toFixed(3));
      writeData(link, "visible", String(labelVisible));
      writeData(link, "active", String(slug === (focusedSlug ?? hoveredSlug)));
      if (leader) {
        writeData(leader, "visible", String(labelVisible));
        writeData(leader, "active", link.dataset.active ?? "false");
      }
      if (!labelVisible || !projected) {
        labelPlacements.delete(slug);
        continue;
      }

      const metrics = labelMetrics.get(slug);
      const labelWidth = metrics?.width ?? 44;
      const labelHeight = metrics?.height ?? 44;
      const projectedSide = projected[0] < globeCenter[0] ? -1 : 1;
      const side =
        previous && Math.abs(projected[0] - globeCenter[0]) < scale * 0.12
          ? previous.side
          : projectedSide;
      visibleLabels.push({
        id: slug,
        anchorX: projected[0],
        anchorY: projected[1],
        width: labelWidth,
        height: labelHeight,
        side,
        slot: previous?.slot,
      });
      projectedBySlug.set(slug, projected as [number, number]);
    }

    const placements = placeAtlasLabels(
      visibleLabels,
      width,
      height,
      {
        centerX: globeCenter[0],
        centerY: globeCenter[1],
        scale,
      },
      labelObstacles,
    );
    for (const placement of placements) {
      const link = labelBySlug.get(placement.id);
      const leader = leaderBySlug.get(placement.id);
      const projected = projectedBySlug.get(placement.id);
      if (!link || !projected) continue;
      const previous = labelPlacements.get(placement.id);
      const canSmooth =
        previous &&
        previous.side === placement.side &&
        previous.slot === placement.slot;
      const smoothing = canSmooth ? (pointerDown ? 0.28 : 0.16) : 1;
      const unclampedCenterX = previous
        ? previous.x + (placement.x - previous.x) * smoothing
        : placement.x;
      const unclampedCenterY = previous
        ? previous.y + (placement.y - previous.y) * smoothing
        : placement.y;
      const centerX = Math.max(
        8 + placement.width / 2,
        Math.min(width - 8 - placement.width / 2, unclampedCenterX),
      );
      const centerY = Math.max(
        8 + placement.height / 2,
        Math.min(height - 8 - placement.height / 2, unclampedCenterY),
      );
      labelPlacements.set(placement.id, {
        x: centerX,
        y: centerY,
        side: placement.side,
        slot: placement.slot,
      });
      writeStyle(link, "--atlas-label-x", `${centerX.toFixed(1)}px`);
      writeStyle(link, "--atlas-label-y", `${centerY.toFixed(1)}px`);
      if (!leader) continue;
      const points = atlasLabelLeaderPoints(projected, {
        ...placement,
        x: centerX,
        y: centerY,
      });
      writeAttribute(
        leader,
        "points",
        points
          .map(
            ([pointX, pointY]) => `${pointX.toFixed(1)},${pointY.toFixed(1)}`,
          )
          .join(" "),
      );
    }
  };

  const renderCityMarkers = () => {
    const currentRotation = projection.rotate() as Rotation;
    const bridgeBounds = sharedEarthLayoutActive ? hostBounds : null;
    for (const { link, country, city } of cityLinks) {
      const coordinate: [number, number] = [city.longitude, city.latitude];
      const bridgeAnchor = bridgeBounds
        ? options.earthBridge?.projectCoordinate(coordinate)
        : null;
      const projected = bridgeAnchor
        ? ([
            bridgeAnchor.clientX - bridgeBounds!.left,
            bridgeAnchor.clientY - bridgeBounds!.top,
          ] as [number, number])
        : projection(coordinate);
      const facing = bridgeAnchor
        ? bridgeAnchor.visible
          ? (bridgeAnchor.facing ?? 1)
          : 0
        : coordinateFacing(coordinate, [
            currentRotation[0],
            currentRotation[1],
          ]);
      const opacity = atlasAnchorOpacity(facing, projected, width, height);
      const visible = opacity > 0;
      writeStyle(link, "--atlas-anchor-opacity", opacity.toFixed(3));
      writeData(link, "visible", String(visible));
      writeData(
        link,
        "active",
        String(country.slug === (focusedSlug ?? hoveredSlug)),
      );
      if (!visible || !projected) continue;
      writeStyle(link, "--atlas-city-x", `${projected[0].toFixed(1)}px`);
      writeStyle(link, "--atlas-city-y", `${projected[1].toFixed(1)}px`);
    }
  };

  const renderHandoffShape = () => {
    if (transitionMorph < 0 || !transitionFeature || !transitionTarget) {
      handoffShape.dataset.visible = "false";
      return;
    }
    const progress = Math.max(0, Math.min(1, transitionMorph));
    const sourceProjection = projection;
    const targetProjection = transitionTarget;
    const bridgeBounds = sharedEarthLayoutActive ? hostBounds : null;
    const interpolatedProjection = geoTransform({
      point(longitude, latitude) {
        const target = targetProjection([longitude, latitude]);
        const bridgeAnchor = bridgeBounds
          ? options.earthBridge?.projectCoordinate([longitude, latitude])
          : null;
        const source = bridgeAnchor
          ? ([
              bridgeAnchor.clientX - bridgeBounds!.left,
              bridgeAnchor.clientY - bridgeBounds!.top,
            ] as [number, number])
          : (sourceProjection([longitude, latitude]) ?? target);
        if (!source || !target) return;
        const point = interpolatePoint(
          source as [number, number],
          target as [number, number],
          progress,
        );
        this.stream.point(point[0], point[1]);
      },
    });
    handoffShape.setAttribute(
      "d",
      geoPath(interpolatedProjection).digits(1)(transitionFeature) ?? "",
    );
    handoffShape.dataset.visible = "true";
  };

  const render = (allowInactive = false) => {
    if ((!active && !allowInactive) || destroyed) return;
    const preparing = allowInactive && !active;
    const activeCenter = globeCenter;
    const activeScale = scale * (1 + transitionZoom * 0.58);
    projection.rotate(rotation).translate(activeCenter).scale(activeScale);
    if (!preparing)
      options.earthBridge?.setRotation([rotation[0], rotation[1], rotation[2]]);
    if (!sharedEarthLayoutActive) {
      context.clearRect(0, 0, width, height);

      context.save();
      context.globalAlpha = 1 - transitionWorldFade;
      const atmosphere = context.createRadialGradient(
        activeCenter[0] - activeScale * 0.22,
        activeCenter[1] - activeScale * 0.25,
        activeScale * 0.1,
        activeCenter[0],
        activeCenter[1],
        activeScale * 1.18,
      );
      atmosphere.addColorStop(0, palette.atmosphereHighlight);
      atmosphere.addColorStop(0.78, palette.atmosphereMid);
      atmosphere.addColorStop(1, palette.atmosphereFade);
      context.beginPath();
      context.arc(
        activeCenter[0],
        activeCenter[1],
        activeScale * 1.12,
        0,
        Math.PI * 2,
      );
      context.fillStyle = atmosphere;
      context.fill();
      drawGeometry(context, projection, { type: "Sphere" });
      context.fillStyle = palette.oceanFill;
      context.fill();
      context.strokeStyle = palette.oceanStroke;
      context.lineWidth = 1;
      context.stroke();
      drawGeometry(context, projection, {
        type: "FeatureCollection",
        features: baseFeatures,
      });
      context.fillStyle = palette.landFill;
      context.fill();
      context.strokeStyle = palette.landStroke;
      context.lineWidth = 0.65;
      context.stroke();
      drawGeometry(context, projection, countryBoundaries);
      context.strokeStyle = palette.landStroke;
      context.lineWidth = 0.8;
      context.stroke();
      context.restore();

      for (const country of options.countries) {
        const countryFeature = featureBySlug.get(country.slug);
        if (!countryFeature) continue;
        const selected = country.slug === transitionSlug;
        const weight = selected ? 1 : (emphasisWeights.get(country.slug) ?? 0);
        context.save();
        if (spaceTransition || homeTransition) {
          context.globalAlpha = 1;
          projection.scale(activeScale + 3);
          drawGeometry(context, projection, countryFeature);
          context.fillStyle = palette.countryFill;
          context.fill();
          context.strokeStyle = palette.countryStroke;
          context.lineWidth = 1.2;
          context.stroke();
          context.restore();
          continue;
        }
        context.globalAlpha = transitionSlug
          ? selected
            ? 1 - Math.max(0, transitionMorph)
            : 1 - transitionWorldFade
          : 1;
        if (transitionSlug && !selected) {
          projection.scale(activeScale + 5);
          drawGeometry(context, projection, countryFeature);
          context.fillStyle = palette.countryFill;
          context.fill();
          context.restore();
          continue;
        }
        projection.scale(activeScale);
        drawGeometry(context, projection, countryFeature);
        context.fillStyle = palette.countryFill;
        context.fill();
        context.strokeStyle = palette.countryStroke;
        context.lineWidth = 1.1;
        context.stroke();
        if (weight > 0) {
          const eased = weight * weight * (3 - 2 * weight);
          context.globalAlpha *= eased;
          context.fillStyle = "rgba(206, 129, 78, 0.23)";
          context.fill();
          context.strokeStyle = "#efd4a1";
          context.lineWidth = 1.6;
          context.stroke();
        }
        context.restore();
      }
    }
    projection.scale(activeScale);
    const overlaysReady =
      active &&
      !preparing &&
      !spaceTransition &&
      !homeTransition &&
      !routeArrivalPending &&
      !routeArrival &&
      !transitionSlug;
    if (!preparing && !spaceTransition && !homeTransition) {
      if (!transitionSlug) {
        renderLabels();
        renderCityMarkers();
      }
      renderHandoffShape();
    }
    setOverlaysReady(overlaysReady);
  };

  const advanceFrame = (time: number, automaticMotion = true) => {
    const elapsed = Math.max(0, Math.min(100, time - lastTime));
    lastTime = time;
    if (canvasPointer && !pointerDown && !autoSpinPaused)
      setHover(countryAt(canvasPointer.x, canvasPointer.y)?.slug ?? null);
    for (const country of options.countries) {
      emphasisWeights.set(
        country.slug,
        advanceCountryEmphasis(
          emphasisWeights.get(country.slug) ?? 0,
          country.slug === (focusedSlug ?? hoveredSlug),
          elapsed,
          reducedMotion.matches,
        ),
      );
    }
    const spinDelta = spin.advance(
      time,
      elapsed,
      !automaticMotion ||
        reducedMotion.matches ||
        autoSpinPaused ||
        Boolean(transitionSlug) ||
        spaceTransition ||
        homeTransition ||
        routeArrivalPending ||
        Boolean(routeArrival),
    );
    writeData(host, "atlasSpinning", String(spinDelta !== 0));
    // Automatic longitude is independent of drag momentum.
    rotation[0] += spinDelta;
    if (
      !pointerDown &&
      !transitionSlug &&
      !spaceTransition &&
      !homeTransition
    ) {
      // Auto-spin shares the time-based drag momentum and renderer frame loop.
      const step = Math.max(0, elapsed / (1000 / 60));
      const momentumAllowed = !hoveredSlug && !focusedSlug && !autoSpinPaused;
      rotation[0] += momentumAllowed ? velocity.longitude * step : 0;
      rotation[1] = Math.max(
        -72,
        Math.min(
          72,
          rotation[1] + (momentumAllowed ? velocity.latitude * step : 0),
        ),
      );
      velocity.longitude *= Math.pow(0.94, step);
      velocity.latitude *= Math.pow(0.94, step);
      if (Math.abs(velocity.longitude) < 0.001) velocity.longitude = 0;
      if (Math.abs(velocity.latitude) < 0.001) velocity.latitude = 0;
    }
    if (!flightFrozen) {
      if (transitionMorph >= 0) renderHandoffShape();
      else render();
    }
  };

  const animate = (time: number) => {
    frame = null;
    if (destroyed || !active || !documentVisible) return;
    if (syncBridgeGlobeLayout(hostBounds)) return;
    const frameInterval = pointerDown ? 1_000 / 60 : 1_000 / 30;
    if (time - lastCanvasFrame < frameInterval - 0.8) {
      frame = requestAnimationFrame(animate);
      return;
    }
    advanceFrame(time);
    lastCanvasFrame = time;
    if (
      active &&
      documentVisible &&
      !sharedEarthLayoutActive &&
      (!reducedMotion.matches ||
        pointerDown ||
        velocity.longitude !== 0 ||
        velocity.latitude !== 0)
    )
      frame = requestAnimationFrame(animate);
  };

  const stopFrame = () => {
    if (frame === null) return;
    cancelAnimationFrame(frame);
    frame = null;
  };

  const startFrame = () => {
    if (
      destroyed ||
      !active ||
      !documentVisible ||
      sharedEarthLayoutActive ||
      frame !== null
    )
      return;
    lastTime = performance.now();
    frame = requestAnimationFrame(animate);
  };

  const runTween = (
    duration: number,
    update: (progress: number) => void,
    isCurrent: () => boolean = () => true,
  ) =>
    new Promise<boolean>((resolve) => {
      const started = performance.now();
      let tweenFrame = 0;
      const tick = (time: number) => {
        transitionFrames.delete(tweenFrame);
        if (destroyed || !isCurrent()) {
          resolve(false);
          return;
        }
        const raw = Math.min(1, (time - started) / duration);
        update(easeOutCubic(raw));
        if (raw >= 1) {
          resolve(true);
          return;
        }
        tweenFrame = requestAnimationFrame(tick);
        transitionFrames.add(tweenFrame);
      };
      tweenFrame = requestAnimationFrame(tick);
      transitionFrames.add(tweenFrame);
    });

  const getGlobeRect = (): AtlasGlobeRect | null => {
    const diameter = scale * 2.24;
    if (
      width <= 1 ||
      height <= 1 ||
      ![globeCenter[0], globeCenter[1], diameter].every(Number.isFinite) ||
      diameter <= 0
    )
      return null;
    return {
      x: globeCenter[0],
      y: globeCenter[1],
      width: diameter,
      height: diameter,
    };
  };

  const animateRouteArrival = () => {
    if (routeArrival) return routeArrival;
    if (!routeArrivalPending) return Promise.resolve();
    const generation = ++arrivalGeneration;
    const isCurrent = () =>
      !destroyed && active && generation === arrivalGeneration;
    setOverlaysReady(false);
    routeArrivalPending = false;
    const startLongitude = rotation[0];
    const startLatitude = rotation[1];
    const targetLongitude = shortestLongitudeTarget(
      startLongitude,
      TRAVEL_EARTH_ROTATION[0],
    );
    const duration = reducedMotion.matches ? 0 : 760;
    const finish = () => {
      if (!isCurrent()) return;
      routeArrival = null;
      rotation[0] = TRAVEL_EARTH_ROTATION[0];
      rotation[1] = TRAVEL_EARTH_ROTATION[1];
      rotation[2] = TRAVEL_EARTH_ROTATION[2];
      host.dataset.atlasRouteRotation = TRAVEL_EARTH_ROTATION.join(",");
      if (!flightFrozen) render();
    };
    if (duration === 0) {
      finish();
      return Promise.resolve();
    }
    routeArrival = runTween(
      duration,
      (progress) => {
        rotation[0] =
          startLongitude + (targetLongitude - startLongitude) * progress;
        rotation[1] =
          startLatitude + (TRAVEL_EARTH_ROTATION[1] - startLatitude) * progress;
      },
      isCurrent,
    ).then((completed) => {
      if (completed) finish();
    });
    return routeArrival;
  };

  const cancelBridgeCountryHandoff = () => {
    bridgeCountryHandoffPrepared = false;
    options.earthBridge?.cancelCountryHandoff();
  };

  const resetCountryTransition = () => {
    countryTransitionGeneration += 1;
    countryHandoffAbort?.abort();
    countryHandoffAbort = null;
    countryFadeAnimation?.cancel();
    countryFadeAnimation = null;
    cancelBridgeCountryHandoff();
    if (countryTransitionStartRotation) {
      rotation[0] = countryTransitionStartRotation[0];
      rotation[1] = countryTransitionStartRotation[1];
      rotation[2] = countryTransitionStartRotation[2];
      countryTransitionStartRotation = null;
    }
    transitionSlug = null;
    transitionZoom = 0;
    transitionWorldFade = 0;
    transitionMorph = -1;
    transitionFeature = null;
    transitionTarget = null;
    delete host.dataset.atlasTransitioning;
    delete host.dataset.atlasFallbackExit;
    host.removeAttribute("aria-busy");
    handoffShape.dataset.visible = "false";
    handoffShape.removeAttribute("d");
    canvas.style.removeProperty("opacity");
    options.earthBridge?.setCountryEmphasis(null);
    if (status) status.textContent = "Drag to turn the atlas";
  };

  const navigateToCountry = async (
    country: AtlasCountrySummary,
    cityId?: string,
  ) => {
    if (!active || transitionSlug || spaceTransition || homeTransition) return;
    const targetUrl = `/photography/${country.slug}${cityId ? `#city-${cityId}` : ""}`;
    if (reducedMotion.matches) {
      await navigateWithFallback(targetUrl);
      return;
    }
    prefetch(targetUrl);
    countryHandoffAbort?.abort();
    cancelBridgeCountryHandoff();
    const transitionAbort = new AbortController();
    countryHandoffAbort = transitionAbort;
    const generation = ++countryTransitionGeneration;
    countryTransitionStartRotation = [...rotation];
    transitionSlug = country.slug;
    transitionZoom = 0;
    transitionWorldFade = 0;
    transitionMorph = -1;
    transitionFeature = null;
    transitionTarget = null;
    const isCurrentCountryTransition = () =>
      !destroyed &&
      active &&
      !transitionAbort.signal.aborted &&
      countryHandoffAbort === transitionAbort &&
      countryTransitionGeneration === generation &&
      transitionSlug === country.slug;
    focusedSlug = country.slug;
    options.earthBridge?.setCountryEmphasis(country.slug);
    velocity = { longitude: 0, latitude: 0 };
    host.dataset.atlasTransitioning = "true";
    host.setAttribute("aria-busy", "true");
    if (status) status.textContent = `Opening ${country.name} travel map`;
    const supportsSharedTransition = CSS.supports(
      "view-transition-name: atlas-country-map",
    );
    if (!supportsSharedTransition) {
      host.dataset.atlasFallbackExit = "true";
      const completed = await runTween(
        160,
        () => undefined,
        isCurrentCountryTransition,
      );
      if (!completed || !isCurrentCountryTransition()) return;
      await navigateWithFallback(targetUrl);
      return;
    }

    const startLongitude = rotation[0];
    const startLatitude = rotation[1];
    const targetLongitude = shortestLongitudeTarget(
      startLongitude,
      -country.longitude,
    );
    const targetLatitude = Math.max(-72, Math.min(72, -country.latitude));
    const approachCompleted = await runTween(
      450,
      (progress) => {
        rotation[0] =
          startLongitude + (targetLongitude - startLongitude) * progress;
        rotation[1] =
          startLatitude + (targetLatitude - startLatitude) * progress;
        transitionZoom = progress;
        transitionWorldFade = progress * 0.74;
      },
      isCurrentCountryTransition,
    );
    if (!approachCompleted || !isCurrentCountryTransition()) return;

    transitionFeature = featureBySlug.get(country.slug) ?? null;
    if (!transitionFeature) {
      if (!isCurrentCountryTransition()) return;
      await navigateWithFallback(targetUrl);
      return;
    }
    transitionTarget = createCountryMapProjection(
      country.slug,
      width,
      height,
      transitionFeature,
    );
    if (sharedEarthLayoutActive && options.earthBridge) {
      cancelBridgeCountryHandoff();
      options.earthBridge.setCountryFeatures(bridgeCountryFeatures);
      options.earthBridge.setCountryEmphasis(country.slug);
      try {
        bridgeCountryHandoffPrepared =
          await options.earthBridge.prepareCountryHandoff(
            [country.longitude, country.latitude],
            transitionAbort.signal,
          );
      } catch {
        bridgeCountryHandoffPrepared = false;
      }
      if (!isCurrentCountryTransition()) return;
      if (!bridgeCountryHandoffPrepared) {
        options.earthBridge.cancelCountryHandoff();
        options.earthBridge.setCountryFeatures(bridgeCountryFeatures);
        options.earthBridge.setCountryEmphasis(country.slug);
      }
    }
    if (!isCurrentCountryTransition()) return;
    transitionMorph = 0;
    if (bridgeCountryHandoffPrepared)
      options.earthBridge?.setCountryHandoffProgress(0);
    render();
    const canvasFade = canvas.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: COUNTRY_MORPH_DURATION,
      easing: "cubic-bezier(.16, 1, .3, 1)",
      fill: "forwards",
    });
    countryFadeAnimation = canvasFade;
    const [morphCompleted] = await Promise.all([
      runTween(
        COUNTRY_MORPH_DURATION,
        (progress) => {
          transitionMorph = progress;
          if (bridgeCountryHandoffPrepared)
            options.earthBridge?.setCountryHandoffProgress(progress);
        },
        isCurrentCountryTransition,
      ),
      canvasFade.finished.catch(() => undefined),
    ]);
    if (!morphCompleted || !isCurrentCountryTransition()) return;
    transitionWorldFade = 1;
    await navigateWithFallback(targetUrl);
  };

  const selectCountry = (
    country: AtlasCountrySummary,
    trigger?: HTMLElement,
  ) => {
    if (!active || transitionSlug || spaceTransition || homeTransition) return;
    if (options.onSelectCountry) {
      velocity = { longitude: 0, latitude: 0 };
      setHover(country.slug);
      options.onSelectCountry(
        country,
        trigger ?? labelBySlug.get(country.slug),
      );
      return;
    }
    void navigateToCountry(country);
  };

  const captureGlobe = () => {
    if (!active) return null;
    render();
    const layer = document.querySelector<HTMLElement>(
      "[data-cosmic-flight-layer]",
    );
    const flightCanvas = layer?.querySelector<HTMLCanvasElement>(
      "[data-cosmic-flight-canvas]",
    );
    const flightContext = flightCanvas?.getContext("2d");
    if (!layer || !flightCanvas || !flightContext) return null;
    const cropSize = Math.min(
      Math.max(scale * 2.42, 280),
      Math.max(width, height) * 1.12,
    );
    const ratio = renderRatio;
    const sourceX = Math.max(0, globeCenter[0] - cropSize / 2);
    const sourceY = Math.max(0, globeCenter[1] - cropSize / 2);
    const sourceWidth = Math.min(cropSize, width - sourceX);
    const sourceHeight = Math.min(cropSize, height - sourceY);
    flightCanvas.width = Math.max(1, Math.round(sourceWidth * ratio));
    flightCanvas.height = Math.max(1, Math.round(sourceHeight * ratio));
    flightContext.clearRect(0, 0, flightCanvas.width, flightCanvas.height);
    flightContext.drawImage(
      canvas,
      sourceX * ratio,
      sourceY * ratio,
      sourceWidth * ratio,
      sourceHeight * ratio,
      0,
      0,
      flightCanvas.width,
      flightCanvas.height,
    );
    layer.style.left = `${sourceX + sourceWidth / 2}px`;
    layer.style.top = `${sourceY + sourceHeight / 2}px`;
    layer.style.width = `${sourceWidth}px`;
    layer.style.height = `${sourceHeight}px`;
    layer.style.transform = "translate(-50%, -50%)";
    layer.dataset.visible = "true";
    layer.dataset.flightOpacity = "1";
    canvas.style.opacity = "0";
    flightFrozen = true;
    return { layer, size: Math.max(sourceWidth, sourceHeight) };
  };

  const prepareRouteHandoff = async (destination: "home" | "projects") => {
    if (!active || transitionSlug || spaceTransition || homeTransition)
      return false;
    spaceTransition = destination === "projects";
    homeTransition = destination === "home";
    const generation = ++handoffGeneration;
    const isCurrentHandoff = () =>
      !destroyed &&
      generation === handoffGeneration &&
      (destination === "projects" ? spaceTransition : homeTransition);
    focusedSlug = null;
    velocity = { longitude: 0, latitude: 0 };
    setHover(null);
    host.dataset.atlasRouteTransitioning = "true";
    host.dataset.atlasFlightPhase = "approach";
    if (spaceTransition) {
      host.dataset.atlasSpaceTransitioning = "true";
      if (atlasShell) atlasShell.dataset.atlasSpaceTransitioning = "true";
    } else {
      host.dataset.atlasHomeTransitioning = "true";
      if (atlasShell) atlasShell.dataset.atlasHomeTransitioning = "true";
    }
    host.setAttribute("aria-busy", "true");
    if (status) {
      status.textContent =
        destination === "projects"
          ? "Leaving orbit for the project field"
          : "Returning to the orbital observatory";
    }

    const startLongitude = rotation[0];
    const startLatitude = rotation[1];
    const targetLongitude =
      destination === "projects"
        ? startLongitude + 34
        : shortestLongitudeTarget(startLongitude, HOME_EARTH_ROTATION[0]);
    const targetLatitude =
      destination === "projects" ? startLatitude + 8 : HOME_EARTH_ROTATION[1];
    const completed = await runTween(
      destination === "projects" ? 360 : 640,
      (progress) => {
        rotation[0] =
          startLongitude + (targetLongitude - startLongitude) * progress;
        rotation[1] =
          startLatitude + (targetLatitude - startLatitude) * progress;
      },
      isCurrentHandoff,
    );
    if (!completed || !isCurrentHandoff()) return false;
    if (destination === "home") {
      rotation[0] = HOME_EARTH_ROTATION[0];
      rotation[1] = HOME_EARTH_ROTATION[1];
      rotation[2] = HOME_EARTH_ROTATION[2];
    }
    const snapshot = captureGlobe();
    if (!snapshot) {
      spaceTransition = false;
      homeTransition = false;
      delete host.dataset.atlasRouteTransitioning;
      delete host.dataset.atlasFlightPhase;
      delete host.dataset.atlasSpaceTransitioning;
      delete host.dataset.atlasHomeTransitioning;
      atlasShell?.removeAttribute("data-atlas-space-transitioning");
      atlasShell?.removeAttribute("data-atlas-home-transitioning");
      host.removeAttribute("aria-busy");
      return false;
    }
    snapshot.layer.dataset.flightRotation = rotation.join(",");
    host.dataset.atlasFlightPhase = "captured";
    snapshot.layer.dataset.flightPhase = "captured";
    return true;
  };

  const countryAt = (clientX: number, clientY: number) => {
    if (!active) return null;
    const earthBridge = options.earthBridge;
    const useSharedEarth = Boolean(
      sharedEarthLayoutActive &&
      earthBridge &&
      isUsableBridgeGlobeRect(earthBridge.getGlobeRect()),
    );
    if (sharedEarthLayoutActive && !useSharedEarth) {
      sharedEarthLayoutActive = false;
      startFrame();
    }
    const coordinate = useSharedEarth
      ? earthBridge!.pickCoordinate(clientX, clientY)
      : (() => {
          const bounds = canvasBounds;
          return projection.invert?.([
            clientX - bounds.left,
            clientY - bounds.top,
          ]);
        })();
    if (!coordinate) return null;
    const geoCoordinate: [number, number] = [coordinate[0], coordinate[1]];
    const match = countryHitTargets.find(({ countryFeature }) =>
      geoContains(countryFeature, geoCoordinate),
    );
    return match?.country ?? null;
  };

  const releasePointer = () => {
    if (pointerId >= 0 && canvas.hasPointerCapture(pointerId))
      canvas.releasePointerCapture(pointerId);
    pointerDown = false;
    pointerMoved = false;
    pointerId = -1;
    canvas.dataset.dragging = "false";
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!active || transitionSlug || spaceTransition || homeTransition) return;
    canvasPointer = null;
    setHover(null);
    pointerDown = true;
    pointerMoved = false;
    pointerId = event.pointerId;
    previousPointer = { x: event.clientX, y: event.clientY };
    velocity = { longitude: 0, latitude: 0 };
    canvas.setPointerCapture(pointerId);
    canvas.dataset.dragging = "true";
    startFrame();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!active || transitionSlug || spaceTransition || homeTransition) return;
    if (!pointerDown) {
      canvasPointer = { x: event.clientX, y: event.clientY };
      startFrame();
      return;
    }
    const dx = event.clientX - previousPointer.x;
    const dy = event.clientY - previousPointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) pointerMoved = true;
    velocity = {
      longitude: dx * 0.08,
      latitude: -dy * 0.08,
    };
    rotation[0] += velocity.longitude;
    rotation[1] = Math.max(-72, Math.min(72, rotation[1] + velocity.latitude));
    previousPointer = { x: event.clientX, y: event.clientY };
    options.earthBridge?.setRotation(rotation);
    startFrame();
  };
  const onPointerUp = (event: PointerEvent) => {
    if (
      !active ||
      event.pointerId !== pointerId ||
      transitionSlug ||
      spaceTransition ||
      homeTransition
    )
      return;
    const wasMoved = pointerMoved;
    releasePointer();
    startFrame();
    if (!wasMoved) {
      const country = countryAt(event.clientX, event.clientY);
      if (country) selectCountry(country);
    }
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId === pointerId) {
      releasePointer();
      startFrame();
    }
  };
  const onPointerLeave = () => {
    canvasPointer = null;
    if (active && !pointerDown) setHover(null);
  };

  const labelCleanups = labelLinks.map((link) => {
    const slug = link.dataset.atlasCountry ?? "";
    const enter = () => {
      if (active) setHover(slug);
    };
    const leave = () => {
      if (active && !link.matches(":focus")) setHover(null);
    };
    const focus = () => {
      if (!active) return;
      focusedSlug = slug;
      const country = countryBySlug.get(slug);
      if (country && link.dataset.visible !== "true") {
        rotation[0] = shortestLongitudeTarget(rotation[0], -country.longitude);
        rotation[1] = Math.max(-72, Math.min(72, -country.latitude));
        velocity = { longitude: 0, latitude: 0 };
        render();
      }
      setHover(slug);
    };
    const blur = () => {
      if (!active) return;
      focusedSlug = null;
      setHover(null);
    };
    const click = (event: MouseEvent) => {
      if (!active || !isPlainActivation(event)) return;
      const country = countryBySlug.get(slug);
      if (!country) return;
      event.preventDefault();
      selectCountry(country, link);
    };
    link.addEventListener("pointerenter", enter);
    link.addEventListener("pointerleave", leave);
    link.addEventListener("focus", focus);
    link.addEventListener("blur", blur);
    link.addEventListener("click", click);
    return () => {
      link.removeEventListener("pointerenter", enter);
      link.removeEventListener("pointerleave", leave);
      link.removeEventListener("focus", focus);
      link.removeEventListener("blur", blur);
      link.removeEventListener("click", click);
    };
  });

  const cityCleanups = cityLinks.map(({ link, country, city }) => {
    const enter = () => {
      if (active) setHover(country.slug);
    };
    const leave = () => {
      if (active && !link.matches(":focus")) setHover(null);
    };
    const focus = () => {
      if (!active) return;
      focusedSlug = country.slug;
      if (link.dataset.visible !== "true") {
        rotation[0] = shortestLongitudeTarget(rotation[0], -city.longitude);
        rotation[1] = Math.max(-72, Math.min(72, -city.latitude));
        velocity = { longitude: 0, latitude: 0 };
        render();
      }
      setHover(country.slug);
    };
    const blur = () => {
      if (!active) return;
      focusedSlug = null;
      setHover(null);
    };
    const click = (event: MouseEvent) => {
      if (!active || !isPlainActivation(event)) return;
      if (options.onSelectCountry) return;
      event.preventDefault();
      void navigateToCountry(country, city.id);
    };
    link.addEventListener("pointerenter", enter);
    link.addEventListener("pointerleave", leave);
    link.addEventListener("focus", focus);
    link.addEventListener("blur", blur);
    link.addEventListener("click", click);
    return () => {
      link.removeEventListener("pointerenter", enter);
      link.removeEventListener("pointerleave", leave);
      link.removeEventListener("focus", focus);
      link.removeEventListener("blur", blur);
      link.removeEventListener("click", click);
    };
  });

  const onViewportChange = () => {
    if (destroyed || !active) return;
    palette = readAtlasPalette(host);
    resize();
    if (!flightFrozen) render();
  };
  const observer = new ResizeObserver(onViewportChange);
  const onMotionPreference = () => {
    if (destroyed || !active) return;
    if (reducedMotion.matches) velocity = { longitude: 0, latitude: 0 };
    if (!flightFrozen) render();
    startFrame();
  };
  const onVisibility = () => {
    documentVisible = !document.hidden;
    lastTime = performance.now();
    if (documentVisible) {
      onViewportChange();
      startFrame();
    } else {
      stopFrame();
      releasePointer();
    }
  };
  const disconnectEarthFrame = () => {
    unsubscribeEarthFrame?.();
    unsubscribeEarthFrame = null;
  };
  const connectEarthFrame = () => {
    if (!options.earthBridge || unsubscribeEarthFrame) return;
    unsubscribeEarthFrame = options.earthBridge.subscribeFrame(
      (time, _delta, automaticMotion) => {
        if (destroyed || !active || !documentVisible) return;
        if (!syncBridgeGlobeLayout(hostBounds)) {
          startFrame();
          return;
        }
        stopFrame();
        advanceFrame(time, automaticMotion);
      },
    );
  };
  const resetRouteHandoff = () => {
    handoffGeneration += 1;
    if (!spaceTransition && !homeTransition && !flightFrozen) return;
    const shouldRestoreTravelPose = spaceTransition || homeTransition;
    spaceTransition = false;
    homeTransition = false;
    flightFrozen = false;
    delete host.dataset.atlasRouteTransitioning;
    delete host.dataset.atlasFlightPhase;
    delete host.dataset.atlasSpaceTransitioning;
    delete host.dataset.atlasHomeTransitioning;
    atlasShell?.removeAttribute("data-atlas-space-transitioning");
    atlasShell?.removeAttribute("data-atlas-home-transitioning");
    host.removeAttribute("aria-busy");
    canvas.style.removeProperty("opacity");
    const flightLayer = document.querySelector<HTMLElement>(
      "[data-cosmic-flight-layer]",
    );
    if (flightLayer) {
      delete flightLayer.dataset.visible;
      delete flightLayer.dataset.flightOpacity;
      delete flightLayer.dataset.flightPhase;
      delete flightLayer.dataset.flightRotation;
      flightLayer.removeAttribute("style");
    }
    if (shouldRestoreTravelPose) {
      routeArrivalPending = true;
      routeArrival = null;
    }
  };
  const setActive = (nextActive: boolean) => {
    if (destroyed) return;
    setOverlaysReady(false);
    if (!nextActive) {
      arrivalGeneration += 1;
      routeArrival = null;
    }
    lastTime = performance.now();
    canvasPointer = null;
    if (nextActive) {
      options.earthBridge?.setCountryFeatures(bridgeCountryFeatures);
      options.earthBridge?.setRotation([rotation[0], rotation[1], rotation[2]]);
    } else {
      resetCountryTransition();
    }
    options.earthBridge?.setInteractionEnabled(nextActive);
    resetRouteHandoff();
    if (active === nextActive) {
      if (active) {
        resize();
        if (!flightFrozen) render();
        connectEarthFrame();
        startFrame();
      } else {
        disconnectEarthFrame();
      }
      return;
    }
    active = nextActive;
    host.dataset.atlasActive = String(active);
    if (!active) {
      host.dataset.atlasSpinning = "false";
      disconnectEarthFrame();
      stopFrame();
      observer.disconnect();
      releasePointer();
      focusedSlug = null;
      velocity = { longitude: 0, latitude: 0 };
      setHover(null);
      return;
    }

    palette = readAtlasPalette(host);
    observer.observe(host);
    resize();
    connectEarthFrame();
    if (!flightFrozen) render();
    if (status && !hoveredSlug) status.textContent = "Drag to turn the atlas";
    startFrame();
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", onViewportChange);
  window.visualViewport?.addEventListener("resize", onViewportChange);
  window.visualViewport?.addEventListener("scroll", onViewportChange);
  reducedMotion.addEventListener("change", onMotionPreference);
  void document.fonts.ready.then(() => onViewportChange());
  options.earthBridge?.setCountryFeatures(bridgeCountryFeatures);
  options.earthBridge?.setCountryEmphasis(null);
  if (active)
    options.earthBridge?.setRotation([rotation[0], rotation[1], rotation[2]]);
  options.earthBridge?.setInteractionEnabled(active);
  resize();
  host.dataset.atlasActive = String(active);
  host.dataset.atlasReady = "true";
  if (status) status.textContent = "Drag to turn the atlas";
  if (active) {
    observer.observe(host);
    connectEarthFrame();
    render();
    startFrame();
  } else {
    render(true);
    host.dataset.atlasPrepared = "true";
  }

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    setOverlaysReady(false);
    disconnectEarthFrame();
    resetCountryTransition();
    options.earthBridge?.setCountryEmphasis(null);
    options.earthBridge?.setInteractionEnabled(false);
    options.earthBridge?.setCountryFeatures([]);
    stopFrame();
    transitionFrames.forEach((transitionFrame) =>
      cancelAnimationFrame(transitionFrame),
    );
    observer.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onViewportChange);
    window.visualViewport?.removeEventListener("resize", onViewportChange);
    window.visualViewport?.removeEventListener("scroll", onViewportChange);
    reducedMotion.removeEventListener("change", onMotionPreference);
    labelCleanups.forEach((cleanup) => cleanup());
    cityCleanups.forEach((cleanup) => cleanup());
    releasePointer();
    if (!flightFrozen) canvas.style.removeProperty("opacity");
  };

  return {
    animateRouteArrival,
    destroy,
    getGlobeRect,
    prepareRouteHandoff,
    setActive,
    setAutoSpinPaused(paused) {
      autoSpinPaused = paused;
      canvasPointer = null;
      if (!paused) setHover(null);
      startFrame();
    },
  };
}
