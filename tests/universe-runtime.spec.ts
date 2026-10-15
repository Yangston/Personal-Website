import { expect, test, type Page } from "@playwright/test";
import type { PortfolioUniverseRenderer } from "../src/lib/portfolio-universe/renderer";
import {
  SCENE_MANIFEST,
  createCompositionFrame,
  resolveWorldPlane,
} from "../src/lib/portfolio-universe/scene-manifest";
import { universeFlightMotionProgress } from "../src/lib/portfolio-universe/camera";
import { sampleWorldPlate } from "../src/lib/portfolio-universe/artwork-motion";
import { projectedArtworkTransform } from "../src/lib/portfolio-universe/artwork-projection";
import type { UniverseSceneId } from "../src/lib/portfolio-universe/state";

const ROOT = "[data-portfolio-universe]";
const WORLD = "[data-universe-world]";
const CANVAS = "[data-universe-renderer]";
type AuditWindow = Window & {
  __portfolioUniverseAudit?: PortfolioUniverseRenderer;
  __retainedRuntime?: PortfolioUniverseRenderer;
  __runtimeFrames?: number;
  __stopRuntimeFrames?: () => void;
  __lostContextOperations?: number;
};

async function openAudit(page: Page, scene: UniverseSceneId = "home") {
  await page.goto(`/?universeAudit=1#${scene}`);
  await expect(page.locator(ROOT)).toHaveAttribute("data-enhanced", "true");
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-webgl-ready",
    "true",
    { timeout: 30_000 },
  );
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-artwork-ready",
    "true",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as AuditWindow).__portfolioUniverseAudit),
      ),
    )
    .toBe(true);
  await expect(page.locator(`#${scene}`)).toHaveAttribute(
    "data-scene-active",
    "true",
  );
}

async function navigate(page: Page, scene: UniverseSceneId) {
  const navigation = page.getByRole("navigation", {
    name: "Primary",
    exact: true,
  });
  const menu = navigation.getByLabel("Open navigation");
  if (await menu.isVisible()) {
    if (!(await menu.evaluate((node) => node.closest("details")?.open)))
      await menu.click();
  }
  await navigation.locator(`a[href="/#${scene}"]:visible`).click();
  await expect(page.locator(`#${scene}`)).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await expect(page.locator(ROOT)).not.toHaveAttribute(
    "data-transition-phase",
    /.+/,
  );
}

test("one renderer and Earth retain geometry and layered artwork in every scene", async ({
  page,
}) => {
  const renderingErrors: string[] = [];
  page.on("pageerror", (error) => renderingErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      (message.type() === "warning" &&
        /webgl|shader|GL_INVALID|VALIDATE_STATUS/i.test(message.text()))
    )
      renderingErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAudit(page);
  const narrow = page.viewportSize()!.width <= 700;
  expect(
    Number(await page.locator(WORLD).getAttribute("data-world-plate-count")),
  ).toBeLessThanOrEqual(narrow ? 17 : 26);
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-loaded-cloud-count",
    narrow ? "29" : "40",
  );
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-artwork-failed-count",
    "0",
  );
  const identity = await page
    .locator(WORLD)
    .getAttribute("data-world-instance");
  const nodes = await page.evaluateHandle(() => ({
    canvas: document.querySelector("[data-universe-renderer]"),
    planes: [...document.querySelectorAll("[data-world-plane]")],
  }));
  const geometry = await page.locator(WORLD).evaluate((host) => ({
    points: (host as HTMLElement).dataset.constellationPointGeometry,
    lines: (host as HTMLElement).dataset.constellationLineGeometry,
  }));
  expect(geometry.points).toMatch(/^[0-9a-f-]{36}$/i);
  expect(geometry.lines).toMatch(/^[0-9a-f-]{36}$/i);
  for (const scene of ["about", "projects", "travel", "home"] as const) {
    await navigate(page, scene);
    await expect(page.locator(WORLD)).toHaveCount(1);
    await expect(page.locator(CANVAS)).toHaveCount(1);
    await expect(page.locator(WORLD)).toHaveAttribute(
      "data-world-instance",
      identity!,
    );
    await expect(page.locator(WORLD)).toHaveAttribute(
      "data-earth-mesh-count",
      "1",
    );
    await expect(page.locator(WORLD)).toHaveAttribute(
      "data-constellation-point-geometry",
      geometry.points!,
    );
    await expect(page.locator(WORLD)).toHaveAttribute(
      "data-constellation-line-geometry",
      geometry.lines!,
    );
    expect(
      await nodes.evaluate(
        (saved) =>
          saved.canvas === document.querySelector("[data-universe-renderer]") &&
          saved.planes.every(
            (node, index) =>
              node === document.querySelectorAll("[data-world-plane]")[index],
          ),
      ),
    ).toBe(true);
    const snapshot = await page.evaluate(() =>
      (window as AuditWindow).__portfolioUniverseAudit!.getSnapshot(),
    );
    const viewport = page.viewportSize()!;
    const potentialPlates = await page.evaluate(
      (planes) => {
        const audit = (window as AuditWindow).__portfolioUniverseAudit!;
        return planes.filter(
          (plane) =>
            (innerWidth > 700 || plane.mobile) &&
            audit.projectPlane(plane.position, plane.width, plane.height),
        ).length;
      },
      SCENE_MANIFEST.planes.map((plane) =>
        resolveWorldPlane(
          plane,
          viewport.width,
          viewport.height,
          snapshot.sceneWeights.travel,
        ),
      ),
    );
    expect(snapshot.artworkReady).toBe(true);
    expect(snapshot.quality.nebulaLayerCount).toBeLessThanOrEqual(
      potentialPlates,
    );
    expect(snapshot.quality.nebulaLayerCount).toBeLessThanOrEqual(
      narrow ? 17 : 26,
    );
    expect(snapshot.quality.nebulaLayerCount).toBeGreaterThan(0);
    await expect(page.locator("[data-world-depth-planes]")).toHaveCSS(
      "opacity",
      "0",
    );
    await expect(page.locator("[data-world-earth-fallback]")).toBeHidden();
    expect(snapshot.quality.drawCalls).toBeGreaterThan(0);
    expect(snapshot.quality.drawCalls).toBeLessThanOrEqual(narrow ? 32 : 44);
    expect(snapshot.lifecycle).toMatchObject({
      destroyed: false,
      contextLost: false,
      suspended: false,
    });
    if (scene === "travel") {
      await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
        "data-shared-earth",
        "true",
      );
      await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
        "data-atlas-active",
        "true",
      );
    }
  }
  await expect(page.locator("[data-world-plane]")).toHaveCount(
    SCENE_MANIFEST.planes.length,
  );
  await nodes.dispose();
  expect(
    renderingErrors,
    "No shader compilation, WebGL, resource, or uncaught runtime errors",
  ).toEqual([]);
});

test("backing buffers obey desktop and mobile budgets and recover after resize", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAudit(page);
  const identity = await page
    .locator(WORLD)
    .getAttribute("data-world-instance");
  for (const viewport of [
    { width: 3840, height: 2160 },
    { width: 700, height: 1200 },
    { width: 701, height: 1200 },
    { width: 320, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    const readBacking = () =>
      page.locator(CANVAS).evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        const snapshot = (
          window as AuditWindow
        ).__portfolioUniverseAudit!.getSnapshot();
        return {
          width: canvas.width,
          height: canvas.height,
          cssWidth: canvas.getBoundingClientRect().width,
          ratio: snapshot.quality.pixelRatio,
          preferred: Math.min(
            devicePixelRatio,
            snapshot.quality.tier === "high" ? 2 : 1,
          ),
        };
      });
    await page.waitForFunction(
      ({ selector, width }) => {
        const canvas = document.querySelector<HTMLCanvasElement>(selector);
        return (
          canvas && Math.round(canvas.getBoundingClientRect().width) === width
        );
      },
      { selector: CANVAS, width: viewport.width },
      { timeout: 5_000 },
    );
    await expect
      .poll(async () => {
        const backing = await readBacking();
        return Math.abs(
          backing.width - Math.floor(viewport.width * backing.ratio),
        );
      })
      .toBeLessThanOrEqual(1);
    const backing = await readBacking();
    expect(backing.width * backing.height).toBeLessThanOrEqual(
      viewport.width <= 700 ? 1_000_000 : 2_000_000,
    );
    expect(backing.ratio).toBeGreaterThan(0);
    expect(backing.ratio).toBeLessThanOrEqual(backing.preferred);
    if (viewport.width === 3840) expect(backing.ratio).toBeLessThan(1);
    if (viewport.width === 320) expect(backing.ratio).toBe(backing.preferred);
    await expect(page.locator(WORLD)).toHaveAttribute(
      "data-world-instance",
      identity!,
    );
  }
});

test("detail navigation and document hiding pause frames and resume the same runtime", async ({
  page,
}) => {
  await openAudit(page, "projects");
  const identity = await page
    .locator(WORLD)
    .getAttribute("data-world-instance");
  await page.evaluate(() => {
    const auditWindow = window as AuditWindow;
    auditWindow.__retainedRuntime = auditWindow.__portfolioUniverseAudit;
    auditWindow.__runtimeFrames = 0;
    auditWindow.__stopRuntimeFrames = auditWindow.__retainedRuntime!.subscribe(
      () => {
        auditWindow.__runtimeFrames! += 1;
      },
    );
  });
  await page
    .locator('[data-project-id="sightline"] [data-project-constellation]')
    .click();
  await expect(page).toHaveURL(/\/projects\/sightline\/?$/);
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator(WORLD)).toHaveAttribute("data-world-mode", "quiet");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as AuditWindow).__retainedRuntime?.getSnapshot().lifecycle
            .suspended,
      ),
    )
    .toBe(true);
  const paused = await page.evaluate(() => ({
    lifecycle: (window as AuditWindow).__retainedRuntime!.getSnapshot()
      .lifecycle,
    frames: (window as AuditWindow).__runtimeFrames,
  }));
  expect(paused.lifecycle).toMatchObject({
    suspended: true,
    frameScheduled: false,
    destroyed: false,
  });
  await page.waitForTimeout(120);
  expect(
    await page.evaluate(() => (window as AuditWindow).__runtimeFrames),
  ).toBe(paused.frames);
  await page.locator('main a[href="/#projects"]').first().click();
  await expect(page.locator(ROOT)).toHaveAttribute("data-enhanced", "true");
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-world-instance",
    identity!,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as AuditWindow).__retainedRuntime!.getSnapshot().lifecycle
            .suspended,
      ),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate(() => (window as AuditWindow).__runtimeFrames ?? 0),
    )
    .toBeGreaterThan(paused.frames!);
  // Exercise the visibility event deterministically; headless tabs can stay visible.
  const hiddenFrames = await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    return (window as AuditWindow).__runtimeFrames!;
  });
  expect(
    await page.evaluate(
      () =>
        (window as AuditWindow).__retainedRuntime!.getSnapshot().lifecycle
          .frameScheduled,
    ),
  ).toBe(false);
  await page.waitForTimeout(120);
  expect(
    await page.evaluate(() => (window as AuditWindow).__runtimeFrames),
  ).toBe(hiddenFrames);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as AuditWindow).__runtimeFrames ?? 0),
    )
    .toBeGreaterThan(hiddenFrames);
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-world-instance",
    identity!,
  );
  await page.evaluate(() => (window as AuditWindow).__stopRuntimeFrames?.());
});

for (const failure of [
  "initial WebGL failure",
  "context loss in Travel",
] as const) {
  test(`${failure} retains the world and a usable country archive path`, async ({
    page,
  }) => {
    if (failure === "initial WebGL failure") {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          kind: string,
          ...args: unknown[]
        ) {
          if (["webgl", "webgl2", "experimental-webgl"].includes(kind))
            return null;
          return original.apply(this, [kind, ...args] as Parameters<
            typeof original
          >);
        } as typeof original;
      });
      await page.goto("/?universeAudit=1#home");
      await expect(page.locator(ROOT)).toHaveAttribute("data-enhanced", "true");
      await expect(page.locator(WORLD)).toHaveAttribute(
        "data-renderer-type",
        "fallback",
      );
      await expect(page.locator("[data-world-earth-fallback]")).toBeVisible();
      await navigate(page, "travel");
    } else {
      await openAudit(page, "travel");
      await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
        "data-shared-earth",
        "true",
      );
      const contextWasLost = await page.evaluate(() => {
        const gl = document
          .querySelector<HTMLCanvasElement>("[data-universe-renderer]")!
          .getContext("webgl2");
        const extension = gl?.getExtension("WEBGL_lose_context");
        if (!gl || !extension) return false;
        const auditWindow = window as AuditWindow;
        auditWindow.__lostContextOperations = 0;
        const methods = gl as unknown as Record<
          string,
          (...args: number[]) => unknown
        >;
        for (const name of [
          "viewport",
          "clear",
          "drawArrays",
          "drawElements",
        ]) {
          const original = methods[name].bind(gl);
          methods[name] = (...args) => {
            if (gl.isContextLost()) auditWindow.__lostContextOperations! += 1;
            return original(...args);
          };
        }
        extension.loseContext();
        return true;
      });
      expect(contextWasLost).toBe(true);
    }
    await expect(page.locator(WORLD)).toHaveAttribute(
      "data-renderer-type",
      "fallback",
    );
    await expect(page.locator(WORLD)).toHaveAttribute(
      "data-webgl-ready",
      "false",
    );
    await expect(page.locator(WORLD)).toHaveAttribute(
      "data-artwork-ready",
      "false",
    );
    await expect(page.locator("[data-world-depth-planes]")).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(page.locator('[data-world-plane="nebula"]')).toBeVisible();
    await expect(page.locator(CANVAS)).toHaveCSS("visibility", "hidden");
    await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
      "data-shared-earth",
      "false",
    );
    await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
      "data-atlas-active",
      "true",
    );
    await expect(page.locator("[data-atlas-canvas]")).toHaveCount(1);
    await expect(page.locator("[data-atlas-canvas]")).toBeVisible();
    await expect(page.locator("[data-world-earth-fallback]")).toBeHidden();
    await expect(page.locator("[data-world-plane]")).toHaveCount(
      SCENE_MANIFEST.planes.length,
    );
    const snapshot = await page.evaluate(() =>
      (window as AuditWindow).__portfolioUniverseAudit!.getSnapshot(),
    );
    expect(snapshot.lifecycle.frameScheduled).toBe(false);
    expect(snapshot.lifecycle.destroyed).toBe(false);
    if (failure === "context loss in Travel") {
      expect(snapshot.lifecycle.contextLost).toBe(true);
      // Count only operations after the browser's asynchronous loss event has
      // reached the runtime, not an already queued frame preceding that event.
      await page.evaluate(() => {
        (window as AuditWindow).__lostContextOperations = 0;
      });
    }
    const assertFallbackComposition = async (scene: UniverseSceneId) => {
      const state = await page.evaluate(() => {
        const plate = document.querySelector<HTMLImageElement>(
          '[data-world-plane="nebula"]',
        )!;
        const matrix = new DOMMatrixReadOnly(plate.style.transform);
        return {
          snapshot: (
            window as AuditWindow
          ).__portfolioUniverseAudit!.getSnapshot(),
          width: innerWidth,
          height: innerHeight,
          intrinsicWidth: Number(plate.getAttribute("width")),
          intrinsicHeight: Number(plate.getAttribute("height")),
          visibility: getComputedStyle(plate).visibility,
          matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
        };
      });
      expect(state.snapshot.activeScene).toBe(scene);
      expect(state.snapshot.sceneWeights[scene]).toBe(1);
      expect(state.snapshot.lifecycle.frameScheduled).toBe(false);
      const frame = createCompositionFrame(
        scene,
        state.width,
        state.height,
        SCENE_MANIFEST,
      );
      expect(state.snapshot.camera.position).toEqual(
        Object.values(frame.pose.position),
      );
      const plane = resolveWorldPlane(
        SCENE_MANIFEST.planes.find(({ id }) => id === "nebula")!,
        state.width,
        state.height,
      );
      const sampled = sampleWorldPlate(
        plane,
        state.snapshot.effectTimeMs,
        state.snapshot.sceneWeights.about,
      );
      const projection = frame.project(
        sampled.position,
        plane.width,
        plane.height,
      );
      if (!projection) {
        expect(state.visibility).toBe("hidden");
        return;
      }
      const expected = projectedArtworkTransform(
        projection,
        state.intrinsicWidth,
        state.intrinsicHeight,
        sampled.rotation,
      )
        .slice(7, -1)
        .split(",")
        .map(Number);
      state.matrix.forEach((value, index) =>
        expect(Math.abs(value - expected[index])).toBeLessThan(0.05),
      );
    };
    for (const scene of ["about", "projects", "home", "travel"] as const) {
      await navigate(page, scene);
      await assertFallbackComposition(scene);
    }
    await navigate(page, "home");
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(async () => {
          try {
            await assertFallbackComposition("home");
            return true;
          } catch {
            return false;
          }
        })
        .toBe(true);
    }
    if (failure === "context loss in Travel") {
      expect(
        await page.evaluate(
          () => (window as AuditWindow).__lostContextOperations,
        ),
      ).toBe(0);
    }
    await navigate(page, "travel");
    const visibleCountry = page
      .locator('[data-atlas-country][data-visible="true"]')
      .first();
    await expect(visibleCountry).toBeVisible();
    const slug = await visibleCountry.getAttribute("data-atlas-country");
    const country = page.locator(`[data-atlas-country="${slug}"]`);
    await expect(country).toHaveAttribute("href", `/photography/${slug}`);
    // Keyboard activation remains reliable while the focused label rotates.
    await country.focus();
    await country.press("Enter");
    const panel = page.locator(
      `dialog[data-scene-panel="country-preview-${slug}"]`,
    );
    await expect(panel).toBeVisible();
    await panel.locator(`a[href="/photography/${slug}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/photography/${slug}/?$`));
    await expect(page.locator("main h1")).toBeVisible();
  });
}

test("audit seeking deterministically projects DOM planes and stages foreground copy", async ({
  page,
}) => {
  await openAudit(page);
  let effectsPinned = false;
  for (const [from, to] of [
    ["home", "projects"],
    ["projects", "travel"],
    ["travel", "home"],
  ] as const) {
    const sample = (progress: number) => {
      const pinEffects = !effectsPinned;
      effectsPinned = true;
      return page.evaluate(
        ({ from, to, progress, manifest, pinEffects }) => {
          const audit = (window as AuditWindow).__portfolioUniverseAudit!;
          if (pinEffects) audit.setEffectTime(0);
          const snapshot = audit.seekFlight(from, to, progress);
          return {
            camera: snapshot.camera,
            anchors: snapshot.projectedAnchors,
            foreground: [from, to].map((scene) => {
              const node = document.getElementById(scene)!;
              return {
                opacity: Number(getComputedStyle(node).opacity),
                active: node.getAttribute("data-scene-active"),
              };
            }),
            planes: manifest.planes.map((authored) => {
              const plane = authored;
              const node = document.querySelector<HTMLElement>(
                `[data-world-plane="${plane.id}"]`,
              )!;
              const bounds = node.getBoundingClientRect();
              const projection = audit.projectPlane(
                plane.position,
                plane.width,
                plane.height,
              );
              const rotatedWidth =
                projection &&
                Math.abs(Math.cos(plane.rotation)) * projection.bounds.width +
                  Math.abs(Math.sin(plane.rotation)) * projection.bounds.height;
              const rotatedHeight =
                projection &&
                Math.abs(Math.sin(plane.rotation)) * projection.bounds.width +
                  Math.abs(Math.cos(plane.rotation)) * projection.bounds.height;
              return {
                id: plane.id,
                displayed: getComputedStyle(node).display !== "none",
                expected: projection && {
                  bounds: {
                    left: projection.x - rotatedWidth! / 2,
                    top: projection.y - rotatedHeight! / 2,
                    width: rotatedWidth!,
                    height: rotatedHeight!,
                  },
                },
                bounds: {
                  left: bounds.left,
                  top: bounds.top,
                  width: bounds.width,
                  height: bounds.height,
                },
              };
            }),
          };
        },
        {
          from,
          to,
          progress,
          manifest: {
            ...SCENE_MANIFEST,
            planes: SCENE_MANIFEST.planes.map((plane) =>
              resolveWorldPlane(
                plane,
                page.viewportSize()!.width,
                page.viewportSize()!.height,
                from === "travel"
                  ? 1 - universeFlightMotionProgress(progress)
                  : to === "travel"
                    ? universeFlightMotionProgress(progress)
                    : 0,
              ),
            ),
          },
          pinEffects,
        },
      );
    };
    const samples = [];
    const geometryFailures: string[] = [];
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const current = await sample(progress);
      samples.push(current);
      for (const plane of current.planes) {
        if (!plane.displayed || !plane.expected) continue;
        for (const key of ["left", "top", "width", "height"] as const) {
          const difference = Math.abs(
            plane.bounds[key] - plane.expected.bounds[key],
          );
          if (!(difference < 0.1))
            geometryFailures.push(
              `${from} -> ${to} ${progress} ${plane.id}.${key}: ${difference}px (expected <0.1px)`,
            );
        }
      }
    }
    // Trace bookkeeping per coordinate dominated the test's wall time. Keep
    // every comparison and report all failed coordinates in one assertion.
    expect(geometryFailures, `${from} -> ${to} projected artwork`).toEqual([]);
    const incomingOpacity = samples[3].foreground[1].opacity;
    expect(
      {
        initialOpacity: samples[0].foreground.map((scene) => scene.opacity),
        quarterOpacity: samples[1].foreground.map((scene) => scene.opacity),
        midpointOpacity: samples[2].foreground.map((scene) => scene.opacity),
        arrivalOpacity: samples[3].foreground.map((scene) => scene.opacity),
        settledOpacity: samples[4].foreground.map((scene) => scene.opacity),
        settledActive: samples[4].foreground.map((scene) => scene.active),
      },
      `${from} -> ${to} foreground; 75% incoming opacity ${incomingOpacity}`,
    ).toEqual({
      initialOpacity: [1, 0],
      quarterOpacity: [0, 0],
      // Destination copy now starts at 38% and becomes steadily clearer through arrival.
      midpointOpacity: [0, expect.closeTo((0.5 - 0.38) / 0.62, 5)],
      arrivalOpacity: [0, expect.closeTo((0.75 - 0.38) / 0.62, 5)],
      settledOpacity: [0, 1],
      settledActive: ["false", "true"],
    });
    const repeated = await sample(0.5);
    expect({ camera: repeated.camera, anchors: repeated.anchors }).toEqual({
      camera: samples[2].camera,
      anchors: samples[2].anchors,
    });
  }
});

test("warmed flights respect draw-call and hardware frame budgets", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await openAudit(page);
  await navigate(page, "travel");
  await navigate(page, "home");
  const metrics = await page.evaluate(async () => {
    const audit = (window as AuditWindow).__portfolioUniverseAudit!;
    const gl = document
      .querySelector<HTMLCanvasElement>("[data-universe-renderer]")!
      .getContext("webgl2")!;
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
    );
    const frameTimes: number[] = [];
    const longTasks: number[] = [];
    let maxDrawCalls = 0;
    const unsubscribe = audit.subscribe((snapshot) => {
      if (!snapshot.flight) return;
      frameTimes.push(performance.now());
      maxDrawCalls = Math.max(maxDrawCalls, snapshot.quality.drawCalls);
    });
    const observer = new PerformanceObserver((entries) =>
      entries.getEntries().forEach((entry) => longTasks.push(entry.duration)),
    );
    observer.observe({ type: "longtask" });
    try {
      for (const scene of ["projects", "travel", "home"] as const) {
        document
          .querySelector<HTMLAnchorElement>(
            `.site-navigation a[href="/#${scene}"]`,
          )!
          .click();
        const deadline = performance.now() + 12_000;
        while (
          document.querySelector<HTMLElement>("[data-portfolio-universe]")!
            .dataset.transitionPhase ||
          document.getElementById(scene)!.dataset.sceneActive !== "true"
        ) {
          if (performance.now() > deadline)
            throw new Error(`Timed out measuring ${scene} flight`);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
        }
      }
    } finally {
      unsubscribe();
      observer.disconnect();
    }
    const intervals = frameTimes
      .slice(1)
      .map((time, index) => time - frameTimes[index])
      .sort((a, b) => a - b);
    return {
      renderer,
      frames: frameTimes.length,
      p95FrameInterval:
        intervals[Math.floor(intervals.length * 0.95)] ?? Infinity,
      maxLongTask: Math.max(0, ...longTasks),
      maxDrawCalls,
    };
  });
  await testInfo.attach("runtime-performance", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  expect(metrics.frames).toBeGreaterThan(3);
  expect(metrics.maxDrawCalls).toBeGreaterThan(0);
  expect(metrics.maxDrawCalls).toBeLessThanOrEqual(
    page.viewportSize()!.width <= 700 ? 32 : 44,
  );
  if (/swiftshader|llvmpipe|software|basic render/i.test(metrics.renderer)) {
    testInfo.annotations.push({
      type: "software-renderer",
      description: `${metrics.renderer}: only numeric frame-time and long-task gates skipped; rendering and draw-call checks enforced.`,
    });
    return;
  }
  expect(metrics.frames).toBeGreaterThan(90);
  expect(metrics.p95FrameInterval).toBeLessThanOrEqual(
    testInfo.project.name === "mobile" ? 34 : 25,
  );
  expect(metrics.maxLongTask).toBeLessThanOrEqual(100);
});
