import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

type CityFixture = {
  id: string;
  name: string;
  regionKey: string;
  samplePhotoIds: string[];
};
type RegionFixture = { key: string; country: string; id: string };
type ManifestFixture = { id: string; country: string; region: string };

function readFixture<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  ) as T;
}

const photographyConfig = readFixture<{
  cities: CityFixture[];
  regions: RegionFixture[];
}>("../src/config/photography.json");
const photographyManifest = readFixture<ManifestFixture[]>(
  "../src/data/photography-manifest.json",
);
const regionByKey = new Map(
  photographyConfig.regions.map((region) => [region.key, region]),
);

function cityCountry(city: CityFixture) {
  const country = regionByKey.get(city.regionKey)?.country;
  if (!country) throw new Error(`Missing country for city ${city.id}.`);
  return country;
}

function cityRoute(city: CityFixture) {
  return `/photography/${cityCountry(city)}/${city.id}`;
}

const countries = [
  ...new Set(photographyManifest.map((photo) => photo.country)),
];
const projectRoutes = [
  "/projects/sightline",
  "/projects/sleep-wake-model",
  "/projects/robotic-card-thrower",
];
const detailRoutes = [
  ...projectRoutes,
  ...countries.map((country) => `/photography/${country}`),
  ...photographyConfig.cities.map(cityRoute),
];

test("the root document contains all four semantic destinations", async ({
  request,
}) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(response.ok()).toBe(true);
  for (const scene of ["home", "about", "projects", "travel"])
    expect(html).toContain(`data-universe-scene="${scene}"`);
  for (const route of projectRoutes) expect(html).toContain(`href="${route}"`);
  expect(
    (html.match(/data-universe-world=/g) ?? []).length,
  ).toBeLessThanOrEqual(1);
});

test("primary navigation stays transparent with a readable mobile menu", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator("[data-portfolio-universe]")).toHaveAttribute(
    "data-enhanced",
    "true",
  );
  await expect(page.locator(".site-navigation")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  if (testInfo.project.name === "mobile") {
    await page.getByLabel("Open navigation").click();
    const menu = page.locator(".mobile-navigation > div");
    await expect(menu).toBeVisible();
    const readability = await menu.evaluate((element) => {
      const rgba = (color: string) => {
        const values = color.match(/[\d.]+/g)?.map(Number);
        if (!/^rgba?\(/.test(color) || !values || values.length < 3)
          throw new Error(`Unsupported computed menu color: ${color}`);
        return [values[0], values[1], values[2], values[3] ?? 1] as const;
      };
      const luminance = (color: readonly number[]) => {
        const linear = color.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      };
      const background = rgba(getComputedStyle(element).backgroundColor);
      // A black scene underneath gives this light translucent menu its
      // darkest background; check every link, including the active accent.
      const composited = background
        .slice(0, 3)
        .map((channel) => channel * background[3]);
      const backgroundLuminance = luminance(composited);
      return {
        alpha: background[3],
        links: [...element.querySelectorAll("a")].map((link) => {
          const foreground = rgba(getComputedStyle(link).color);
          const foregroundLuminance = luminance(
            foreground
              .slice(0, 3)
              .map(
                (channel, index) =>
                  channel * foreground[3] +
                  composited[index] * (1 - foreground[3]),
              ),
          );
          return {
            label: link.textContent?.trim(),
            contrast:
              (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
              (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
          };
        }),
      };
    });
    expect(readability.alpha).toBeGreaterThanOrEqual(0.9);
    expect(readability.links).not.toHaveLength(0);
    for (const link of readability.links)
      expect(
        link.contrast,
        `${link.label} menu contrast`,
      ).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Open navigation")).toBeFocused();
  }
});

test("legacy index routes retain their universe destinations", async ({
  page,
}) => {
  for (const [route, hash] of [
    ["/projects", "projects"],
    ["/photography", "travel"],
  ]) {
    await page.goto(route);
    // Static meta-refresh redirects commit their URL before the destination HTML finishes parsing.
    await page.waitForURL(new RegExp(`#${hash}$`), {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(new RegExp(`#${hash}$`));
    await expect(
      page.locator(`section[data-universe-scene="${hash}"]`),
    ).toBeVisible();
  }
});

test("the atlas uses projected labels and country selection opens a preview", async ({
  page,
}) => {
  await page.goto("/?universeAudit=1#travel");
  const atlas = page.locator("[data-atlas-launcher]");
  await expect(page.locator("[data-universe-world]")).toHaveAttribute(
    "data-artwork-ready",
    "true",
    { timeout: 30_000 },
  );
  await expect(atlas).toHaveAttribute("data-atlas-ready", "true");
  await expect(atlas).toHaveAttribute("data-atlas-label-layout", "projected");
  const label = atlas
    .locator('[data-atlas-country][data-visible="true"]')
    .first();
  await expect(label).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const slug = await label.getAttribute("data-atlas-country");
  await label.focus();
  await expect(label).toBeFocused();
  await page.keyboard.press("Enter");
  const panel = page.locator(`[data-scene-panel="country-preview-${slug}"]`);
  await expect(panel).toBeVisible();
  await expect(panel.locator(`a[href="/photography/${slug}"]`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(label).toBeFocused();
});

test("dragging the shared globe updates its geographic labels within the test budget", async ({
  page,
}) => {
  await page.goto("/?universeAudit=1#travel");
  // Atlas setup awaits the shared renderer. Use the same cold-start gate as
  // the renderer suites before measuring pointer interaction readiness.
  const world = page.locator("[data-universe-world]");
  await expect(world).toHaveAttribute("data-webgl-ready", "true", {
    timeout: 30_000,
  });
  const atlas = page.locator("[data-atlas-launcher]");
  await expect(atlas).toHaveAttribute("data-atlas-ready", "true");
  await expect(atlas).toHaveAttribute("data-atlas-active", "true");
  const rect = await page.evaluate(() => {
    const audit = (
      window as Window & {
        __portfolioUniverseAudit?: {
          getAtlasEarthBridge: () => {
            getGlobeRect: () => {
              left: number;
              top: number;
              width: number;
              height: number;
            };
          };
        };
      }
    ).__portfolioUniverseAudit;
    return audit?.getAtlasEarthBridge().getGlobeRect();
  });
  expect(rect).toBeTruthy();
  if (!rect) throw new Error("Missing globe bounds");
  const drag = await page.evaluate((globe) => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "[data-atlas-canvas]",
    );
    if (!canvas) throw new Error("Missing atlas drag surface");
    // City links can cover the globe's center. Find an exposed path on its surface.
    const centerX = globe.left + globe.width / 2;
    const centerY = globe.top + globe.height / 2;
    const radius = Math.min(globe.width, globe.height) / 2;
    for (const ny of [0.5, 0.35, 0.65]) {
      for (const nx of [0.25, 0.35, 0.5, 0.65]) {
        const x = globe.left + globe.width * nx;
        const y = globe.top + globe.height * ny;
        const endX = x + 45;
        const endY = y + 8;
        const clear = [0, 0.25, 0.5, 0.75, 1].every((progress) => {
          const pointX = x + (endX - x) * progress;
          const pointY = y + (endY - y) * progress;
          return (
            Math.hypot(pointX - centerX, pointY - centerY) < radius * 0.85 &&
            document.elementFromPoint(pointX, pointY) === canvas
          );
        });
        if (clear) return { x, y, endX, endY };
      }
    }
    throw new Error(
      "The globe has no exposed canvas path for a real pointer drag",
    );
  }, rect);
  const before = await world.getAttribute("data-earth-rotation");
  await page.mouse.move(drag.x, drag.y);
  await page.mouse.down();
  try {
    await expect(page.locator("[data-atlas-canvas]")).toHaveAttribute(
      "data-dragging",
      "true",
    );
    await page.mouse.move(drag.endX, drag.endY, { steps: 5 });
  } finally {
    await page.mouse.up();
  }
  await expect(world).not.toHaveAttribute("data-earth-rotation", before!);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("the universe and detail routes avoid horizontal overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/", ...detailRoutes]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      route,
    ).toBeLessThanOrEqual(1);
  }
});

test("all four destinations fit a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const scene of ["home", "about", "projects", "travel"]) {
    await page.goto(`/#${scene}`);
    await expect(
      page.locator(`section[data-universe-scene="${scene}"]`),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("every country publishes sample callouts and city links", async ({
  request,
}) => {
  for (const country of countries) {
    const response = await request.get(`/photography/${country}`);
    expect(response.ok(), country).toBeTruthy();
    const html = await response.text();
    const cities = photographyConfig.cities.filter(
      (city) => cityCountry(city) === country,
    );
    expect((html.match(/class="country-map-callout"/g) ?? []).length).toBe(
      cities.length,
    );
    for (const city of cities) {
      expect(html).toContain(`href="${cityRoute(city)}"`);
      for (const sampleId of city.samplePhotoIds)
        expect(html).toContain(sampleId);
    }
    expect(html).not.toContain("reconstruction");
    expect(html).not.toContain("Cesium");
  }
});

test("every manifest photograph appears exactly once across city galleries", async ({
  request,
}) => {
  const rendered: string[] = [];
  for (const city of photographyConfig.cities) {
    const response = await request.get(cityRoute(city));
    expect(response.ok(), city.id).toBeTruthy();
    const html = await response.text();
    rendered.push(
      ...[...html.matchAll(/<figure data-manifest-id="([^"]+)"/g)].map(
        (match) => match[1],
      ),
    );
    expect(html).not.toContain("data-city-map-experience");
    expect(html).not.toContain("scene.json");
  }
  expect(rendered).toHaveLength(photographyManifest.length);
  expect(new Set(rendered).size).toBe(rendered.length);
  expect(rendered.sort()).toEqual(
    photographyManifest.map((photo) => photo.id).sort(),
  );
});

test("city lightboxes retain keyboard navigation and focus restoration", async ({
  page,
}) => {
  const city =
    photographyConfig.cities.find((entry) =>
      photographyManifest.some((photo) => photo.region === entry.id),
    ) ?? photographyConfig.cities[0];
  await page.goto(cityRoute(city));
  const firstPhoto = page.locator(".city-lightbox-trigger").first();
  await firstPhoto.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".city-lightbox")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(firstPhoto).toBeFocused();
});

test("removed Sightline implementation routes remain private", async ({
  request,
}) => {
  for (const route of [
    "/projects/photograph-locator",
    "/photography/calibrate",
    "/photography/auto-calibration",
    `/photography/${cityCountry(photographyConfig.cities[0])}/${photographyConfig.cities[0].id}/scene.json`,
  ]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(404);
  }
});
