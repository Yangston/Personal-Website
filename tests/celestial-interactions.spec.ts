import { expect, test, type Page } from "@playwright/test";
import type { PortfolioUniverseRenderer } from "../src/lib/portfolio-universe/renderer";
import { pointFor } from "./helpers/home-region";
import { sampleShootingStar } from "../src/lib/portfolio-universe/ambient-effects";

type AuditWindow = Window & {
  __portfolioUniverseAudit?: PortfolioUniverseRenderer;
};
const ROOT = "[data-portfolio-universe]",
  WORLD = "[data-universe-world]";
async function open(page: Page) {
  await page.goto("/?universeAudit=1#home");
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-artwork-ready",
    "true",
    { timeout: 30000 },
  );
  await expect(page.locator("[data-home-regions]")).not.toHaveAttribute(
    "inert",
  );
}

test("whole objects navigate on pointer or first touch and keep labels hidden", async ({
  page,
}, info) => {
  await open(page);
  await expect(
    page.locator(".destination-marker,.destination-copy"),
  ).toHaveCount(0);
  for (const id of ["about", "projects", "travel"]) {
    const point = await pointFor(page, id);
    if (info.project.name === "mobile")
      await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await expect(page.locator("[data-home-regions]")).toHaveAttribute(
      "inert",
      "",
    );
    await expect(page.locator(ROOT)).toHaveAttribute("data-active-scene", id);
    await expect(page.locator(ROOT)).not.toHaveAttribute(
      "data-transition-phase",
      /.+/,
    );
    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    const menu = nav.getByLabel("Open navigation");
    if (await menu.isVisible()) await menu.click();
    await nav.locator('a[href="/#home"]:visible').click();
    await expect(page.locator(ROOT)).not.toHaveAttribute(
      "data-transition-phase",
      /.+/,
    );
  }
});

test("focus keeps its glow after the pointer leaves and Enter activates the object", async ({
  page,
}) => {
  await open(page);
  const link = page.locator('[data-universe-destination="about"]');
  await link.focus();
  await page.mouse.move(2, 2);
  await expect(page.locator(ROOT)).toHaveAttribute(
    "data-interaction-target",
    "about",
  );
  await expect(link.locator("[data-region-outline]:visible")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as AuditWindow).__portfolioUniverseAudit!.getSnapshot()
            .effects.nebulaActivity,
      ),
    )
    .toBeGreaterThan(0.7);
  await page.keyboard.press("Enter");
  await expect(page.locator("#universe-about-title")).toBeFocused();
});

test("transparent corners and decorative bodies do not become navigation targets", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(0),
  );
  const result = await page.evaluate(() => {
    const targets = [
      ...document.querySelectorAll<HTMLElement>("[data-universe-destination]"),
    ];
    return targets.map((link) => {
      const box = link.getBoundingClientRect();
      const x = box.left + 1,
        y = box.top + 1;
      return {
        id: link.dataset.universeDestination,
        onscreen: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
        hit: document.elementFromPoint(x, y)?.closest("a") === link,
      };
    });
  });
  for (const corner of result)
    if (corner.onscreen) expect(corner.hit, corner.id).toBe(false);
  await expect(
    page.locator("[data-world-body] a,[data-world-body] button"),
  ).toHaveCount(0);
  expect(
    await page
      .locator("[data-world-body]")
      .evaluateAll(
        (nodes) =>
          new Set(nodes.map((n) => n.getAttribute("data-world-body"))).size,
      ),
  ).toBe(5);
  const bodyHits = await page
    .locator("[data-world-body]")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const b = node.getBoundingClientRect();
        const x = b.x + b.width / 2,
          y = b.y + b.height / 2;
        return {
          onscreen:
            getComputedStyle(node).display !== "none" &&
            x > 0 &&
            x < innerWidth &&
            y > 0 &&
            y < innerHeight,
          target: document
            .elementFromPoint(x, y)
            ?.closest("[data-universe-destination]")
            ?.getAttribute("data-universe-destination"),
        };
      }),
    );
  for (const hit of bodyHits)
    if (hit.onscreen) expect(hit.target).toBeUndefined();
});

test("modifier clicks keep native URLs and leave the current scene alone", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const point = await pointFor(page, "about");
  const popupPromise = page.context().waitForEvent("page");
  await page.keyboard.down("Control");
  try {
    await page.mouse.click(point.x, point.y);
  } finally {
    await page.keyboard.up("Control");
  }
  const popup = await popupPromise;
  // This asserts native routing, not initialization of a background WebGL tab.
  await popup.waitForURL(/\/#about$/, { waitUntil: "commit" });
  expect(new URL(popup.url()).hash).toBe("#about");
  await expect(page).toHaveURL(/#home$/);
  await popup.close();
});

test("silhouette focus cannot scroll the clipped world after resizing", async ({
  page,
}) => {
  // This checks clipping geometry; ambient animation has dedicated coverage.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  for (const [width, height] of [
    [1440, 900],
    [1659, 948],
    [390, 844],
    [320, 700],
  ]) {
    await page.setViewportSize({ width, height });
    for (const id of ["about", "projects", "travel"]) {
      // Native focus intentionally omits preventScroll: offscreen portions of
      // the silhouette must never turn the region layer into a scroll area.
      await page.locator(`[data-universe-destination="${id}"]`).focus();
      const offsets = await page
        .locator("[data-home-regions]")
        .evaluate((node) => {
          node.scrollLeft = 120;
          node.scrollTop = 240;
          const world = document.querySelector("[data-portfolio-universe]")!;
          world.scrollLeft = 120;
          world.scrollTop = 240;
          return [
            node.scrollLeft,
            node.scrollTop,
            world.scrollLeft,
            world.scrollTop,
            window.scrollX,
            window.scrollY,
          ];
        });
      expect(offsets).toEqual([0, 0, 0, 0, 0, 0]);
      const point = await pointFor(page, id);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThan(width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThan(height);
    }
  }
});

test("initial WebGL failure and context loss retain silhouette links", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.simulateContextLoss(),
  );
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-renderer-type",
    "fallback",
  );
  const point = await pointFor(page, "travel");
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#universe-travel-title")).toBeVisible();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ) {
      if (/webgl/.test(contextId)) return null;
      return Reflect.apply(original, this, [contextId, ...args]);
    } as typeof original;
  });
  await page.goto("/?universeAudit=1#home");
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-renderer-type",
    "fallback",
  );
  const next = await pointFor(page, "about");
  await page.mouse.click(next.x, next.y);
  await expect(page.locator("#universe-about-title")).toBeFocused();
});

test("pinned idle effects are deterministic and reduced motion removes the shooting star", async ({
  page,
}, info) => {
  await open(page);
  let time = 16000;
  while (time < 44000 && !sampleShootingStar(time)) time += 20;
  time += 400;
  const sample = await page.evaluate((t) => {
    const audit = (window as AuditWindow).__portfolioUniverseAudit!;
    audit.setEffectTime(t);
    return audit.getSnapshot();
  }, time);
  expect(sample.effects.shootingStarActive).toBe(true);
  expect(sample.quality.drawCalls).toBeLessThanOrEqual(
    info.project.name === "mobile" ? 32 : 44,
  );
  const again = await page.evaluate((t) => {
    const audit = (window as AuditWindow).__portfolioUniverseAudit!;
    audit.setEffectTime(t);
    return audit.getSnapshot();
  }, time);
  expect(again.effects).toEqual(sample.effects);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as AuditWindow).__portfolioUniverseAudit!.getSnapshot()
            .effects.shootingStarActive,
      ),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as AuditWindow).__portfolioUniverseAudit!.getSnapshot()
            .effectTimeMs,
      ),
    )
    .toBe(0);
});

test("active nebula hover stays within the existing hardware frame limits", async ({
  page,
}, info) => {
  await open(page);
  const point = await pointFor(page, "about");
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(ROOT)).toHaveAttribute(
    "data-interaction-target",
    "about",
  );
  const metrics = await page.evaluate(async () => {
    const audit = (window as AuditWindow).__portfolioUniverseAudit!;
    const gl = document
      .querySelector<HTMLCanvasElement>("[data-universe-renderer]")!
      .getContext("webgl2")!;
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
    );
    const times: number[] = [];
    let calls = 0;
    const stop = audit.subscribe((snapshot) => {
      times.push(performance.now());
      calls = Math.max(calls, snapshot.quality.drawCalls);
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    stop();
    const intervals = times
      .slice(1)
      .map((t, i) => t - times[i])
      .sort((a, b) => a - b);
    return {
      renderer,
      frames: times.length,
      p95: intervals[Math.floor(intervals.length * 0.95)] ?? Infinity,
      calls,
    };
  });
  await info.attach("hover-performance", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  expect(metrics.calls).toBeLessThanOrEqual(
    info.project.name === "mobile" ? 32 : 44,
  );
  if (!/swiftshader|software|llvmpipe|basic render/i.test(metrics.renderer)) {
    expect(metrics.frames).toBeGreaterThan(90);
    expect(metrics.p95).toBeLessThanOrEqual(
      info.project.name === "mobile" ? 34 : 25,
    );
  }
});

test("captures idle, hover, focus, and shooting-star states", async ({
  page,
}, info) => {
  test.skip(process.env.IVORY_CAPTURE !== "1");
  await open(page);
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(0),
  );
  await page.screenshot({
    path: info.outputPath("home-idle.png"),
    scale: "css",
  });
  for (const id of ["about", "projects", "travel"]) {
    const point = await pointFor(page, id);
    await page.mouse.move(point.x, point.y);
    await expect(page.locator(ROOT)).toHaveAttribute(
      "data-interaction-target",
      id === "travel" ? "earth" : id,
    );
    await page.screenshot({
      path: info.outputPath(`${id}-hover.png`),
      scale: "css",
    });
    await page.locator(`[data-universe-destination="${id}"]`).focus();
    await page.screenshot({
      path: info.outputPath(`${id}-focus.png`),
      scale: "css",
    });
    await page
      .locator(`[data-universe-destination="${id}"]`)
      .evaluate((node) => (node as HTMLElement).blur());
  }
  const point = await pointFor(page, "about");
  await page.mouse.move(point.x, point.y);
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(8000),
  );
  await page.screenshot({
    path: info.outputPath("nebula-folds.png"),
    scale: "css",
  });
  await page.mouse.move(2, 2);
  let time = 16000;
  while (!sampleShootingStar(time)) time += 20;
  await page.evaluate(
    (t) => (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(t),
    time + 500,
  );
  await page.screenshot({
    path: info.outputPath("shooting-star.png"),
    scale: "css",
  });
});

test("detail-page ambient light pauses offscreen and respects reduced motion", async ({
  page,
}) => {
  await page.goto("/projects/sightline");
  await expect(page.locator(WORLD)).toHaveAttribute("data-world-mode", "quiet");
  const read = () =>
    page.locator(".world-reading-wash").evaluate((node) => ({
      name: getComputedStyle(node, "::after").animationName,
      state: getComputedStyle(node, "::after").animationPlayState,
    }));
  expect((await read()).name).toBe("quiet-cloud-light");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect((await read()).state).toBe("paused");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await read()).name).toBe("none");
});
