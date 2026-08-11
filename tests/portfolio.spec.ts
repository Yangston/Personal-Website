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
type CosmicVisual = {
  kind: "home" | "route" | "flight" | "atlas";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};
type CosmicSample = {
  phase: string | null;
  viewportWidth: number;
  viewportHeight: number;
  visuals: CosmicVisual[];
};
type EarthRect = Pick<CosmicVisual, "x" | "y" | "width" | "height">;

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
const publicRoutes = [
  "/",
  "/projects",
  "/projects/sleep-wake-model",
  "/projects/robotic-card-thrower",
  "/photography",
  ...countries.map((country) => `/photography/${country}`),
  ...photographyConfig.cities.map(cityRoute),
];

test("all public routes render without horizontal overflow", async ({
  page,
}) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page, route).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});

test("primary navigation works with the keyboard", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile) {
    const menu = page.locator("details.mobile-navigation");
    const toggle = menu.locator("summary");
    await toggle.click();
    await expect(menu).toHaveAttribute("open", "");
    await expect(menu.locator('a[href="/photography"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open", "");
    await expect(toggle).toBeFocused();
  } else {
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible();
  }
});

test("projects are presented as distinct keyboard-reachable constellations", async ({
  page,
  isMobile,
}) => {
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "Things I’ve built." }),
  ).toBeVisible();

  const constellations = page.locator("[data-project-constellation]");
  await expect(constellations).toHaveCount(2);
  await expect(constellations.first()).toHaveAttribute(
    "href",
    "/projects/robotic-card-thrower",
  );
  await expect(page.locator(".project-constellation-number")).toHaveCount(0);
  await expect(page.locator(".project-constellation-motif")).toHaveCount(0);
  for (const [motif, starCount] of [
    ["sleep signal", 8],
    ["poker dealer", 13],
  ] as const) {
    const constellation = page.locator(`[data-project-motif="${motif}"]`);
    await expect(constellation).toHaveCount(1);
    await expect(
      constellation.locator(".constellation-stars circle"),
    ).toHaveCount(starCount);
  }

  const boxes = await constellations.evaluateAll((items) =>
    items.map((item) => {
      const { left, right, top, bottom } = item.getBoundingClientRect();
      return { left, right, top, bottom };
    }),
  );
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    pageHeight: document.documentElement.scrollHeight,
  }));
  expect(viewport.pageHeight).toBeGreaterThan(viewport.height);
  const heading = page.locator(".project-sky-heading");
  const headingBox = await heading.boundingBox();
  await expect(heading).toHaveCSS("position", "fixed");
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(viewport.width * 0.14);
  }
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].top).toBeGreaterThan(boxes[index - 1].top);
    expect(boxes[index].top - boxes[index - 1].bottom).toBeLessThanOrEqual(
      viewport.height * 0.08,
    );
  }
  for (let index = 0; index < boxes.length; index += 1) {
    for (
      let comparison = index + 1;
      comparison < boxes.length;
      comparison += 1
    ) {
      const first = boxes[index];
      const second = boxes[comparison];
      expect(
        first.right <= second.left ||
          second.right <= first.left ||
          first.bottom <= second.top ||
          second.bottom <= first.top,
      ).toBe(true);
    }
  }
  if (!isMobile) {
    expect(boxes[0].top).toBeLessThanOrEqual(headingBox?.y ?? 0);
  }

  const firstSummary = constellations
    .first()
    .locator(".project-constellation-summary");
  await expect(
    firstSummary.locator(".project-constellation-preview-image"),
  ).toHaveAttribute("src", "/media/projects/robotic-card-thrower.svg");
  expect(
    await firstSummary.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(14);
  await expect(firstSummary).toHaveCSS("opacity", "0");
  if (!isMobile) {
    await constellations.first().hover();
    await expect(firstSummary).toHaveCSS("opacity", "1");
    const [summaryBox, constellationBox, fixedHeadingBox] = await Promise.all([
      firstSummary.boundingBox(),
      constellations.first().boundingBox(),
      heading.boundingBox(),
    ]);
    expect((summaryBox?.x ?? 0) + (summaryBox?.width ?? 0)).toBeLessThan(
      constellationBox?.x ?? 0,
    );
    await constellations.first().focus();
    await page.evaluate(() => {
      const heading = document.querySelector(".project-sky-heading");
      if (!heading) return;
      const headingBottom = heading.getBoundingClientRect().bottom + scrollY;
      scrollTo(0, headingBottom + 40);
    });
    const [scrolledHeadingBox, scrolledSummaryBox] = await Promise.all([
      heading.boundingBox(),
      firstSummary.boundingBox(),
    ]);
    expect(
      Math.abs((scrolledHeadingBox?.y ?? 0) - (fixedHeadingBox?.y ?? 0)),
    ).toBeLessThan(1);
    expect(
      Math.abs((scrolledSummaryBox?.y ?? 0) - (summaryBox?.y ?? 0)),
    ).toBeLessThan(1);
  }

  await constellations.first().focus();
  await expect(constellations.first()).toBeFocused();
  await expect(firstSummary).toHaveCSS("opacity", "1");
  expect(
    await constellations
      .first()
      .locator(".project-constellation-title")
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
  ).toBeLessThan(40);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/projects\/robotic-card-thrower$/);
});

test("new project case studies retain the cosmic editorial theme", async ({
  page,
}) => {
  const cases = [
    {
      route: "/projects/sleep-wake-model",
      title: "Sleep–Wake Model",
      section: "A model that travels between devices",
    },
    {
      route: "/projects/robotic-card-thrower",
      title: "Poker Bot",
      section: "Feed, aim, launch",
    },
  ] as const;

  for (const project of cases) {
    await page.goto(project.route);
    await expect(page.locator("[data-cosmic-backdrop]")).toHaveAttribute(
      "data-scene",
      "projects",
    );
    await expect(
      page.getByRole("heading", { name: project.title, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: project.section, level: 2 }),
    ).toBeVisible();
    await expect(
      page.locator("[data-project-case-study] figure img"),
    ).toHaveAttribute("src", /\/media\/projects\/.+\.svg$/);
    await expect(
      page.getByRole("link", { name: /Project observatory/ }),
    ).toBeVisible();
  }
});

test("project case studies use a readable editorial layout", async ({
  page,
  isMobile,
}) => {
  await page.goto("/projects/sleep-wake-model");

  const techStack = page.locator(".project-case-tech");
  await expect(techStack.locator("dt")).toHaveText("Tech stack");
  await expect(techStack.locator("li")).toHaveCount(4);
  await expect(page.getByText("Signal stack", { exact: true })).toHaveCount(0);

  const metrics = await page.evaluate(() => {
    const heroTitle = document.querySelector<HTMLElement>(
      ".project-case-title h1",
    );
    const intro = document.querySelector<HTMLElement>(".project-case-intro");
    const cover = document.querySelector<HTMLElement>(".project-case-cover");
    const body = document.querySelector<HTMLElement>(".project-case-body");
    const sectionTitle = document.querySelector<HTMLElement>(
      ".project-case-copy h2",
    );
    const paragraph = document.querySelector<HTMLElement>(
      ".project-case-copy p",
    );
    if (!heroTitle || !intro || !cover || !body || !sectionTitle || !paragraph)
      return null;
    return {
      heroTitleSize: Number.parseFloat(getComputedStyle(heroTitle).fontSize),
      sectionTitleSize: Number.parseFloat(
        getComputedStyle(sectionTitle).fontSize,
      ),
      paragraphColor: getComputedStyle(paragraph).color,
      bodyWidth: body.getBoundingClientRect().width,
      viewportWidth: innerWidth,
      introBeforeCover: Boolean(
        intro.compareDocumentPosition(cover) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics!.heroTitleSize).toBeLessThanOrEqual(isMobile ? 72 : 128);
  expect(metrics!.sectionTitleSize).toBeLessThanOrEqual(60);
  expect(metrics!.bodyWidth).toBeGreaterThanOrEqual(
    metrics!.viewportWidth * (isMobile ? 0.88 : 0.6),
  );
  expect(metrics!.introBeforeCover).toBe(true);
  const paragraphAlpha = Number(
    metrics!.paragraphColor.match(/[\d.]+(?=\)$)/)?.[0] ?? 1,
  );
  expect(paragraphAlpha).toBeGreaterThanOrEqual(0.8);

  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/projects/sleep-wake-model");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});

test("all cinematic route directions keep one continuous Earth", async ({
  page,
  isMobile,
}) => {
  const routes = {
    home: "/",
    travel: "/photography",
    projects: "/projects",
  } as const;
  const transitions = [
    ["home", "travel"],
    ["home", "projects"],
    ["travel", "home"],
    ["travel", "projects"],
    ["projects", "home"],
    ["projects", "travel"],
  ] as const;

  for (const [from, to] of transitions) {
    await page.goto(routes[from]);
    if (from === "travel") {
      await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
        "data-atlas-ready",
        "true",
      );
    }
    await page.evaluate(() => {
      const cosmicWindow = window as Window & {
        __cosmicBackdrop?: Element;
        __cosmicSamples?: CosmicSample[];
        __cosmicSamplingDone?: boolean;
      };
      cosmicWindow.__cosmicBackdrop = document.querySelector(
        "[data-cosmic-backdrop]",
      )!;
      cosmicWindow.__cosmicSamples = [];
      cosmicWindow.__cosmicSamplingDone = false;
      const started = performance.now();
      let sawTransition = false;
      let settledFrames = 0;
      const sampleElement = (
        kind: CosmicVisual["kind"],
        element: Element | null,
      ) => {
        if (!element) return;
        const box = element.getBoundingClientRect();
        const opacity = Number.parseFloat(getComputedStyle(element).opacity);
        if (!Number.isFinite(opacity) || opacity <= 0.04) return;
        cosmicWindow.__cosmicSamples?.at(-1)?.visuals.push({
          kind,
          x: box.left + box.width / 2,
          y: box.top + box.height / 2,
          width: box.width,
          height: box.height,
          opacity,
        });
      };
      const sample = () => {
        const backdrop = document.querySelector<HTMLElement>(
          "[data-cosmic-backdrop]",
        );
        const target = backdrop?.dataset.transitionTarget;
        if (target) sawTransition = true;
        const frame: CosmicSample = {
          phase: backdrop?.dataset.transitionPhase ?? null,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          visuals: [],
        };
        cosmicWindow.__cosmicSamples?.push(frame);
        sampleElement("home", document.querySelector("[data-home-earth]"));
        sampleElement(
          "route",
          document.querySelector("[data-cosmic-route-earth]"),
        );
        sampleElement(
          "flight",
          document.querySelector("[data-cosmic-flight-layer]"),
        );
        const atlas = document.querySelector<HTMLElement>(
          "[data-atlas-launcher]",
        );
        const canvas = atlas?.querySelector("[data-atlas-canvas]");
        if (atlas && canvas) {
          const canvasOpacity = Number.parseFloat(
            getComputedStyle(canvas).opacity,
          );
          const styles = getComputedStyle(atlas);
          const scale = Number.parseFloat(
            styles.getPropertyValue("--atlas-globe-scale"),
          );
          const x = Number.parseFloat(
            styles.getPropertyValue("--atlas-globe-x"),
          );
          const y = Number.parseFloat(
            styles.getPropertyValue("--atlas-globe-y"),
          );
          const diameter = scale * 2.24;
          if (
            canvasOpacity > 0.04 &&
            [x, y, diameter].every(Number.isFinite) &&
            diameter > 0
          ) {
            frame.visuals.push({
              kind: "atlas",
              x,
              y,
              width: diameter,
              height: diameter,
              opacity: canvasOpacity,
            });
          }
        }
        settledFrames = sawTransition && !target ? settledFrames + 1 : 0;
        if (settledFrames >= 3 || performance.now() - started > 4_500) {
          cosmicWindow.__cosmicSamplingDone = true;
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    if (isMobile) {
      await page.locator("details.mobile-navigation summary").click();
    }
    await page
      .locator(
        isMobile
          ? `.mobile-navigation a[href="${routes[to]}"]`
          : `header.site-navigation nav > ul a[href="${routes[to]}"]`,
      )
      .click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(routes[to]);
    if (to === "travel") {
      await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
        "data-atlas-ready",
        "true",
      );
    }
    await expect(page.locator("[data-cosmic-backdrop]")).not.toHaveAttribute(
      "data-transition-target",
      /.+/,
    );
    await page.waitForTimeout(50);

    const result = await page.evaluate(() => {
      const cosmicWindow = window as Window & {
        __cosmicBackdrop?: Element;
        __cosmicSamples?: CosmicSample[];
      };
      return {
        sameBackdrop:
          cosmicWindow.__cosmicBackdrop ===
          document.querySelector("[data-cosmic-backdrop]"),
        samples: cosmicWindow.__cosmicSamples ?? [],
      };
    });
    expect(result.sameBackdrop, `${from} -> ${to}`).toBe(true);
    expect(result.samples.length, `${from} -> ${to}`).toBeGreaterThan(8);

    const inViewport = (visual: CosmicVisual, sample: CosmicSample) =>
      visual.x + visual.width / 2 > 0 &&
      visual.x - visual.width / 2 < sample.viewportWidth &&
      visual.y + visual.height / 2 > 0 &&
      visual.y - visual.height / 2 < sample.viewportHeight;
    if (from !== "projects" && to !== "projects") {
      const activeSamples = result.samples.filter(
        (sample) => sample.phase !== null,
      );
      expect(
        activeSamples.length,
        `${from} -> ${to} active transition samples`,
      ).toBeGreaterThan(4);
      for (const sample of activeSamples) {
        expect(
          sample.visuals.some((visual) => inViewport(visual, sample)),
          `${from} -> ${to} keeps a globe visible throughout`,
        ).toBe(true);
      }
    }
    for (const sample of result.samples) {
      const visible = sample.visuals.filter((visual) =>
        inViewport(visual, sample),
      );
      for (let index = 0; index < visible.length; index += 1) {
        for (let peer = index + 1; peer < visible.length; peer += 1) {
          expect(
            Math.abs(visible[index].x - visible[peer].x),
            `${from} -> ${to} globe x alignment`,
          ).toBeLessThanOrEqual(2);
          expect(
            Math.abs(visible[index].y - visible[peer].y),
            `${from} -> ${to} globe y alignment`,
          ).toBeLessThanOrEqual(2);
          expect(
            Math.abs(visible[index].width - visible[peer].width),
            `${from} -> ${to} globe size alignment`,
          ).toBeLessThanOrEqual(2);
        }
      }
    }

    const moverSamples = result.samples.flatMap((sample) =>
      sample.visuals.filter(({ kind }) =>
        kind === "route" || kind === "flight" ? true : false,
      ),
    );
    expect(
      moverSamples.length,
      `${from} -> ${to} mover samples`,
    ).toBeGreaterThan(4);
    if (from === "projects") {
      const firstMover = moverSamples[0];
      expect(
        firstMover.x + firstMover.width / 2,
        `${from} -> ${to} begins off-screen`,
      ).toBeLessThanOrEqual(1);
    }
    if (from !== "projects" && to !== "projects") {
      const departingMovers = result.samples.flatMap((sample) =>
        sample.phase === "departing"
          ? sample.visuals.filter(({ kind }) =>
              kind === "route" || kind === "flight" ? true : false,
            )
          : [],
      );
      expect(
        departingMovers.length,
        `${from} -> ${to} fixed departure samples`,
      ).toBeGreaterThan(0);
      const departureFrame = departingMovers[0];
      for (const mover of departingMovers) {
        expect(
          Math.abs(mover.x - departureFrame.x),
          `${from} -> ${to} fixed departure x`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(mover.y - departureFrame.y),
          `${from} -> ${to} fixed departure y`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(mover.width - departureFrame.width),
          `${from} -> ${to} fixed departure size`,
        ).toBeLessThanOrEqual(2);
      }
    }
    if (to === "projects") {
      const lastMover = moverSamples.at(-1)!;
      expect(
        lastMover.x + lastMover.width / 2,
        `${from} -> ${to} exits left`,
      ).toBeLessThanOrEqual(1);
      expect(lastMover.width).toBeGreaterThan(moverSamples[0].width);
    } else {
      const handoffFrames = result.samples.filter((sample) => {
        const kinds = new Set(sample.visuals.map(({ kind }) => kind));
        return (
          (kinds.has("route") || kinds.has("flight")) &&
          kinds.has(to === "home" ? "home" : "atlas")
        );
      });
      expect(
        handoffFrames.length,
        `${from} -> ${to} aligned handoff frames`,
      ).toBeGreaterThan(0);
    }
    await expect(page.locator("[data-cosmic-route-earth]")).toHaveAttribute(
      "data-visible",
      "false",
    );
    await expect(page.locator("[data-cosmic-flight-layer]")).toHaveAttribute(
      "data-visible",
      "false",
    );
  }
});

test("the orbital home scene uses the shared sky and one clean Earth rim", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Stone Yang." }),
  ).toBeVisible();
  await expect(page.locator("[data-home-earth]")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Toronto, Canada" }),
  ).toBeVisible();
  await expect(
    page.locator("[data-home-earth] [data-home-base]"),
  ).toBeVisible();
  await expect(
    page.locator("[data-home-earth] [data-home-base]"),
  ).toContainText("Toronto, Canada");
  await expect(
    page.locator("[data-home-earth] [data-home-base]"),
  ).not.toContainText("Based in");
  await expect(page.locator("[data-home-earth] .cosmic-earth-rim")).toHaveCount(
    1,
  );
  expect(
    await page
      .locator(".orbital-earth")
      .evaluate((earth) => getComputedStyle(earth, "::after").content),
  ).toBe("none");
  await expect(page.locator(".orbital-orbit")).toHaveCount(0);
  const destinations = page.getByRole("navigation", {
    name: "Explore the portfolio",
  });
  await expect(
    destinations.getByRole("link", { name: /Travel/ }),
  ).toHaveAttribute("href", "/photography");
  await expect(
    destinations.getByRole("link", { name: /Projects/ }),
  ).toHaveAttribute("href", "/projects");
  await expect(
    page.getByRole("link", { name: "Signal me", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Résumé", exact: true }),
  ).toBeVisible();
});

test("a sparse set of stars twinkles only on the home scene", async ({
  page,
}) => {
  await page.goto("/");

  const stars = page.locator(".cosmic-backdrop-stars circle");
  const twinklingStars = page.locator("[data-twinkle-star]");
  const starCount = await stars.count();
  const twinklingStarCount = await twinklingStars.count();

  expect(twinklingStarCount).toBeGreaterThan(0);
  expect(twinklingStarCount).toBeLessThan(starCount / 8);
  await expect(twinklingStars.first()).toHaveCSS(
    "animation-name",
    "cosmic-star-twinkle",
  );
  await expect(
    page
      .locator(".cosmic-backdrop-stars circle:not([data-twinkle-star])")
      .first(),
  ).toHaveCSS("animation-name", "cosmic-star-pulse");

  await page.goto("/photography");
  await expect(page.locator("[data-twinkle-star]").first()).toHaveCSS(
    "animation-name",
    "cosmic-star-pulse",
  );

  await page.goto("/projects");
  await expect(page.locator("[data-twinkle-star]").first()).toHaveCSS(
    "animation-name",
    "cosmic-star-pulse",
  );
});

test("the home star field respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("[data-twinkle-star]").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("home and travel rotate between Toronto and Asia with one aligned handoff", async ({
  page,
  isMobile,
}) => {
  for (const [from, to] of [
    ["/", "/photography"],
    ["/photography", "/"],
  ] as const) {
    await page.goto(from);
    if (from === "/photography") {
      await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
        "data-atlas-ready",
        "true",
      );
      const canvas = page.locator("[data-atlas-canvas]");
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(
          box.x + box.width * 0.55,
          box.y + box.height * 0.5,
        );
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width * 0.68,
          box.y + box.height * 0.42,
        );
        await page.mouse.up();
      }
    }
    await page.evaluate(() => {
      const cosmicWindow = window as Window & {
        __fixedEarthSamples?: EarthRect[];
        __fixedEarthSamplingDone?: boolean;
      };
      cosmicWindow.__fixedEarthSamples = [];
      cosmicWindow.__fixedEarthSamplingDone = false;
      let sawDeparture = false;
      const sample = () => {
        const backdrop = document.querySelector<HTMLElement>(
          "[data-cosmic-backdrop]",
        );
        if (backdrop?.dataset.transitionPhase === "departing") {
          sawDeparture = true;
          const mover = [
            ...document.querySelectorAll<HTMLElement>(
              "[data-cosmic-route-earth], [data-cosmic-flight-layer]",
            ),
          ].find(
            (element) =>
              Number.parseFloat(getComputedStyle(element).opacity) > 0.04,
          );
          if (mover) {
            const box = mover.getBoundingClientRect();
            cosmicWindow.__fixedEarthSamples?.push({
              x: box.left + box.width / 2,
              y: box.top + box.height / 2,
              width: box.width,
              height: box.height,
            });
          }
        }
        if (sawDeparture && !backdrop?.dataset.transitionTarget) {
          cosmicWindow.__fixedEarthSamplingDone = true;
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    if (isMobile) {
      await page.locator("details.mobile-navigation summary").click();
    }
    await page
      .locator(
        isMobile
          ? `.mobile-navigation a[href="${to}"]`
          : `header.site-navigation nav > ul a[href="${to}"]`,
      )
      .click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(to);
    await page.waitForFunction(
      () =>
        (window as Window & { __fixedEarthSamplingDone?: boolean })
          .__fixedEarthSamplingDone === true,
    );

    const samples = await page.evaluate(
      () =>
        (window as Window & { __fixedEarthSamples?: EarthRect[] })
          .__fixedEarthSamples ?? [],
    );
    expect(samples.length, `${from} -> ${to} fixed samples`).toBeGreaterThan(2);
    for (const sample of samples) {
      expect(Math.abs(sample.x - samples[0].x)).toBeLessThanOrEqual(2);
      expect(Math.abs(sample.y - samples[0].y)).toBeLessThanOrEqual(2);
      expect(Math.abs(sample.width - samples[0].width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sample.height - samples[0].height)).toBeLessThanOrEqual(
        2,
      );
    }

    const rotation =
      to === "/photography"
        ? await page
            .locator("[data-atlas-launcher]")
            .getAttribute("data-atlas-route-rotation")
        : await page
            .locator("[data-cosmic-flight-layer]")
            .getAttribute("data-flight-rotation");
    expect(rotation, `${from} -> ${to} shared rotation`).toBe(
      to === "/photography" ? "-108,-22,0" : "85,5,0",
    );
  }
});

test("all immersive routes share one computed cosmic treatment", async ({
  page,
}) => {
  const treatments = [];
  for (const route of ["/", "/photography", "/projects"]) {
    await page.goto(route);
    treatments.push(
      await page.locator("[data-cosmic-backdrop]").evaluate((element) => {
        const wash = getComputedStyle(
          element.querySelector(".cosmic-backdrop-wash")!,
        ).backgroundImage;
        const grid = getComputedStyle(
          element.querySelector(".cosmic-backdrop-grid")!,
        ).backgroundImage;
        const star = getComputedStyle(
          element.querySelector(".cosmic-backdrop-stars circle")!,
        ).fill;
        return { wash, grid, star };
      }),
    );
  }
  expect(treatments[1]).toEqual(treatments[0]);
  expect(treatments[2]).toEqual(treatments[0]);
});

test("reduced motion navigates immersive routes without a flight delay", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/photography");
  await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
    "data-atlas-ready",
    "true",
  );
  await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
    "data-atlas-route-rotation",
    "-108,-22,0",
  );
  const started = Date.now();
  if (isMobile) {
    await page.locator("details.mobile-navigation summary").click();
  }
  await page
    .locator(
      isMobile
        ? '.mobile-navigation a[href="/projects"]'
        : 'header.site-navigation nav > ul a[href="/projects"]',
    )
    .click();
  await expect(page).toHaveURL(/\/projects$/);
  expect(Date.now() - started).toBeLessThan(1_500);
  await expect(page.locator("[data-cosmic-flight-layer]")).toHaveAttribute(
    "data-visible",
    "false",
  );
});

test("repeated immersive navigation and history do not duplicate scene controllers", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const target of ["/photography", "/projects", "/", "/photography"]) {
    if (isMobile) {
      await page.locator("details.mobile-navigation summary").click();
    }
    await page
      .locator(
        isMobile
          ? `.mobile-navigation a[href="${target}"]`
          : `header.site-navigation nav > ul a[href="${target}"]`,
      )
      .click();
    await expect(page).toHaveURL(
      target === "/" ? /\/$/ : new RegExp(`${target}$`),
    );
    await expect(page.locator("[data-cosmic-backdrop]")).toHaveCount(1);
  }
  await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
    "data-atlas-ready",
    "true",
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator("[data-cosmic-backdrop]")).toHaveCount(1);
});

test("the full-viewport atlas auto-loads with keyboard and glow state", async ({
  page,
  isMobile,
}) => {
  const cesiumRequests: string[] = [];
  page.on("request", (request) => {
    if (/cesium|tile\.googleapis|api\.cesium/i.test(request.url()))
      cesiumRequests.push(request.url());
  });
  await page.goto("/photography");
  const atlas = page.locator("[data-atlas-launcher]");
  await expect(atlas).toHaveAttribute("data-atlas-ready", "true");
  await expect(atlas).toHaveAttribute(
    "data-atlas-route-rotation",
    "-108,-22,0",
  );
  await expect(page.locator("[data-atlas-canvas]")).toBeVisible();
  await expect(page.locator("[data-atlas-country]")).toHaveCount(
    countries.length,
  );
  await expect(page.locator("[data-atlas-leader]")).toHaveCount(
    countries.length,
  );
  await expect(page.locator("[data-atlas-city]")).toHaveCount(
    photographyConfig.cities.length,
  );
  await expect(page.locator("[data-atlas-city-spoke]")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator("[data-country-sidebar]")).toHaveCount(0);
  await expect(page.locator("[data-atlas-fallback]")).toBeHidden();
  const [stageBox, viewport] = await Promise.all([
    atlas.boundingBox(),
    page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
  ]);
  expect(stageBox?.width).toBeCloseTo(viewport.width, 0);
  expect(stageBox?.height).toBeCloseTo(viewport.height, 0);
  expect(cesiumRequests).toEqual([]);
  const titleClearance = await page.evaluate(() => {
    const atlas = document.querySelector<HTMLElement>("[data-atlas-launcher]");
    const heading = document.querySelector<HTMLElement>(".atlas-heading");
    if (!atlas || !heading) return null;
    const atlasBox = atlas.getBoundingClientRect();
    const headingBox = heading.getBoundingClientRect();
    const styles = getComputedStyle(atlas);
    const x = Number.parseFloat(styles.getPropertyValue("--atlas-globe-x"));
    const y = Number.parseFloat(styles.getPropertyValue("--atlas-globe-y"));
    const radius =
      Number.parseFloat(styles.getPropertyValue("--atlas-globe-scale")) * 1.12;
    const nearestX = Math.max(
      headingBox.left - atlasBox.left,
      Math.min(x, headingBox.right - atlasBox.left),
    );
    const nearestY = Math.max(
      headingBox.top - atlasBox.top,
      Math.min(y, headingBox.bottom - atlasBox.top),
    );
    return Math.hypot(x - nearestX, y - nearestY) - radius;
  });
  expect(titleClearance).not.toBeNull();
  expect(titleClearance!).toBeGreaterThanOrEqual(27);

  const china = page.locator('[data-atlas-country="china"]');
  await china.focus();
  await expect(atlas).toHaveAttribute("data-hover-country", "china");
  await expect(china).toHaveAttribute("data-active", "true");
  await expect(china).toHaveAttribute("data-visible", "true");
  await expect(china).toHaveAttribute("style", /--atlas-label-(?:x|y):/);
  const chinaLeader = page.locator('[data-atlas-leader="china"]');
  await expect(chinaLeader).toHaveAttribute("data-visible", "true");
  const chinaPreview = page.locator('[data-atlas-preview-card="china"]');
  await expect(chinaPreview).toHaveAttribute("data-active", "true");
  await expect(chinaPreview).toHaveAttribute("aria-hidden", "false");
  await expect(chinaPreview.locator("img")).toHaveCount(3);
  await expect(chinaPreview.locator("img").first()).toHaveAttribute(
    "src",
    /\/media\/photography\/china\//,
  );
  if (!isMobile) {
    const previewBox = await chinaPreview.boundingBox();
    expect(previewBox?.height).toBeGreaterThanOrEqual(viewport.height * 0.4);
    expect(
      Math.abs(
        (previewBox?.y ?? 0) +
          (previewBox?.height ?? 0) / 2 -
          viewport.height * 0.52,
      ),
    ).toBeLessThan(3);
  }
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await expect(chinaPreview).toHaveAttribute("data-active", "false");
  await expect(chinaPreview).toHaveAttribute("aria-hidden", "true");
  await china.focus();
  await expect(chinaPreview).toHaveAttribute("data-active", "true");
  expect(
    (await chinaLeader.getAttribute("points"))?.trim().split(/\s+/),
  ).toHaveLength(3);
  await china.click();
  await expect(page).toHaveURL(/\/photography\/china$/);
});

test("city markers open and select the matching country-map callout", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/photography");
  const toronto = page.locator('[data-atlas-city="toronto"]');
  await expect(toronto).toHaveAttribute(
    "href",
    "/photography/canada#city-toronto",
  );
  await toronto.focus();
  await expect(toronto).toHaveAttribute("data-visible", "true");
  const elora = page.locator('[data-atlas-city="elora"]');
  await expect(elora).toHaveAttribute("data-visible", "true");
  const markerDistance = await page.evaluate(() => {
    const center = (selector: string) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box
        ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
        : null;
    };
    const torontoCenter = center('[data-atlas-city="toronto"]');
    const eloraCenter = center('[data-atlas-city="elora"]');
    if (!torontoCenter || !eloraCenter) return null;
    return Math.hypot(
      torontoCenter.x - eloraCenter.x,
      torontoCenter.y - eloraCenter.y,
    );
  });
  expect(markerDistance).not.toBeNull();
  expect(markerDistance!).toBeLessThan(18);
  await toronto.click();
  await expect(page).toHaveURL(/\/photography\/canada#city-toronto$/);
  await expect(page.locator("[data-country-map-hero]")).toBeVisible();
  const selected = page.locator('[data-country-city="toronto"]');
  await expect(selected).toHaveAttribute("data-selected", "true");
  await expect(selected).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator(".country-silhouette-land")).toBeVisible();
  await expect(selected.locator("image")).toHaveCount(2);
});

test("country morph uses a composited fade and same-document handoff", async ({
  page,
}) => {
  await page.goto("/photography");
  const atlas = page.locator("[data-atlas-launcher]");
  await expect(atlas).toHaveAttribute("data-atlas-ready", "true");
  expect(
    Number(await atlas.getAttribute("data-atlas-render-ratio")),
  ).toBeLessThanOrEqual(1.5);
  const china = page.locator('[data-atlas-country="china"]');
  await china.focus();
  await page.evaluate(() => {
    sessionStorage.removeItem("atlas-country-morph-report");
    (
      window as Window & { __atlasCountrySourceDocument?: Document }
    ).__atlasCountrySourceDocument = document;
    const canvas = document.querySelector<HTMLCanvasElement>(
      "[data-atlas-canvas]",
    );
    const handoff = document.querySelector<SVGPathElement>(
      "[data-atlas-handoff-shape]",
    );
    const paths = new Set<string>();
    let usedCompositedFade = false;
    let sawTransition = false;
    const sample = () => {
      const atlas = document.querySelector<HTMLElement>(
        "[data-atlas-launcher]",
      );
      if (atlas?.dataset.atlasTransitioning === "true") {
        sawTransition = true;
        const path = handoff?.getAttribute("d");
        if (path) paths.add(path);
        if ((canvas?.getAnimations().length ?? 0) > 0)
          usedCompositedFade = true;
      }
      requestAnimationFrame(sample);
    };
    const persistReport = () => {
      sessionStorage.setItem(
        "atlas-country-morph-report",
        JSON.stringify({
          pathFrames: paths.size,
          sawTransition,
          usedCompositedFade,
        }),
      );
    };
    addEventListener("pagehide", persistReport, { once: true });
    document.addEventListener("astro:before-swap", persistReport, {
      once: true,
    });
    requestAnimationFrame(sample);
  });
  await china.click();
  await expect(page).toHaveURL(/\/photography\/china$/);
  const report = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("atlas-country-morph-report") ?? "{}"),
  );
  expect(report.sawTransition).toBe(true);
  expect(report.usedCompositedFade).toBe(true);
  expect(report.pathFrames).toBeGreaterThan(8);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __atlasCountrySourceDocument?: Document })
          .__atlasCountrySourceDocument === document,
    ),
  ).toBe(true);
});

test("country pages open on a centered map and use a complete United States projection", async ({
  page,
}) => {
  await page.goto("/photography/united-states");
  const metrics = await page.evaluate(() => {
    const hero = document.querySelector("[data-country-map-hero]");
    const land = document.querySelector(".country-silhouette-land");
    const marker = document.querySelector(
      '[data-country-city="san-francisco"] .country-map-marker',
    );
    if (!hero || !land || !marker) return null;
    const heroBox = hero.getBoundingClientRect();
    const landBox = land.getBoundingClientRect();
    return {
      heroTop: heroBox.top,
      landTop: landBox.top,
      landBottom: landBox.bottom,
      landWidth: landBox.width,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      markerX: Number(marker.getAttribute("cx")),
    };
  });
  expect(metrics).not.toBeNull();
  expect(metrics!.landTop).toBeLessThan(metrics!.viewportHeight);
  expect(metrics!.landBottom).toBeGreaterThan(metrics!.heroTop);
  expect(metrics!.landWidth).toBeGreaterThan(metrics!.viewportWidth * 0.45);
  expect(metrics!.markerX).toBeGreaterThan(120);
  expect(metrics!.markerX).toBeLessThan(600);
});

test("country and city routes share the main cosmic palette", async ({
  page,
}) => {
  for (const [route, pageSelector, accentSelector, secondarySelector] of [
    [
      "/photography/china",
      ".country-page",
      ".country-map-title-block .eyebrow",
      ".country-city-directory h2 em",
    ],
    [
      "/photography/china/chongqing",
      ".city-page",
      ".city-archive-intro .eyebrow",
      ".city-gallery h2 em",
    ],
  ] as const) {
    await page.goto(route);
    await expect(page.locator(".site-navigation")).toHaveClass(
      /site-navigation-overlay/,
    );
    await expect(page.locator("footer")).toHaveClass(/cosmic-footer/);
    expect(
      await page.locator(pageSelector).evaluate((element) => {
        const styles = getComputedStyle(element);
        return [styles.backgroundColor, styles.color];
      }),
    ).toEqual(["rgb(7, 9, 13)", "rgb(240, 234, 220)"]);
    await expect(page.locator(accentSelector)).toHaveCSS(
      "color",
      "rgb(255, 118, 86)",
    );
    await expect(page.locator(secondarySelector)).toHaveCSS(
      "color",
      "rgb(196, 211, 123)",
    );
    if (pageSelector === ".country-page") {
      expect(
        await page.evaluate(() => {
          const country = document.querySelector(".country-page");
          const footer = document.querySelector("footer");
          if (!country || !footer) return null;
          return Math.abs(
            country.getBoundingClientRect().bottom -
              footer.getBoundingClientRect().top,
          );
        }),
      ).toBeLessThanOrEqual(1);
    }
  }
});

test("atlas enhancement failure exposes links without retry controls", async ({
  page,
}) => {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (/photography-atlas\/controller|\/controller\.[\w-]+\.js/i.test(url))
      await route.abort("failed");
    else await route.continue();
  });
  await page.goto("/photography");
  const fallback = page.locator("[data-atlas-fallback]");
  await expect(fallback).toBeVisible();
  await expect(fallback.getByRole("link", { name: "China" })).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator("[data-atlas-country]")).toHaveCount(
    countries.length,
  );
});

test("reduced motion stops atlas rotation without blocking enhancement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/photography");
  await expect(page.locator("[data-atlas-launcher]")).toHaveAttribute(
    "data-atlas-ready",
    "true",
  );
  const china = page.locator('[data-atlas-country="china"]');
  await page.waitForTimeout(250);
  const before = await china.getAttribute("style");
  await page.waitForTimeout(350);
  expect(await china.getAttribute("style")).toBe(before);
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

test("city gallery opens with the keyboard and restores focus", async ({
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
  const dialog = page.locator(".city-lightbox");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(firstPhoto).toBeFocused();
});

test("legacy country city URLs redirect to the static city route", async ({
  page,
}) => {
  const city = photographyConfig.cities[0];
  await page.goto(`/photography/${cityCountry(city)}?city=${city.id}`);
  await expect(page).toHaveURL(new RegExp(`${cityRoute(city)}(?:\\?.*)?$`));
});

test("photography routes retain useful no-JavaScript galleries", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/photography");
  await expect(page.locator("[data-atlas-country]")).toHaveCount(
    countries.length,
  );
  const city = photographyConfig.cities[0];
  await page.goto(cityRoute(city));
  await expect(page.locator(".city-gallery figure").first()).toBeVisible();
  await expect(page.locator("[data-city-map-experience]")).toHaveCount(0);
  await context.close();
});

test("the photography experience fits a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const city = photographyConfig.cities[0];
  for (const route of [
    "/photography",
    `/photography/${cityCountry(city)}`,
    cityRoute(city),
  ]) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page, route).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});

test("removed Sightline routes return 404", async ({ request }) => {
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
