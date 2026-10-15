import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { PortfolioUniverseRenderer } from "../src/lib/portfolio-universe/renderer";
import {
  createCompositionFrame,
  SCENE_MANIFEST,
} from "../src/lib/portfolio-universe/scene-manifest";
import {
  projectHomeRegions,
  regionLayout,
  type HomeRegionInputs,
} from "../src/lib/portfolio-universe/home-regions";

const ROOT = "[data-portfolio-universe]";
const WORLD = "[data-universe-world]";

async function compositionSnapshot(
  page: Page,
  scene: "home" | "about" | "projects" | "travel" = "home",
) {
  await page.mouse.move(0, 0);
  // Compare composition at the same ambient instant; background drift is
  // intentionally continuous while the camera travels between destinations.
  return page.evaluate(async (activeScene) => {
    (
      window as Window & {
        __portfolioUniverseAudit?: PortfolioUniverseRenderer;
      }
    ).__portfolioUniverseAudit?.setEffectTime(0);
    await document.fonts.ready;
    const sceneSelectors = {
      home: {
        heading: "#universe-home-title",
        introduction: ".universe-role",
        about: '[data-universe-destination="about"]',
        projects: '[data-universe-destination="projects"]',
        // The HTML Earth is a circular image; the GPU sphere has a projected
        // tangent ellipse. Its input contour follows the currently visible
        // silhouette, so it is checked separately from invariant copy bounds.
      },
      about: {
        heading: "#universe-about-title",
        introduction: ".about-heading",
        signals: "#about .about-clouds",
        hobbies: '[data-cloud-toggle="hobbies"]',
      },
      projects: {
        heading: "#project-sky-title",
        introduction: ".project-sky-heading",
        ...Object.fromEntries(
          [
            ...document.querySelectorAll<HTMLElement>(
              "#projects [data-project-id]",
            ),
          ].flatMap((project) => [
            [
              `project:${project.dataset.projectId}`,
              `#projects [data-project-id="${project.dataset.projectId}"]`,
            ],
            [
              `label:${project.dataset.projectId}`,
              `#projects [data-project-id="${project.dataset.projectId}"] .project-constellation-copy`,
            ],
          ]),
        ),
      },
      travel: {
        heading: "#universe-travel-title",
        introduction: ".atlas-heading",
        directory: ".travel-directory",
      },
    };
    const selectors = {
      ...sceneSelectors[activeScene],
      backdrop: "[data-world-backdrop]",
      earth: "[data-world-earth-fallback]",
      ...Object.fromEntries(
        [...document.querySelectorAll<HTMLElement>("[data-world-plane]")].map(
          (plane) => [
            plane.dataset.worldPlane!,
            `[data-world-plane="${plane.dataset.worldPlane}"]`,
          ],
        ),
      ),
    };
    return Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing composition element: ${name}`);
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return [
          name,
          {
            bounds: [bounds.x, bounds.y, bounds.width, bounds.height],
            opacity: style.opacity,
            visibility: style.visibility,
            fontSize: style.fontSize,
            color: style.color,
          },
        ] as const;
      }),
    );
  }, scene);
}

type Composition = Awaited<ReturnType<typeof compositionSnapshot>>;

async function expectEarthSilhouette(page: Page, sphere: boolean) {
  const inputs = await page
    .locator("[data-home-region-inputs]")
    .evaluate((node) => JSON.parse(node.textContent!) as HomeRegionInputs);
  const { width, height } = page.viewportSize()!;
  const frame = createCompositionFrame("home", width, height, SCENE_MANIFEST);
  const expected = regionLayout(
    projectHomeRegions(frame.project, frame.pose.position, inputs, sphere).find(
      (region) => region.id === "travel",
    )!,
  );
  const actual = await page
    .locator('[data-universe-destination="travel"]')
    .boundingBox();
  expect(actual).not.toBeNull();
  for (const [value, target] of [
    [actual!.x, expected.left],
    [actual!.y, expected.top],
    [actual!.width, expected.width],
    [actual!.height, expected.height],
  ])
    expect(Math.abs(value - target)).toBeLessThanOrEqual(1);
}

function expectSameComposition(actual: Composition, expected: Composition) {
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  const geometryFailures = Object.entries(expected).flatMap(
    ([name, original]) =>
      actual[name].bounds.flatMap((value: number, index: number) => {
        const difference = Math.abs(value - original.bounds[index]);
        return difference <= 1
          ? []
          : [
              {
                element: name,
                dimension: ["x", "y", "width", "height"][index],
                expected: original.bounds[index],
                actual: value,
                difference,
              },
            ];
      }),
  );
  expect(geometryFailures, "Every composition bound stays within 1px").toEqual(
    [],
  );
  // Alpha interpolation can settle a millionth away from its endpoint.
  // Keep a strict visual tolerance rather than comparing serialized floats.
  for (const [name, original] of Object.entries(expected)) {
    if (name === "backdrop" || name === "earth") continue;
    expect(Number(actual[name].opacity), `${name} opacity`).toBeCloseTo(
      Number(original.opacity),
      4,
    );
  }
  // The canvas replaces fallback artwork only after a complete frame. Its
  // geometry must match first paint, while visibility changes intentionally.
  const appearances = (composition: Composition) =>
    Object.fromEntries(
      Object.entries(composition).map(([name, value]) => [
        name,
        {
          ...value,
          bounds: undefined,
          opacity: undefined,
          ...(name === "backdrop" || name === "earth"
            ? { opacity: undefined, visibility: undefined }
            : {}),
        },
      ]),
    );
  expect(
    appearances(actual),
    "Every composition appearance is preserved",
  ).toEqual(appearances(expected));
}

async function expectOneWorld(page: Page, settled = false) {
  // These invariants are static once the caller's readiness gate has passed.
  // Read them together so tracing does not snapshot the full scene per field.
  const snapshot = await page.evaluate(
    ({ rootSelector, worldSelector }) => {
      const root = document.querySelector<HTMLElement>(rootSelector);
      const world = document.querySelector<HTMLElement>(worldSelector);
      const visible = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return false;
        const bounds = element.getBoundingClientRect();
        return (
          getComputedStyle(element).visibility === "visible" &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      };
      const opacity = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).opacity : null;
      };
      return {
        counts: {
          worlds: document.querySelectorAll(worldSelector).length,
          canvases: document.querySelectorAll("[data-universe-renderer]")
            .length,
          worldCanvases: document.querySelectorAll(
            `${worldSelector} [data-universe-renderer]`,
          ).length,
          planes: document.querySelectorAll("[data-world-plane]").length,
          mobilePlanes: document.querySelectorAll(
            '[data-world-plane][data-plane-mobile="true"]',
          ).length,
        },
        desktopPlanesHidden: [
          ...document.querySelectorAll('[data-plane-mobile="false"]'),
        ].every((plane) => getComputedStyle(plane).display === "none"),
        artworkReady: world?.dataset.artworkReady === "true",
        layerOpacity: opacity("[data-world-depth-planes]"),
        backdropOpacity: opacity("[data-world-backdrop]"),
        earthVisible: visible("[data-world-earth-fallback]"),
        canvasVisible: visible("[data-universe-renderer]"),
        backdropVisible: visible("[data-world-backdrop]"),
        fitsViewport: document.documentElement.scrollWidth <= innerWidth,
        readiness: {
          enhanced: root?.dataset.enhanced,
          worldWebgl: world?.dataset.webglReady,
          contentWebgl: root?.dataset.webglReady,
          artwork: world?.dataset.artworkReady,
          transitioning: Boolean(root?.dataset.transitionPhase),
        },
      };
    },
    { rootSelector: ROOT, worldSelector: WORLD },
  );
  expect(snapshot.counts).toEqual({
    worlds: 1,
    canvases: 1,
    worldCanvases: 1,
    planes: 40,
    mobilePlanes: 29,
  });
  if (page.viewportSize()!.width <= 700)
    expect(snapshot.desktopPlanesHidden).toBe(true);
  if (snapshot.artworkReady) {
    expect({
      layers: snapshot.layerOpacity,
      backdrop: snapshot.backdropOpacity,
      earthVisible: snapshot.earthVisible,
      canvasVisible: snapshot.canvasVisible,
    }).toEqual({
      layers: "0",
      backdrop: "0",
      earthVisible: false,
      canvasVisible: true,
    });
  } else {
    expect(snapshot.backdropVisible).toBe(true);
  }
  expect(snapshot.fitsViewport).toBe(true);
  if (settled)
    expect(snapshot.readiness).toEqual({
      enhanced: "true",
      worldWebgl: "true",
      contentWebgl: "true",
      artwork: "true",
      transitioning: false,
    });
}

async function waitForWorld(page: Page) {
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
  await expectOneWorld(page, true);
}

test("keeps the first world composition through delayed scripts, readiness, and refresh", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 700 });
  let releaseScripts!: () => void;
  const scriptsReleased = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "script") await scriptsReleased;
    await route.continue();
  });

  let firstPaint!: Composition;
  try {
    await page.goto("/?universeAudit=1", { waitUntil: "commit" });
    await expect(page.locator(ROOT)).toBeAttached();
    await expect(page.locator(ROOT)).toHaveAttribute("data-enhanced", "false");
    await expect(page.locator('[data-world-plane="planet"]')).toHaveCSS(
      "transform",
      /^matrix/,
    );
    await expectOneWorld(page);
    await expect(page.locator('[data-world-plane="planet"]')).toBeVisible();
    firstPaint = await compositionSnapshot(page);
    await expectEarthSilhouette(page, false);
    await page.evaluate(() => {
      const world = document.querySelector("[data-universe-world]")!;
      (
        window as Window & { __ivoryInitialNodes?: Element[] }
      ).__ivoryInitialNodes = [
        world,
        ...world.querySelectorAll(
          "[data-world-plane],[data-universe-renderer]",
        ),
      ];
    });
  } finally {
    releaseScripts();
  }

  await waitForWorld(page);
  expectSameComposition(await compositionSnapshot(page), firstPaint);
  await expectEarthSilhouette(page, true);
  expect(
    await page.evaluate(() => {
      const world = document.querySelector("[data-universe-world]")!;
      const original = (window as Window & { __ivoryInitialNodes?: Element[] })
        .__ivoryInitialNodes!;
      return [
        world,
        ...world.querySelectorAll(
          "[data-world-plane],[data-universe-renderer]",
        ),
      ].every((node, index) => node === original[index]);
    }),
  ).toBe(true);

  await page.reload();
  await waitForWorld(page);
  expectSameComposition(await compositionSnapshot(page), firstPaint);
  await expectEarthSilhouette(page, true);
});

test("returns to the same world composition after the Travel round trip", async ({
  page,
}) => {
  await page.goto("/?universeAudit=1");
  await waitForWorld(page);
  const original = await compositionSnapshot(page);
  const instance = await page
    .locator(WORLD)
    .getAttribute("data-world-instance");
  await page.locator('[data-universe-destination="travel"]').click();
  await expect(page.locator("#travel")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
    "data-shared-earth",
    "true",
  );
  await page.locator('#travel a[href="/#home"]').click();
  await expect(page.locator("#home")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await waitForWorld(page);
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-world-instance",
    instance!,
  );
  expectSameComposition(await compositionSnapshot(page), original);
  await expectEarthSilhouette(page, true);
});

for (const scene of ["about", "projects", "travel"] as const) {
  test(`direct ${scene} keeps its first-paint geometry through startup and refresh`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "mobile")
      await page.setViewportSize({ width: 320, height: 700 });
    let releaseScripts!: () => void;
    const scriptsReleased = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "script") await scriptsReleased;
      await route.continue();
    });
    let firstPaint!: Composition;
    try {
      await page.goto(`/?universeAudit=1#${scene}`, { waitUntil: "commit" });
      await expect(page.locator(ROOT)).toBeAttached();
      await expect(page.locator(ROOT)).toHaveAttribute(
        "data-enhanced",
        "false",
      );
      await expect(page.locator(`#${scene}`)).toBeVisible();
      await expect(page.locator(`#${scene}`)).toHaveCSS("position", "absolute");
      firstPaint = await compositionSnapshot(page, scene);
      if (scene === "travel")
        await expect(page.locator('[data-earth-pose="travel"]')).toHaveCSS(
          "display",
          "block",
        );
    } finally {
      releaseScripts();
    }
    await waitForWorld(page);
    await expect(page.locator(`#${scene}`)).toHaveAttribute(
      "data-scene-active",
      "true",
    );
    expectSameComposition(await compositionSnapshot(page, scene), firstPaint);
    if (scene === "travel") {
      await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
        "data-atlas-ready",
        "true",
      );
      // The arrival pose stays canonical; the live longitude now auto-spins
      // before the composition audit pins its animation clock.
      await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
        "data-atlas-route-rotation",
        "-108,-22,0",
      );
      const rotation = (await page
        .locator(WORLD)
        .getAttribute("data-earth-rotation"))!
        .split(",")
        .map(Number);
      expect(rotation[1]).toBe(-22);
      expect(rotation[2]).toBe(0);
    }
    await page.reload();
    await waitForWorld(page);
    expectSameComposition(await compositionSnapshot(page, scene), firstPaint);
  });
}

test("preserves the world and canvas across a case study and its return link", async ({
  page,
}) => {
  await page.goto("/#projects");
  await waitForWorld(page);
  const instance = await page
    .locator(WORLD)
    .getAttribute("data-world-instance");
  expect(instance).toMatch(/^[0-9a-f-]{36}$/i);
  await page.evaluate(() => {
    const world = document.querySelector("[data-universe-world]")!;
    (
      window as Window & { __ivoryPersistentNodes?: Element[] }
    ).__ivoryPersistentNodes = [world, world.querySelector("canvas")!];
  });
  await page
    .locator('[data-project-id="sightline"] [data-project-constellation]')
    .click();
  await expect(page).toHaveURL(/\/projects\/sightline\/?$/);
  await expect(page.locator(WORLD)).toHaveAttribute("data-world-mode", "quiet");
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-renderer-suspended",
    "true",
  );
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-world-instance",
    instance!,
  );
  expect(
    await page.evaluate(() => {
      const nodes = (window as Window & { __ivoryPersistentNodes?: Element[] })
        .__ivoryPersistentNodes;
      return Boolean(
        nodes &&
        nodes[0] === document.querySelector("[data-universe-world]") &&
        nodes[1] === document.querySelector("[data-universe-renderer]"),
      );
    }),
  ).toBe(true);

  const returnLink = page.locator('main a[href="/#projects"]').first();
  await expect(returnLink).toBeVisible();
  await returnLink.click();
  await expect(page).toHaveURL(/\/#projects$/);
  await waitForWorld(page);
  await expect(page.locator("#projects")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-world-mode",
    "universe",
  );
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-renderer-suspended",
    "false",
  );
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-world-instance",
    instance!,
  );
  expect(
    await page.evaluate(() => {
      const nodes = (window as Window & { __ivoryPersistentNodes?: Element[] })
        .__ivoryPersistentNodes;
      return Boolean(
        nodes &&
        nodes[0] === document.querySelector("[data-universe-world]") &&
        nodes[1] === document.querySelector("[data-universe-renderer]"),
      );
    }),
  ).toBe(true);
});
