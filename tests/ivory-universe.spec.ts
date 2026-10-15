import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { PortfolioUniverseRenderer } from "../src/lib/portfolio-universe/renderer";
import type { UniverseSceneId } from "../src/lib/portfolio-universe/state";

const ROOT = "[data-portfolio-universe]";
const WORLD = "[data-universe-world]";
const SCENES = ["home", "about", "projects", "travel"] as const;
const HEADINGS = {
  home: "#universe-home-title",
  about: "#universe-about-title",
  projects: "#project-sky-title",
  travel: "#universe-travel-title",
} as const;
// Every directed edge exactly once, returning to the original Home camera.
const JOURNEY = [
  "home",
  "about",
  "home",
  "projects",
  "home",
  "travel",
  "about",
  "projects",
  "about",
  "travel",
  "projects",
  "travel",
  "home",
] as const;
const PAIRS = JOURNEY.slice(1).map(
  (to, index) => [JOURNEY[index], to] as const,
);
const CAPTURE = process.env.IVORY_CAPTURE === "1";

test.use({
  video: CAPTURE && process.env.IVORY_STILL_FRAMES !== "1" ? "on" : "off",
});
type AuditWindow = Window & {
  __portfolioUniverseAudit?: PortfolioUniverseRenderer;
};

async function openUniverse(page: Page, scene: UniverseSceneId = "home") {
  await page.goto(`/?universeAudit=1#${scene}`);
  await expect(page.locator(ROOT)).toHaveAttribute("data-enhanced", "true");
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-webgl-ready",
    "true",
    { timeout: 30_000 },
  );
  await expect(page.locator(ROOT)).toHaveAttribute("data-webgl-ready", "true");
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-artwork-ready",
    "true",
  );
  await expect(page.locator(`#${scene}`)).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as AuditWindow).__portfolioUniverseAudit),
      ),
    )
    .toBe(true);
}

async function navigate(page: Page, scene: UniverseSceneId) {
  const navigation = page.getByRole("navigation", {
    name: "Primary",
    exact: true,
  });
  // These journeys begin with a closed menu; native link activation must close it again.
  if (page.viewportSize()!.width < 768)
    await navigation.getByLabel("Open navigation").click();
  await navigation.locator(`a[href="/#${scene}"]:visible`).click();
}

async function expectSettled(page: Page, scene: UniverseSceneId) {
  const expected = {
    hash: `#${scene}`,
    sceneActive: "true",
    phase: "",
    focused: true,
    worlds: 1,
    canvases: 1,
    scroll: 0,
    overflow: false,
    active: [scene],
  };
  // Poll the same coherent state in the browser, avoiding repeated protocol trips.
  const settled = await page.waitForFunction(
    ({ scene, heading, expected }) => {
      const state = {
        hash: location.hash,
        sceneActive: document.getElementById(scene)?.dataset.sceneActive,
        phase:
          document.querySelector<HTMLElement>("[data-portfolio-universe]")
            ?.dataset.transitionPhase ?? "",
        focused: document.activeElement === document.querySelector(heading),
        worlds: document.querySelectorAll("[data-universe-world]").length,
        canvases: document.querySelectorAll(
          "[data-universe-world] [data-universe-renderer]",
        ).length,
        scroll: scrollY,
        overflow: document.documentElement.scrollWidth > innerWidth,
        active: [
          ...document.querySelectorAll<HTMLElement>(
            "[data-portfolio-universe] > [data-universe-scene]",
          ),
        ]
          .filter((section) => !section.inert)
          .map((section) => section.id),
      };
      return JSON.stringify(state) === JSON.stringify(expected) ? state : false;
    },
    { scene, heading: HEADINGS[scene], expected },
    { timeout: 5_000 },
  );
  try {
    expect(await settled.jsonValue()).toEqual(expected);
  } finally {
    await settled.dispose();
  }
}

test.describe("complete camera journeys", () => {
  test("travels all twelve directed scene journeys at full speed", async ({
    page,
  }, testInfo) => {
    test.setTimeout(CAPTURE ? 180_000 : 100_000);
    await openUniverse(page);
    const instance = await page
      .locator(WORLD)
      .getAttribute("data-world-instance");
    const results: {
      from: string;
      to: string;
      durationMs: number;
      frames: number;
    }[] = [];
    for (const [from, to] of PAIRS) {
      await test.step(`${from} → ${to}`, async () => {
        await page.evaluate(() =>
          (window as AuditWindow).__portfolioUniverseAudit!.clearFrameLog(),
        );
        await navigate(page, to);
        await expectSettled(page, to);
        const samples = await page.evaluate((destination) => {
          const audit = (window as AuditWindow).__portfolioUniverseAudit!;
          const settled = audit.getSnapshot();
          return {
            frames: audit
              .getFrameLog()
              .filter((frame) => frame.flight?.to === destination)
              .map((frame) => ({
                flight: {
                  to: frame.flight!.to,
                  durationMs: frame.flight!.durationMs,
                  progress: frame.flight!.progress,
                },
              })),
            settled: {
              flight: settled.flight,
              activeScene: settled.activeScene,
            },
          };
        }, to);
        const frames = samples.frames.filter(
          (frame) => frame.flight?.to === to,
        );
        expect(
          frames.length,
          `${from} → ${to} rendered flight`,
        ).toBeGreaterThan(2);
        const durations = [
          ...new Set(frames.map((frame) => frame.flight!.durationMs)),
        ];
        expect(durations).toHaveLength(1);
        const narrow = page.viewportSize()!.width <= 700;
        expect(durations[0]).toBeGreaterThanOrEqual(narrow ? 1_400 : 1_500);
        expect(durations[0]).toBeLessThanOrEqual(narrow ? 1_800 : 1_900);
        const progress = frames.map((frame) => frame.flight!.progress);
        expect(
          progress.every(
            (value, index) =>
              value >= 0 &&
              value <= 1 &&
              (index === 0 || value >= progress[index - 1]),
          ),
        ).toBe(true);
        expect(progress.at(-1)).toBeGreaterThanOrEqual(0.999);
        expect(samples.settled.flight).toBeNull();
        expect(samples.settled.activeScene).toBe(to);
        await expect(page.locator(WORLD)).toHaveAttribute(
          "data-world-instance",
          instance!,
        );
        results.push({
          from,
          to,
          durationMs: durations[0],
          frames: frames.length,
        });
      });
    }
    expect(new Set(results.map(({ from, to }) => `${from}:${to}`)).size).toBe(
      12,
    );
    await testInfo.attach("journey-measurements", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
  });
});

test("captures exact quarter-progress views for every directed journey", async ({
  page,
}, testInfo) => {
  test.skip(
    !CAPTURE,
    "Set IVORY_CAPTURE=1 to produce the visual acceptance artifacts.",
  );
  test.setTimeout(180_000);
  await openUniverse(page);
  await navigate(page, "travel");
  await expectSettled(page, "travel");
  await navigate(page, "home");
  await expectSettled(page, "home");
  for (const [from, to] of PAIRS) {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      await page.evaluate(
        ({ from, to, progress }) => {
          const audit = (window as AuditWindow).__portfolioUniverseAudit!;
          audit.resume();
          audit.setEffectTime(0);
          audit.seekFlight(from, to, progress);
          audit.suspend();
        },
        { from, to, progress },
      );
      const name = `${from}-to-${to}-${String(progress * 100).padStart(3, "0")}`;
      const screenshot = await page.screenshot({
        path: testInfo.outputPath(`${name}.png`),
        scale: "css",
        animations: "disabled",
      });
      await testInfo.attach(name, {
        body: screenshot,
        contentType: "image/png",
      });
    }
  }
});

test("an interrupted flight keeps camera continuity and focuses only the latest destination", async ({
  page,
}) => {
  await openUniverse(page);
  await navigate(page, "projects");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as AuditWindow).__portfolioUniverseAudit!.getSnapshot()
              .flight?.progress ?? -1,
        ),
      { intervals: [30] },
    )
    .toBeGreaterThan(0.08);
  const continuity = await page.evaluate(() => {
    const audit = (window as AuditWindow).__portfolioUniverseAudit!;
    const before = audit.getSnapshot();
    // A native anchor activation during flight exercises the same navigation handler.
    const target = document.querySelector<HTMLAnchorElement>(
      '.site-navigation a[href="/#about"]',
    )!;
    target.click();
    return { before, after: audit.getSnapshot() };
  });
  expect(continuity.before.flight?.to).toBe("projects");
  expect(continuity.after.flight?.to).toBe("about");
  expect(continuity.after.camera.position).toEqual(
    continuity.before.camera.position,
  );
  expect(continuity.after.camera.quaternion).toEqual(
    continuity.before.camera.quaternion,
  );
  await expectSettled(page, "about");
  await expect(page.locator(HEADINGS.projects)).not.toBeFocused();
  await page.evaluate(() =>
    document
      .querySelector<HTMLAnchorElement>('.site-navigation a[href="/#travel"]')!
      .click(),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expectSettled(page, "travel");
  expect(
    await page.evaluate(
      () =>
        (window as AuditWindow).__portfolioUniverseAudit!.getSnapshot().flight,
    ),
  ).toBeNull();
});

test("direct scene hashes and Back/Forward restore the correct active scene", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const scene of SCENES) {
    await openUniverse(page, scene);
    await expect(page.locator(ROOT)).toHaveAttribute(
      "data-active-scene",
      scene,
    );
    for (const other of SCENES.filter((candidate) => candidate !== scene)) {
      await expect(page.locator(`#${other}`)).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      expect(
        await page
          .locator(`#${other}`)
          .evaluate((section) => (section as HTMLElement).inert),
      ).toBe(true);
    }
  }
  await navigate(page, "home");
  await expectSettled(page, "home");
  await navigate(page, "about");
  await expectSettled(page, "about");
  await page.goBack();
  await expectSettled(page, "home");
  await page.goForward();
  await expectSettled(page, "about");
});

test("About cloud supports keyboard reveal and Escape", async ({ page }) => {
  await openUniverse(page, "about");
  const trigger = page.locator('[data-cloud-toggle="hobbies"]');
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.locator('[data-floating-item="photography"]'),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("a missing decorative world image preserves composition bounds and navigation", async ({
  page,
}) => {
  await page.route(
    /\/media\/site\/celestial\/marble-planet-\d+\.webp(?:\?.*)?$/,
    (route) => route.abort(),
  );
  await openUniverse(page);
  const planet = page.locator('[data-world-plane="planet"]');
  expect(
    await planet.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBe(0);
  const bounds = await planet.evaluate((image) => {
    const { width, height } = image.getBoundingClientRect();
    return { width, height };
  });
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.height).toBeGreaterThan(0);
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-artwork-failed-count",
    "1",
  );
  await navigate(page, "projects");
  await expectSettled(page, "projects");
  await expect(
    page.locator('[data-project-id="sightline"] [data-project-constellation]'),
  ).toBeVisible();
});

test("WebGL failure keeps DOM world planes and immediate semantic scene navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (
        kind === "webgl" ||
        kind === "webgl2" ||
        kind === "experimental-webgl"
      )
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
  await expect(page.locator(ROOT)).toHaveAttribute(
    "data-renderer-type",
    "fallback",
  );
  await expect(page.locator(WORLD)).toHaveAttribute(
    "data-artwork-ready",
    "false",
  );
  await expect(page.locator("[data-world-depth-planes]")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.locator('[data-world-plane="planet"]')).toBeVisible();
  await expect(page.locator("[data-world-earth-fallback]")).toBeVisible();
  await expect(page.locator("[data-universe-renderer]")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await navigate(page, "about");
  await expectSettled(page, "about");
  await navigate(page, "travel");
  await expectSettled(page, "travel");
  await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
    "data-shared-earth",
    "false",
  );
});

test("without JavaScript all scene and project links retain native keyboard behavior", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    ...testInfo.project.use,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(page.locator(WORLD)).toHaveCount(1);
    await expect(page.locator(ROOT)).toHaveAttribute("data-enhanced", "false");
    const projects = page.locator('[data-universe-destination="projects"]');
    await projects.focus();
    await expect(projects).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#projects$/);
    await expect(page.locator("#projects")).toBeInViewport();
    const project = page.locator(
      '[data-project-constellation][href="/projects/sightline"]',
    );
    await expect(project).toHaveRole("link");
    await project.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/projects\/sightline\/?$/);
  } finally {
    await context.close();
  }
});
