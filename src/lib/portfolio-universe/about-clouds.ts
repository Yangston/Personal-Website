import type {
  PortfolioUniverseRenderer,
  UniverseRuntimeSnapshot,
} from "./renderer";
import {
  SCENE_MANIFEST,
  resolveWorldPlane,
  createCompositionFrame,
} from "./scene-manifest";
import { NEBULA_INTEREST_REGIONS, placeNebulaRegions } from "./nebula-regions";
import { easeCloudLight } from "./nebula-light";
import { resolveCloudLayout, type CloudLayout } from "./cloud-layout";
import { universeFlightMotionProgress } from "./camera";

export const CLOUD_IDS = ["songs", "books", "hobbies"] as const;
export type CloudId = (typeof CLOUD_IDS)[number];

/** Continue toward the requested state and hold there until the next toggle. */
export function advanceCloudReveal(
  progress: number,
  expanded: boolean,
  deltaMs: number,
  immediate = false,
) {
  if (immediate) return expanded ? 1 : 0;
  const elapsed = Math.max(0, deltaMs);
  return expanded
    ? Math.min(1, progress + elapsed / 650)
    : Math.max(0, progress - elapsed / 450);
}

/** Slow, bounded fold movement on the universe clock; labels and hit areas stay still. */
export function sampleCloudDrift(
  timeMs: number,
  index: number,
  stationary = false,
) {
  if (stationary) return { x: 0, y: 0, roll: 0, breath: 1 };
  const phase = (Math.max(0, timeMs) / (22000 + index * 4000)) * Math.PI * 2;
  const angle = phase + index * 2.17;
  return {
    x: Math.sin(angle) * 3,
    y: Math.cos(angle * 0.8 + index) * 4,
    roll: Math.sin(angle * 0.7) * 1.2,
    breath: 1 + Math.sin(angle) * 0.018,
  };
}

/** Items cross a foreground ridge; the mask conceals their entire initial pose. */
export function sampleCloudItem(
  progress: number,
  index: number,
  count: number,
  timeMs: number,
  narrow: boolean,
  reduced: boolean,
  layout: CloudLayout = resolveCloudLayout(
    narrow ? 390 : 1440,
    narrow ? 844 : 900,
  )[0],
  aspect = 1,
) {
  const p = reduced
    ? progress
    : Math.min(1, Math.max(0, progress * 1.24 - index * 0.075));
  const eased = universeFlightMotionProgress(p);
  const offset = index - (count - 1) / 2;
  const endX = offset * (layout.itemWidth + layout.gap);
  const staggerY =
    layout.id === "songs"
      ? Math.abs(offset) * 7
      : layout.id === "books"
        ? offset * 6
        : (index % 2) * 5;
  const endY = layout.size * 0.14 - layout.itemWidth * aspect + staggerY;
  const startY = layout.size * 0.3;
  return {
    x: endX * (0.25 + eased * 0.75),
    y:
      startY +
      (endY - startY) * eased +
      (reduced ? 0 : Math.sin(timeMs / 1800 + index * 1.7) * 1.5 * eased),
    rotation: offset * (narrow ? 2 : 4) * eased,
    scale: 0.84 + 0.16 * eased,
    clip: 100 * (1 - Math.min(1, p * 1.5)),
    opacity: p === 0 ? 0 : 1,
  };
}

export function createAboutClouds(
  root: HTMLElement,
  runtime: PortfolioUniverseRenderer,
) {
  const bootstrapWindow = window as Window & {
    __nebulaRegionsCleanup?: () => void;
  };
  bootstrapWindow.__nebulaRegionsCleanup?.();
  delete bootstrapWindow.__nebulaRegionsCleanup;
  const section = root.querySelector<HTMLElement>("#about")!;
  let disposed = false;
  const caption = section.querySelector<HTMLElement>("[data-cloud-caption]")!;
  const synchronizeCaption = () => {
    const selected =
      section.querySelector<HTMLElement>(
        '[data-cloud][data-open="true"] [data-floating-item]:focus',
      ) ??
      section.querySelector<HTMLElement>(
        '[data-cloud][data-open="true"] [data-floating-item][aria-pressed="true"]',
      ) ??
      section.querySelector<HTMLElement>(
        '[data-cloud][data-open="true"] [data-floating-item]:hover',
      );
    caption.hidden = !selected;
    for (const selector of ["strong", "span"] as const) {
      const text =
        selected?.querySelector(`.item-caption > ${selector}`)?.textContent ??
        "";
      const field = caption.querySelector(selector)!;
      if (field.textContent !== text) field.textContent = text;
    }
  };
  const groups = [...section.querySelectorAll<HTMLElement>("[data-cloud]")].map(
    (element) => ({
      element,
      id: element.dataset.cloud as CloudId,
      toggle: element.querySelector<HTMLButtonElement>("[data-cloud-toggle]")!,
      list: element.querySelector<HTMLElement>("[data-cloud-items]")!,
      items: [...element.querySelectorAll<HTMLElement>("[data-cloud-item]")],
      progress: 0,
      hover: 0,
    }),
  );
  const opened = new Set<CloudId>();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let lastTime = 0;
  let referenceViewport = "";
  let referenceWidth = 1;
  const reset = () => {
    opened.clear();
    caption.hidden = true;
    groups.forEach((group) => {
      group.progress = 0;
      group.hover = 0;
      group.element.dataset.open = "false";
      delete group.element.dataset.closing;
      group.toggle.setAttribute("aria-expanded", "false");
      group.list.inert = true;
      group.list.setAttribute("aria-hidden", "true");
      group.element
        .querySelectorAll("[aria-pressed]")
        .forEach((item) => item.setAttribute("aria-pressed", "false"));
    });
  };
  const update = (snapshot: UniverseRuntimeSnapshot, immediate = false) => {
    const narrow = innerWidth <= 700;
    const layout = resolveCloudLayout(innerWidth, innerHeight);
    const time = snapshot.effectTimeMs;
    const delta = Math.min(64, Math.max(0, time - lastTime));
    lastTime = time;
    if (!immediate && snapshot.sceneWeights.about === 0) return;
    const nebula = resolveWorldPlane(
      SCENE_MANIFEST.planes.find((plane) => plane.id === "nebula")!,
      innerWidth,
      innerHeight,
    );
    const projection = runtime.projectPlane(
      nebula.position,
      nebula.width,
      nebula.height,
    );
    const viewportKey = `${innerWidth}:${innerHeight}`;
    if (referenceViewport !== viewportKey) {
      referenceViewport = viewportKey;
      referenceWidth =
        createCompositionFrame(
          "about",
          innerWidth,
          innerHeight,
          SCENE_MANIFEST,
        ).project(nebula.position, nebula.width, nebula.height)?.bounds.width ??
        1;
    }
    placeNebulaRegions(
      root,
      NEBULA_INTEREST_REGIONS,
      projection,
      { width: innerWidth, height: innerHeight },
      resolveCloudLayout,
      referenceWidth,
    );
    groups.forEach((group, index) => {
      const target = opened.has(group.id) ? 1 : 0;
      const instant =
        reduced.matches ||
        immediate ||
        snapshot.rendererType === "fallback" ||
        snapshot.lifecycle.contextLost;
      group.progress = advanceCloudReveal(
        group.progress,
        Boolean(target),
        delta,
        instant,
      );
      const hovered = group.element.matches(":hover, :focus-within") ? 1 : 0;
      group.hover = instant
        ? hovered
        : easeCloudLight(group.hover, hovered, delta);
      group.element.style.opacity = String(snapshot.sceneWeights.about);
      group.element.style.setProperty("--cloud-open", String(group.progress));
      group.element.style.setProperty("--cloud-hover", String(group.hover));
      const stationary =
        reduced.matches ||
        snapshot.rendererType === "fallback" ||
        snapshot.lifecycle.contextLost;
      const drift = sampleCloudDrift(time, index, stationary);
      group.element.style.setProperty("--cloud-drift-x", `${drift.x}px`);
      group.element.style.setProperty("--cloud-drift-y", `${drift.y}px`);
      group.element.style.setProperty("--cloud-roll", `${drift.roll}deg`);
      group.element.style.setProperty("--cloud-breath", String(drift.breath));
      const slot = layout.find((entry) => entry.id === group.id)!;
      if (!target && group.progress === 0) delete group.element.dataset.closing;
      group.items.forEach((item, itemIndex) => {
        const image = item.querySelector<HTMLImageElement>(".item-artwork img");
        const aspect = image
          ? Number(image.getAttribute("height")) /
            Number(image.getAttribute("width"))
          : 1;
        const sample = sampleCloudItem(
          group.progress,
          itemIndex,
          group.items.length,
          time,
          narrow,
          stationary,
          slot,
          aspect,
        );
        item.style.setProperty("--item-x", `${sample.x}px`);
        item.style.setProperty("--item-y", `${sample.y}px`);
        item.style.setProperty("--item-rotation", `${sample.rotation}deg`);
        item.style.setProperty("--item-scale", String(sample.scale));
        item.style.setProperty("--item-opacity", String(sample.opacity));
        item.style.setProperty("--item-clip", `${sample.clip}%`);
        item.style.clipPath = group.progress >= 0.99 ? "none" : "";
      });
    });
  };
  const click = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const toggle = target?.closest<HTMLElement>("[data-cloud-toggle]");
    if (toggle) {
      const id = toggle.dataset.cloudToggle as CloudId;
      const group = groups.find((group) => group.id === id)!;
      if (opened.has(id)) {
        opened.delete(id);
        group.element.dataset.closing = "true";
        group.element
          .querySelectorAll("[aria-pressed]")
          .forEach((item) => item.setAttribute("aria-pressed", "false"));
      } else opened.add(id);
      group.element.dataset.open = String(opened.has(id));
      group.toggle.setAttribute("aria-expanded", String(opened.has(id)));
      group.list.inert = !opened.has(id);
      group.list.setAttribute("aria-hidden", String(!opened.has(id)));
    }
    const item = target?.closest<HTMLElement>("[data-floating-item]");
    if (item) {
      for (const other of section.querySelectorAll<HTMLElement>(
        "[data-floating-item]",
      ))
        if (other !== item) other.setAttribute("aria-pressed", "false");
      item.setAttribute(
        "aria-pressed",
        String(item.getAttribute("aria-pressed") !== "true"),
      );
    }
    update(runtime.getSnapshot());
    synchronizeCaption();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !opened.size) return;
    event.preventDefault();
    const focusedGroup = groups.find((group) =>
      group.element.contains(document.activeElement),
    );
    if (focusedGroup?.list.contains(document.activeElement))
      focusedGroup.toggle.focus({ preventScroll: true });
    reset();
    update(runtime.getSnapshot(), true);
  };
  const imageError = (event: Event) => {
    if (event.target instanceof HTMLImageElement)
      event.target
        .closest<HTMLElement>(".item-artwork")
        ?.setAttribute("data-image-failed", "true");
  };
  const onResize = () => update(runtime.getSnapshot(), true);
  const onInterest = () => {
    if (disposed) return;
    synchronizeCaption();
    const snapshot = runtime.getSnapshot();
    if (
      snapshot.rendererType === "fallback" ||
      snapshot.lifecycle.contextLost ||
      reduced.matches
    )
      update(snapshot, true);
  };
  const onInterestLeave = () => queueMicrotask(onInterest);
  const observer = new MutationObserver(() => {
    if (section.dataset.sceneActive !== "true") reset();
    update(runtime.getSnapshot(), true);
  });
  observer.observe(section, {
    attributes: true,
    attributeFilter: ["data-scene-active"],
  });
  section.addEventListener("pointerover", onInterest);
  section.addEventListener("focusin", onInterest);
  section.addEventListener("pointerout", onInterestLeave);
  section.addEventListener("focusout", onInterestLeave);
  section.addEventListener("click", click);
  section.addEventListener("keydown", key);
  section.addEventListener("error", imageError, true);
  window.addEventListener("resize", onResize);
  reduced.addEventListener("change", onResize);
  section
    .querySelectorAll<HTMLImageElement>(".item-artwork img")
    .forEach((image) => {
      if (image.complete && !image.naturalWidth)
        image
          .closest<HTMLElement>(".item-artwork")
          ?.setAttribute("data-image-failed", "true");
      else void image.decode().catch(() => undefined);
    });
  reset();
  update(runtime.getSnapshot(), true);
  return {
    update,
    destroy() {
      disposed = true;
      reset();
      observer.disconnect();
      section.removeEventListener("pointerover", onInterest);
      section.removeEventListener("focusin", onInterest);
      section.removeEventListener("pointerout", onInterestLeave);
      section.removeEventListener("focusout", onInterestLeave);
      section.removeEventListener("click", click);
      section.removeEventListener("keydown", key);
      section.removeEventListener("error", imageError, true);
      window.removeEventListener("resize", onResize);
      reduced.removeEventListener("change", onResize);
    },
  };
}
