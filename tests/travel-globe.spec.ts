import { expect, test, type Page } from "@playwright/test";
import type { PortfolioUniverseRenderer } from "../src/lib/portfolio-universe/renderer";
import type { PhotographyAtlasController } from "../src/lib/photography-atlas/controller";

const WORLD = "[data-universe-world]";
const ATLAS = "[data-atlas-launcher]";
type TravelWindow = Window & {
  __portfolioUniverseAudit?: PortfolioUniverseRenderer;
  __photographyAtlasController?: PhotographyAtlasController;
  __spinResumeMeasurement?: Promise<{
    beforeDeadline: number;
    afterDeadline: number;
  }>;
};

async function openTravel(page: Page) {
  await page.goto("/?universeAudit=1#travel");
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-artwork-ready",
    "true",
    { timeout: 30_000 },
  );
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-atlas-active",
    "true",
  );
}

test("country emphasis avoids base texture uploads and long synchronous tasks", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTravel(page);
  const profile = await page.evaluate(async () => {
    const bridge = (
      window as TravelWindow
    ).__portfolioUniverseAudit!.getAtlasEarthBridge()!;
    const countries = [
      ...document.querySelectorAll<HTMLElement>("[data-atlas-country]"),
    ].map((node) => node.dataset.atlasCountry!);
    const samples: number[] = [];
    const before = document.querySelector<HTMLElement>("[data-universe-world]")!
      .dataset.earthBaseTextureVersion;
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const country of [...countries, null]) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const start = performance.now();
        bridge.setCountryEmphasis(country);
        samples.push(performance.now() - start);
      }
    }
    return {
      samples,
      maxMs: Math.max(...samples),
      before,
      after: document.querySelector<HTMLElement>("[data-universe-world]")!
        .dataset.earthBaseTextureVersion,
    };
  });
  await testInfo.attach("hover-profile", {
    body: JSON.stringify(profile),
    contentType: "application/json",
  });
  console.log("HOVER_PROFILE", JSON.stringify(profile));
  if (process.env.TRAVEL_BASELINE !== "1") {
    expect(profile.before).toBeDefined();
    expect(profile.after).toBe(profile.before);
    expect(profile.maxMs).toBeLessThan(50);
  }
});

async function rotationOver(page: Page, duration: number) {
  return page.evaluate(async (duration) => {
    const bridge = (
      window as TravelWindow
    ).__portfolioUniverseAudit!.getAtlasEarthBridge()!;
    const start = bridge.getRotation()[0];
    const began = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () =>
        performance.now() - began >= duration
          ? resolve()
          : requestAnimationFrame(tick);
      requestAnimationFrame(tick);
    });
    return bridge.getRotation()[0] - start;
  }, duration);
}

test("Home keeps rotating under pointer and keyboard focus and respects reduced motion", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?universeAudit=1#home");
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-artwork-ready",
    "true",
    { timeout: 30_000 },
  );
  const earth = page.locator('[data-universe-destination="travel"]');
  await earth.focus();
  expect(await rotationOver(page, 500)).toBeGreaterThan(0.4);
  if (!isMobile) {
    await earth.hover();
    expect(await rotationOver(page, 500)).toBeGreaterThan(0.4);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await rotationOver(page, 350)).toBe(0);
  await expect(earth).toBeFocused();
});

test("auto-spin continues through hover, focus, dragging and previews", async ({
  page,
  isMobile,
}) => {
  await openTravel(page);
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-atlas-overlays-ready",
    "true",
  );
  expect(await rotationOver(page, 700)).toBeGreaterThan(0.5);
  const country = page.locator('[data-atlas-country="china"]');
  await country.focus();
  expect(await rotationOver(page, 350)).toBeGreaterThan(0.2);
  if (!isMobile) {
    const bounds = (await country.boundingBox())!;
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    expect(await rotationOver(page, 350)).toBeGreaterThan(0.2);
  }
  // The label intentionally keeps moving: click its current center without
  // Playwright's stationary-element wait, just as a visitor would.
  const countryBounds = (await country.boundingBox())!;
  await page.mouse.click(
    countryBounds.x + countryBounds.width / 2,
    countryBounds.y + countryBounds.height / 2,
  );
  await expect(page.locator("dialog[open]")).toBeVisible();
  expect(await rotationOver(page, 400)).toBeGreaterThan(0.2);
  await page.keyboard.press("Escape");
  await expect(country).toBeFocused();
  const canvas = page.locator("[data-atlas-launcher] canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  expect(await rotationOver(page, 350)).toBeGreaterThan(0.2);
  await page.mouse.move(
    box.x + box.width / 2 + 35,
    box.y + box.height / 2 + 5,
    { steps: 4 },
  );
  await page.mouse.up();
  expect(await rotationOver(page, 350)).toBeGreaterThan(0.2);
});

test("hidden countries focus into view and never leave back-side labels or markers", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTravel(page);
  expect(await rotationOver(page, 250)).toBe(0);
  for (const slug of ["united-states", "china", "canada", "taiwan"]) {
    const country = page.locator(`[data-atlas-country="${slug}"]`);
    await country.focus();
    await expect(country).toHaveAttribute("data-visible", "true");
    const violations = await page.evaluate(() => {
      const bridge = (
        window as TravelWindow
      ).__portfolioUniverseAudit!.getAtlasEarthBridge()!;
      const countries = JSON.parse(
        document.querySelector("[data-atlas-countries]")!.textContent!,
      ) as {
        slug: string;
        longitude: number;
        latitude: number;
        cities: { id: string; longitude: number; latitude: number }[];
      }[];
      return countries.flatMap((country) => {
        const anchors = [
          {
            selector: `[data-atlas-country="${country.slug}"]`,
            longitude: country.longitude,
            latitude: country.latitude,
          },
          ...country.cities.map((city) => ({
            ...city,
            selector: `[data-atlas-city="${city.id}"]`,
          })),
        ];
        return anchors.flatMap((anchor) => {
          const projected = bridge.projectCoordinate([
            anchor.longitude,
            anchor.latitude,
          ]);
          const node = document.querySelector<HTMLElement>(anchor.selector)!;
          if (projected?.visible) return [];
          return node.dataset.visible !== "false" ||
            getComputedStyle(node).opacity !== "0" ||
            getComputedStyle(node).pointerEvents !== "none"
            ? [anchor.selector]
            : [];
        });
      });
    });
    expect(violations).toEqual([]);
  }
});

test("departure hides overlays synchronously and interrupted arrivals cannot reveal them", async ({
  page,
}) => {
  await openTravel(page);
  const departure = await page.evaluate(() => {
    document
      .querySelector<HTMLAnchorElement>(
        'nav[aria-label="Primary"] a[href="/#home"]',
      )!
      .click();
    const atlas = document.querySelector<HTMLElement>("[data-atlas-launcher]")!;
    return {
      ready: atlas.dataset.atlasOverlaysReady,
      opacity: getComputedStyle(atlas.querySelector(".atlas-country-labels")!)
        .opacity,
    };
  });
  expect(departure).toEqual({ ready: "false", opacity: "0" });
  for (const scene of ["travel", "projects", "travel", "about"]) {
    await page.evaluate(
      (scene) =>
        document
          .querySelector<HTMLAnchorElement>(
            `nav[aria-label="Primary"] a[href="/#${scene}"]`,
          )!
          .click(),
      scene,
    );
    await expect(page.locator(ATLAS)).toHaveAttribute(
      "data-atlas-overlays-ready",
      "false",
    );
  }
  await expect(page.locator("[data-portfolio-universe]")).not.toHaveAttribute(
    "data-transition-phase",
    /.+/,
  );
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-atlas-overlays-ready",
    "false",
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLAnchorElement>(
        'nav[aria-label="Primary"] a[href="/#travel"]',
      )!
      .click(),
  );
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-atlas-overlays-ready",
    "true",
    { timeout: 10_000 },
  );
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-atlas-spinning",
    "true",
  );
  await page.goBack();
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-atlas-overlays-ready",
    "false",
  );
  await page.goForward();
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-atlas-overlays-ready",
    "true",
  );
});

test("drag keeps momentum and borders remain registered to the globe", async ({
  page,
}, testInfo) => {
  await openTravel(page);
  const point = await page.evaluate(() =>
    (window as TravelWindow)
      .__portfolioUniverseAudit!.getAtlasEarthBridge()!
      .projectCoordinate([108, 0]),
  );
  expect(point?.visible).toBe(true);
  await page.mouse.move(point!.clientX, point!.clientY);
  await page.mouse.down();
  await page.mouse.move(point!.clientX + 110, point!.clientY + 20, {
    steps: 10,
  });
  await page.mouse.up();
  await page.mouse.move(5, 120);
  expect(await rotationOver(page, 250)).toBeGreaterThan(0);
  await page.locator('[data-atlas-country="china"]').focus();
  if (process.env.TRAVEL_CAPTURE === "1")
    await page.screenshot({
      path: testInfo.outputPath("travel-highlight.png"),
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("hidden tabs suspend rotation without a catch-up jump", async ({
  page,
}) => {
  await openTravel(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await rotationOver(page, 350)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const delta = await rotationOver(page, 350);
  expect(delta).toBeGreaterThan(0);
  expect(delta).toBeLessThan(2);
});

test("canvas fallback at 320px keeps spinning with focus and preserves country navigation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (["webgl", "webgl2", "experimental-webgl"].includes(kind)) return null;
      return original.apply(this, [kind, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  await page.goto("/?universeAudit=1#travel");
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-shared-earth",
    "false",
    { timeout: 30_000 },
  );
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-atlas-spinning",
    "true",
  );
  const country = page.locator('[data-atlas-country="china"]');
  await country.focus();
  await expect(page.locator(ATLAS)).toHaveAttribute(
    "data-atlas-spinning",
    "true",
  );
  await expect(country).toHaveAttribute("data-visible", "true");
  if (process.env.TRAVEL_CAPTURE === "1")
    await page.screenshot({
      path: testInfo.outputPath("travel-canvas-320.png"),
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Enter");
  const panel = page.locator("dialog[open]");
  await expect(panel).toBeVisible();
  await panel.locator('a[href="/photography/china"]').click();
  await expect(page).toHaveURL(/\/photography\/china\/?$/);
});
