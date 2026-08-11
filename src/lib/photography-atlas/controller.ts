import {
  geoAlbersUsa,
  geoContains,
  geoMercator,
  geoOrthographic,
  geoPath,
  geoTransform,
  type GeoPermissibleObjects,
  type GeoProjection,
} from "d3-geo";
import { feature } from "topojson-client";
import { prefetch } from "astro:prefetch";
import { navigate } from "astro:transitions/client";
import countries110m from "world-atlas/countries-110m.json";
import {
  HOME_EARTH_ROTATION,
  TRAVEL_EARTH_ROTATION,
} from "@/lib/cosmic-transitions/earth";
import {
  isCoordinateVisible,
  placeGlobeAroundHeading,
  shortestLongitudeTarget,
  type AtlasCountrySummary,
} from "./data";
import { easeOutCubic, interpolatePoint } from "./transition";

type AtlasFeature = GeoJSON.Feature<GeoJSON.Geometry, { name?: string }>;
type AtlasCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { name?: string }
>;

type AtlasOptions = {
  countries: AtlasCountrySummary[];
  hongKong: AtlasFeature;
};

export interface PhotographyAtlasController {
  animateRouteArrival(): Promise<void>;
  destroy(): void;
  getGlobeRect(): AtlasGlobeRect | null;
  prepareRouteHandoff(destination: "home" | "projects"): Promise<boolean>;
}

export type AtlasGlobeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Rotation = [number, number, number];

const MAX_CANVAS_PIXEL_RATIO = 1.5;
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
  try {
    await navigate(targetUrl);
  } catch (error) {
    window.location.assign(targetUrl);
    throw error;
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
  const cosmicBackdrop = document.querySelector<HTMLElement>(
    "[data-cosmic-backdrop]",
  );
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
  const labelLinks = [
    ...host.querySelectorAll<HTMLAnchorElement>("[data-atlas-country]"),
  ];
  const previewCards = new Map(
    [...host.querySelectorAll<HTMLElement>("[data-atlas-preview-card]")].map(
      (card) => [card.dataset.atlasPreviewCard ?? "", card],
    ),
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
  const arrivingFromRoute =
    cosmicBackdrop?.dataset.transitionTarget === "travel";
  const rotation: Rotation = arrivingFromRoute
    ? [...HOME_EARTH_ROTATION]
    : [...TRAVEL_EARTH_ROTATION];
  if (!arrivingFromRoute)
    host.dataset.atlasRouteRotation = TRAVEL_EARTH_ROTATION.join(",");
  let width = 1;
  let height = 1;
  let scale = 1;
  let renderRatio = 1;
  let globeCenter: [number, number] = [0.5, 0.5];
  let frame = 0;
  let lastTime = performance.now();
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
  let routeArrivalPending = arrivingFromRoute;
  let routeArrival: Promise<void> | null = null;
  let flightFrozen = false;
  let destroyed = false;
  const transitionFrames = new Set<number>();
  const labelPlacements = new Map<
    string,
    { x: number; y: number; slot: number; hiddenFrames: number }
  >();
  const labelMetrics = new Map<string, { width: number; height: number }>();
  let labelObstacle: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null = null;
  const labelPreferences: Record<string, { side: -1 | 1; lane: number }> = {
    china: { side: -1, lane: 0 },
    "hong-kong": { side: -1, lane: 1 },
    taiwan: { side: 1, lane: 0 },
    thailand: { side: -1, lane: 0 },
  };

  const setHover = (slug: string | null) => {
    if (hoveredSlug === slug) return;
    hoveredSlug = slug;
    host.dataset.hoverCountry = slug ?? "";
    const country = slug ? countryBySlug.get(slug) : undefined;
    for (const [cardSlug, card] of previewCards) {
      const active = cardSlug === slug;
      card.dataset.active = String(active);
      card.setAttribute("aria-hidden", String(!active));
      if (active) {
        card
          .querySelectorAll<HTMLImageElement>("[data-atlas-preview-src]")
          .forEach((image) => {
            if (image.dataset.atlasPreviewLoaded === "true") return;
            image.src = image.dataset.atlasPreviewSrc ?? image.src;
            image.dataset.atlasPreviewLoaded = "true";
          });
      }
    }
    if (status)
      status.textContent = country
        ? `${country.name}, ${country.count} photographs`
        : "Drag to turn the atlas";
  };

  const resize = () => {
    const bounds = host.getBoundingClientRect();
    width = Math.max(320, bounds.width);
    height = Math.max(480, bounds.height);
    renderRatio = Math.min(
      MAX_CANVAS_PIXEL_RATIO,
      window.devicePixelRatio || 1,
    );
    canvas.width = Math.round(width * renderRatio);
    canvas.height = Math.round(height * renderRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(renderRatio, 0, 0, renderRatio, 0, 0);
    host.dataset.atlasRenderRatio = String(renderRatio);
    overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const heading = host
      .closest(".photography-atlas")
      ?.querySelector<HTMLElement>(".atlas-heading");
    const headingBounds = heading?.getBoundingClientRect();
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
    host.style.setProperty("--atlas-globe-x", `${globeCenter[0]}px`);
    host.style.setProperty("--atlas-globe-y", `${globeCenter[1]}px`);
    host.style.setProperty("--atlas-globe-scale", `${scale}px`);
    labelObstacle = headingBounds
      ? {
          left: headingBounds.left - bounds.left - 12,
          right: headingBounds.right - bounds.left + 12,
          top: headingBounds.top - bounds.top - 12,
          bottom: headingBounds.bottom - bounds.top + 12,
        }
      : null;
    labelMetrics.clear();
    for (const link of labelLinks) {
      const labelBounds = link.getBoundingClientRect();
      labelMetrics.set(link.dataset.atlasCountry ?? "", {
        width: labelBounds.width,
        height: labelBounds.height,
      });
    }
    if (transitionFeature && transitionSlug)
      transitionTarget = createCountryMapProjection(
        transitionSlug,
        width,
        height,
        transitionFeature,
      );
  };

  const renderLabels = () => {
    const currentRotation = projection.rotate() as Rotation;
    const placed: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }[] = labelObstacle ? [labelObstacle] : [];
    const overlaps = (candidate: (typeof placed)[number]) =>
      placed.some(
        (item) =>
          candidate.left < item.right + 8 &&
          candidate.right > item.left - 8 &&
          candidate.top < item.bottom + 8 &&
          candidate.bottom > item.top - 8,
      );

    for (const link of labelLinks) {
      const slug = link.dataset.atlasCountry ?? "";
      const country = countryBySlug.get(slug);
      const leader = leaderBySlug.get(slug);
      if (!country) continue;
      const projected = projection([country.longitude, country.latitude]);
      const rawVisible = isCoordinateVisible(
        [country.longitude, country.latitude],
        [currentRotation[0], currentRotation[1]],
      );
      const previous = labelPlacements.get(slug);
      const hiddenFrames = rawVisible ? 0 : (previous?.hiddenFrames ?? 0) + 1;
      const labelVisible =
        Boolean(projected) &&
        (rawVisible || (Boolean(previous) && hiddenFrames < 8));
      link.dataset.visible = String(labelVisible);
      link.dataset.active = String(
        slug === hoveredSlug || slug === focusedSlug,
      );
      if (leader) {
        leader.dataset.visible = String(labelVisible);
        leader.dataset.active = link.dataset.active;
      }
      if (!labelVisible || !projected) {
        if (previous) labelPlacements.set(slug, { ...previous, hiddenFrames });
        continue;
      }

      const metrics = labelMetrics.get(slug);
      const labelWidth = metrics?.width ?? 44;
      const labelHeight = metrics?.height ?? 44;
      const rise = Math.min(84, Math.max(44, scale * 0.12));
      const horizontal = labelWidth / 2 + Math.max(24, scale * 0.075);
      const preference = labelPreferences[slug];
      const preferredSide =
        preference?.side ?? (country.longitude >= 0 ? 1 : -1);
      const directions: (-1 | 1)[] = [
        preferredSide,
        preferredSide === 1 ? -1 : 1,
      ];
      const lane = preference?.lane ?? 0;
      const candidates = [1, 1.55, 2.1].flatMap((level) =>
        directions.map((direction) => [
          projected[0] + direction * horizontal,
          projected[1] - rise * (level + lane * 0.5),
        ]),
      );
      const orderedCandidates = previous
        ? [
            candidates[previous.slot],
            ...candidates.filter((_, index) => index !== previous.slot),
          ].filter(Boolean)
        : candidates;
      const target = orderedCandidates.find(([centerX, centerY]) => {
        const candidate = {
          left: centerX - labelWidth / 2,
          right: centerX + labelWidth / 2,
          top: centerY - labelHeight / 2,
          bottom: centerY + labelHeight / 2,
        };
        return (
          candidate.left >= 8 &&
          candidate.right <= width - 8 &&
          candidate.top >= 8 &&
          candidate.bottom <= height - 8 &&
          !overlaps(candidate)
        );
      }) ?? [
        projected[0] + preferredSide * horizontal,
        projected[1] - rise * (1 + lane * 0.5),
      ];
      const targetSlot = candidates.findIndex(
        ([x, y]) => x === target[0] && y === target[1],
      );
      const smoothing = previous ? (pointerDown ? 0.28 : 0.16) : 1;
      const centerX = previous
        ? previous.x + (target[0] - previous.x) * smoothing
        : target[0];
      const centerY = previous
        ? previous.y + (target[1] - previous.y) * smoothing
        : target[1];
      labelPlacements.set(slug, {
        x: centerX,
        y: centerY,
        slot: targetSlot >= 0 ? targetSlot : (previous?.slot ?? 0),
        hiddenFrames,
      });
      placed.push({
        left: centerX - labelWidth / 2,
        right: centerX + labelWidth / 2,
        top: centerY - labelHeight / 2,
        bottom: centerY + labelHeight / 2,
      });
      link.style.setProperty("--atlas-label-x", `${centerX.toFixed(1)}px`);
      link.style.setProperty("--atlas-label-y", `${centerY.toFixed(1)}px`);
      if (leader) {
        const direction = centerX >= projected[0] ? 1 : -1;
        const endX = centerX - direction * (labelWidth / 2 - 5);
        const endY = centerY + labelHeight * 0.23;
        const bendX = endX - direction * 18;
        leader.setAttribute(
          "points",
          `${projected[0].toFixed(1)},${projected[1].toFixed(1)} ${bendX.toFixed(1)},${endY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`,
        );
      }
    }
  };

  const renderCityMarkers = () => {
    const currentRotation = projection.rotate() as Rotation;
    for (const { link, country, city } of cityLinks) {
      const projected = projection([city.longitude, city.latitude]);
      const visible =
        Boolean(projected) &&
        isCoordinateVisible(
          [city.longitude, city.latitude],
          [currentRotation[0], currentRotation[1]],
        );
      link.dataset.visible = String(visible);
      link.dataset.active = String(
        country.slug === hoveredSlug || country.slug === focusedSlug,
      );
      if (!visible || !projected) continue;
      link.style.setProperty("--atlas-city-x", `${projected[0].toFixed(1)}px`);
      link.style.setProperty("--atlas-city-y", `${projected[1].toFixed(1)}px`);
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
    const interpolatedProjection = geoTransform({
      point(longitude, latitude) {
        const target = targetProjection([longitude, latitude]);
        const source = sourceProjection([longitude, latitude]) ?? target;
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

  const render = () => {
    const activeCenter = globeCenter;
    const activeScale = scale * (1 + transitionZoom * 0.58);
    projection.rotate(rotation).translate(activeCenter).scale(activeScale);
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
    atmosphere.addColorStop(0, "rgba(66, 88, 80, .3)");
    atmosphere.addColorStop(0.78, "rgba(17, 24, 22, .62)");
    atmosphere.addColorStop(1, "rgba(255, 90, 54, 0)");
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
    context.fillStyle = "#111713";
    context.fill();
    context.strokeStyle = "rgba(233, 239, 222, .24)";
    context.lineWidth = 1;
    context.stroke();
    drawGeometry(context, projection, {
      type: "FeatureCollection",
      features: baseFeatures,
    });
    context.fillStyle = "#252d27";
    context.fill();
    context.strokeStyle = "rgba(230, 236, 220, .17)";
    context.lineWidth = 0.65;
    context.stroke();
    context.restore();

    for (const country of options.countries) {
      const countryFeature = featureBySlug.get(country.slug);
      if (!countryFeature) continue;
      const selected = country.slug === transitionSlug;
      const active =
        country.slug === hoveredSlug ||
        country.slug === focusedSlug ||
        selected;
      context.save();
      if (spaceTransition || homeTransition) {
        context.globalAlpha = 1;
        projection.scale(activeScale + 3);
        drawGeometry(context, projection, countryFeature);
        context.fillStyle = "#ff6744";
        context.fill();
        context.strokeStyle = "#ffd0ad";
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
        context.fillStyle = "#ef5b39";
        context.fill();
        context.restore();
        continue;
      }
      const extrusionDepths = transitionSlug ? [4, 8] : [2, 4, 6, 8];
      for (const depth of extrusionDepths) {
        projection.scale(activeScale + depth);
        drawGeometry(context, projection, countryFeature);
        context.fillStyle = depth === 8 ? "#ef5b39" : "#67281e";
        context.fill();
      }
      projection.scale(activeScale + 9);
      if (active) {
        context.save();
        context.shadowColor = "rgba(255, 190, 92, .95)";
        context.shadowBlur = 30;
        context.lineWidth = 8;
        context.strokeStyle = "rgba(255, 104, 64, .62)";
        drawGeometry(context, projection, countryFeature);
        context.stroke();
        context.restore();
      }
      drawGeometry(context, projection, countryFeature);
      context.fillStyle = active ? "#ffad62" : "#ff6744";
      context.fill();
      context.strokeStyle = active ? "#fff4c7" : "#ffd0ad";
      context.lineWidth = active ? 2.4 : 1.25;
      context.stroke();
      context.restore();
    }
    projection.scale(activeScale);
    if (!spaceTransition && !homeTransition) {
      if (!transitionSlug) {
        renderLabels();
        renderCityMarkers();
      }
      renderHandoffShape();
    }
  };

  const animate = (time: number) => {
    const elapsed = Math.min(40, time - lastTime);
    lastTime = time;
    if (
      documentVisible &&
      !pointerDown &&
      !transitionSlug &&
      !spaceTransition &&
      !homeTransition &&
      !cosmicBackdrop?.dataset.transitionTarget
    ) {
      if (!reducedMotion.matches && !focusedSlug)
        rotation[0] = (rotation[0] + elapsed * 0.0028) % 360;
      rotation[0] += velocity.longitude;
      rotation[1] = Math.max(
        -72,
        Math.min(72, rotation[1] + velocity.latitude),
      );
      velocity.longitude *= 0.94;
      velocity.latitude *= 0.94;
    }
    if (!flightFrozen) {
      if (transitionMorph >= 0) renderHandoffShape();
      else render();
    }
    frame = requestAnimationFrame(animate);
  };

  const runTween = (duration: number, update: (progress: number) => void) =>
    new Promise<void>((resolve) => {
      const started = performance.now();
      let tweenFrame = 0;
      const tick = (time: number) => {
        transitionFrames.delete(tweenFrame);
        if (destroyed) {
          resolve();
          return;
        }
        const raw = Math.min(1, (time - started) / duration);
        update(easeOutCubic(raw));
        if (raw >= 1) {
          resolve();
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
    if (!routeArrivalPending) return Promise.resolve();
    if (routeArrival) return routeArrival;
    routeArrivalPending = false;
    const startLongitude = rotation[0];
    const startLatitude = rotation[1];
    const targetLongitude = shortestLongitudeTarget(
      startLongitude,
      TRAVEL_EARTH_ROTATION[0],
    );
    const duration = reducedMotion.matches ? 0 : 760;
    const finish = () => {
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
    routeArrival = runTween(duration, (progress) => {
      rotation[0] =
        startLongitude + (targetLongitude - startLongitude) * progress;
      rotation[1] =
        startLatitude + (TRAVEL_EARTH_ROTATION[1] - startLatitude) * progress;
    }).then(finish);
    return routeArrival;
  };

  const navigateToCountry = async (
    country: AtlasCountrySummary,
    cityId?: string,
  ) => {
    if (transitionSlug || spaceTransition || homeTransition) return;
    const targetUrl = `/photography/${country.slug}${cityId ? `#city-${cityId}` : ""}`;
    if (reducedMotion.matches) {
      await navigateWithFallback(targetUrl);
      return;
    }
    prefetch(targetUrl);
    transitionSlug = country.slug;
    focusedSlug = country.slug;
    velocity = { longitude: 0, latitude: 0 };
    host.dataset.atlasTransitioning = "true";
    host.setAttribute("aria-busy", "true");
    if (status) status.textContent = `Opening ${country.name} travel map`;
    const supportsSharedTransition = CSS.supports(
      "view-transition-name: atlas-country-map",
    );
    if (!supportsSharedTransition) {
      host.dataset.atlasFallbackExit = "true";
      await runTween(160, () => undefined);
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
    await runTween(450, (progress) => {
      rotation[0] =
        startLongitude + (targetLongitude - startLongitude) * progress;
      rotation[1] = startLatitude + (targetLatitude - startLatitude) * progress;
      transitionZoom = progress;
      transitionWorldFade = progress * 0.74;
    });

    transitionFeature = featureBySlug.get(country.slug) ?? null;
    if (!transitionFeature) {
      await navigateWithFallback(targetUrl);
      return;
    }
    transitionTarget = createCountryMapProjection(
      country.slug,
      width,
      height,
      transitionFeature,
    );
    transitionMorph = 0;
    render();
    const canvasFade = canvas.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: COUNTRY_MORPH_DURATION,
      easing: "cubic-bezier(.16, 1, .3, 1)",
      fill: "forwards",
    });
    await Promise.all([
      runTween(COUNTRY_MORPH_DURATION, (progress) => {
        transitionMorph = progress;
      }),
      canvasFade.finished.catch(() => undefined),
    ]);
    transitionWorldFade = 1;
    await navigateWithFallback(targetUrl);
  };

  const captureGlobe = () => {
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
    if (transitionSlug || spaceTransition || homeTransition) return false;
    spaceTransition = destination === "projects";
    homeTransition = destination === "home";
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
    await runTween(destination === "projects" ? 360 : 640, (progress) => {
      rotation[0] =
        startLongitude + (targetLongitude - startLongitude) * progress;
      rotation[1] = startLatitude + (targetLatitude - startLatitude) * progress;
    });
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
    const bounds = canvas.getBoundingClientRect();
    const coordinate = projection.invert?.([
      clientX - bounds.left,
      clientY - bounds.top,
    ]);
    if (!coordinate) return null;
    const match = options.countries.find((country) => {
      const countryFeature = featureBySlug.get(country.slug);
      return countryFeature && geoContains(countryFeature, coordinate);
    });
    return match ?? null;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (transitionSlug || spaceTransition || homeTransition) return;
    pointerDown = true;
    pointerMoved = false;
    pointerId = event.pointerId;
    previousPointer = { x: event.clientX, y: event.clientY };
    velocity = { longitude: 0, latitude: 0 };
    canvas.setPointerCapture(pointerId);
    canvas.dataset.dragging = "true";
  };
  const onPointerMove = (event: PointerEvent) => {
    if (transitionSlug || spaceTransition || homeTransition) return;
    if (!pointerDown) {
      setHover(countryAt(event.clientX, event.clientY)?.slug ?? null);
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
  };
  const onPointerUp = (event: PointerEvent) => {
    if (
      event.pointerId !== pointerId ||
      transitionSlug ||
      spaceTransition ||
      homeTransition
    )
      return;
    pointerDown = false;
    canvas.dataset.dragging = "false";
    canvas.releasePointerCapture(pointerId);
    if (!pointerMoved) {
      const country = countryAt(event.clientX, event.clientY);
      if (country) void navigateToCountry(country);
    }
  };
  const onPointerLeave = () => {
    if (!pointerDown) setHover(null);
  };

  const labelCleanups = labelLinks.map((link) => {
    const slug = link.dataset.atlasCountry ?? "";
    const enter = () => setHover(slug);
    const leave = () => {
      if (!link.matches(":focus")) setHover(null);
    };
    const focus = () => {
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
      focusedSlug = null;
      setHover(null);
    };
    const click = (event: MouseEvent) => {
      if (!isPlainActivation(event)) return;
      const country = countryBySlug.get(slug);
      if (!country) return;
      event.preventDefault();
      void navigateToCountry(country);
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
    const enter = () => setHover(country.slug);
    const leave = () => {
      if (!link.matches(":focus")) setHover(null);
    };
    const focus = () => {
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
      focusedSlug = null;
      setHover(null);
    };
    const click = (event: MouseEvent) => {
      if (!isPlainActivation(event)) return;
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

  const onVisibility = () => {
    documentVisible = !document.hidden;
    lastTime = performance.now();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibility);
  resize();
  host.dataset.atlasReady = "true";
  if (status) status.textContent = "Drag to turn the atlas";
  frame = requestAnimationFrame(animate);

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frame);
    transitionFrames.forEach((transitionFrame) =>
      cancelAnimationFrame(transitionFrame),
    );
    observer.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    labelCleanups.forEach((cleanup) => cleanup());
    cityCleanups.forEach((cleanup) => cleanup());
    if (!flightFrozen) canvas.style.removeProperty("opacity");
  };

  return {
    animateRouteArrival,
    destroy,
    getGlobeRect,
    prepareRouteHandoff,
  };
}
