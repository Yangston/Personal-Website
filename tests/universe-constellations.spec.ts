import { expect, test } from "@playwright/test";
import { pointFor } from "./helpers/home-region";

type UniverseAuditWindow = Window & {
  __portfolioUniverseAudit?: {
    getSnapshot: () => { effectTimeMs: number };
    simulateContextLoss: () => void;
    projectAnchor: (id: string) => {
      bounds: { left: number; top: number; width: number; height: number };
    } | null;
  };
};

const rootSelector = "[data-portfolio-universe]";
const projectLinks = "#projects [data-project-constellation]";
const projectDrawings = "#projects .constellation-drawing";

test("Home loads the shared world and keeps its visible artwork within budget", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?universeAudit=1#home");
  const root = page.locator(rootSelector);
  const world = page.locator("[data-universe-world]");
  const renderer = page.locator("[data-universe-renderer]");
  await expect(root).toHaveAttribute("data-enhanced", "true");
  await expect(root).toHaveAttribute("data-renderer-ready", "true", {
    timeout: 20_000,
  });
  await expect(world).toHaveCount(1);
  await expect(renderer).toHaveCount(1);
  await expect(world.locator("[data-universe-renderer]")).toHaveCount(1);
  await expect(world).toHaveAttribute("data-artwork-ready", "true");
  await expect(renderer).toBeVisible();
  await expect(world.locator("[data-world-plane]")).toHaveCount(40);
  await expect(world.locator('[data-plane-mobile="true"]')).toHaveCount(29);
  await expect(world).toHaveAttribute(
    "data-loaded-cloud-count",
    page.viewportSize()!.width <= 700 ? "29" : "40",
  );
  expect(
    Number(await world.getAttribute("data-world-plate-count")),
  ).toBeLessThanOrEqual(page.viewportSize()!.width <= 700 ? 17 : 26);
  await expect(world).toHaveAttribute("data-artwork-failed-count", "0");
  await expect(world.locator("[data-world-depth-planes]")).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(world.locator("[data-world-backdrop]")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await expect(world.locator("[data-world-earth-fallback]")).toHaveCSS(
    "visibility",
    "hidden",
  );
});

test("Home world destinations retain visible keyboard focus and pointer interaction", async ({
  page,
}) => {
  await page.goto("/?universeAudit=1#home");
  const root = page.locator(rootSelector);
  await expect(root).toHaveAttribute("data-renderer-ready", "true", {
    timeout: 20_000,
  });

  await expect(root).toHaveAttribute("data-active-scene", "home");
  for (const [scene, interaction] of [
    ["about", "about"],
    ["projects", "projects"],
    ["travel", "earth"],
  ]) {
    const destination = page.locator(`[data-universe-destination="${scene}"]`);
    await expect(destination).toHaveAttribute("href", `/#${scene}`);
    await expect(destination).not.toHaveAttribute("data-universe-anchor");
    await expect(destination).not.toHaveAttribute(
      "data-universe-anchor-projected",
    );
    await destination.focus();
    await expect(destination).toBeFocused();
    await expect(
      destination.locator("[data-region-outline]:visible"),
    ).toHaveCSS("opacity", "1");
    await expect(root).toHaveAttribute("data-interaction-target", interaction);

    await destination.evaluate((element) => element.blur());
    const point = await pointFor(page, scene);
    await page.mouse.move(point.x, point.y);
    await expect(root).toHaveAttribute("data-interaction-target", interaction);
    await expect(destination).toHaveCSS("outline-style", "none");
  }
});

test("WebGL is the sole enhanced constellation visual while semantic links remain usable", async ({
  page,
}) => {
  await page.goto("/?universeAudit=1#projects");
  const root = page.locator(rootSelector);
  await expect(root).toHaveAttribute("data-renderer-ready", "true", {
    timeout: 20_000,
  });

  const links = page.locator(projectLinks);
  const drawings = page.locator(projectDrawings);
  await expect(links).toHaveCount(3);
  await expect(drawings).toHaveCount(3);
  await expect(page.locator("[data-universe-renderer]")).toBeVisible();
  for (const drawing of await drawings.all()) {
    await expect(drawing).toHaveCSS("visibility", "hidden");
    await expect(drawing).toHaveCSS("opacity", "0");
  }

  const firstLink = links.first();
  const firstLabel = firstLink.locator(".project-constellation-copy");
  const firstTitle = firstLink.locator(".project-constellation-title-text");
  const firstDetails = firstLink.locator(".project-constellation-details");
  const bounds = await firstLink.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  const alignment = await page.evaluate(() => {
    const audit = (window as UniverseAuditWindow).__portfolioUniverseAudit;
    return [
      ...document.querySelectorAll<HTMLElement>("#projects [data-project-id]"),
    ].map((project) => {
      const projectId = project.dataset.projectId ?? "";
      const hitBounds = project.getBoundingClientRect();
      return {
        hitBounds: {
          left: hitBounds.left,
          top: hitBounds.top,
          width: hitBounds.width,
          height: hitBounds.height,
        },
        projected: audit?.projectAnchor(`project:${projectId}`)?.bounds ?? null,
      };
    });
  });
  for (const project of alignment) {
    expect(project.projected).not.toBeNull();
    expect(
      Math.abs(project.hitBounds.left - project.projected!.left),
    ).toBeLessThan(1);
    expect(
      Math.abs(project.hitBounds.top - project.projected!.top),
    ).toBeLessThan(1);
    expect(
      Math.abs(project.hitBounds.width - project.projected!.width),
    ).toBeLessThan(1);
    expect(
      Math.abs(project.hitBounds.height - project.projected!.height),
    ).toBeLessThan(1);
  }

  await expect(firstLabel).toHaveCSS("opacity", "1");
  await expect(firstDetails).toHaveCSS("display", "none");
  await expect(firstLink).toHaveAccessibleName("Explore Sightline, 2026");
  await expect(firstTitle).toHaveText("Sightline");
  await expect(firstTitle).toHaveCSS("animation-name", "none");
  await expect(firstTitle).toHaveCSS("opacity", "1");
  await expect(firstLink).not.toHaveAttribute("aria-haspopup");
  await firstLink.focus();
  await expect(firstLink).toBeFocused();
  await expect(firstLabel).toHaveCSS("opacity", "1");
  await expect(firstDetails).toHaveCSS("display", "none");
  await expect(firstLink).toHaveCSS("outline-style", "none");
  await expect(firstLabel).toHaveCSS("outline-style", "solid");
  await expect(firstLabel).toHaveCSS("outline-color", "rgb(255, 224, 163)");
  await expect(root).toHaveAttribute(
    "data-interaction-target",
    "project:sightline",
  );
  const focusedAlignment = await page.evaluate(() => {
    const audit = (window as UniverseAuditWindow).__portfolioUniverseAudit;
    const project = document.querySelector<HTMLElement>(
      '#projects [data-project-id="sightline"]',
    );
    if (!audit || !project) throw new Error("Sightline project is missing");
    const bounds = project.getBoundingClientRect();
    return {
      actual: {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
      projected: audit.projectAnchor("project:sightline")?.bounds ?? null,
    };
  });
  expect(focusedAlignment.projected).not.toBeNull();
  expect(
    Math.abs(focusedAlignment.actual.left - focusedAlignment.projected!.left),
  ).toBeLessThan(1);
  expect(
    Math.abs(focusedAlignment.actual.top - focusedAlignment.projected!.top),
  ).toBeLessThan(1);
  expect(
    Math.abs(focusedAlignment.actual.width - focusedAlignment.projected!.width),
  ).toBeLessThan(1);
  expect(
    Math.abs(
      focusedAlignment.actual.height - focusedAlignment.projected!.height,
    ),
  ).toBeLessThan(1);

  const titleLayout = await page
    .locator("#projects .project-constellation-title")
    .evaluateAll((titles) =>
      titles.map((title) => {
        const bounds = title.getBoundingClientRect();
        return {
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
        };
      }),
    );
  for (const title of titleLayout) {
    expect(title.left).toBeGreaterThanOrEqual(0);
    expect(title.top).toBeGreaterThanOrEqual(0);
    expect(title.right).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(title.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
  }

  await page.evaluate(() => {
    const audit = (window as UniverseAuditWindow).__portfolioUniverseAudit;
    if (!audit) throw new Error("Universe audit is unavailable");
    audit.simulateContextLoss();
  });
  await expect(root).toHaveAttribute("data-renderer-type", "fallback");
  await expect(page.locator("[data-universe-world]")).toHaveAttribute(
    "data-artwork-ready",
    "false",
  );
  await expect(page.locator("[data-world-depth-planes]")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.locator('[data-world-plane="project-sky"]')).toBeVisible();
  await expect(root).not.toHaveAttribute("data-renderer-ready", "true");
  await expect(page.locator("[data-universe-renderer]")).toHaveCSS(
    "visibility",
    "hidden",
  );
  for (const drawing of await drawings.all()) {
    await expect(drawing).toHaveCSS("visibility", "visible");
    await expect(drawing).toHaveCSS("opacity", "1");
  }
  await expect(firstLink).toHaveCSS("outline-style", "solid");
});

test("complete project titles remain visible whenever Projects becomes active", async ({
  page,
}) => {
  await page.goto("/?universeAudit=1#projects");
  const root = page.locator(rootSelector);
  await expect(root).toHaveAttribute("data-renderer-ready", "true", {
    timeout: 20_000,
  });
  const titles = page.locator("#projects .project-constellation-title-text");
  const originalTitles = await titles.allTextContents();
  await expect(titles).toHaveCount(3);
  for (const title of await titles.all()) {
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS("animation-name", "none");
    await expect(title).toHaveCSS("opacity", "1");
  }

  await page.locator("#projects .project-return").click();
  await expect(page.locator("#home")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await page.locator('[data-universe-destination="projects"]').click();
  await expect(page.locator("#projects")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await expect(titles).toHaveText(originalTitles);
  for (const title of await titles.all()) {
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS("animation-name", "none");
    await expect(title).toHaveCSS("opacity", "1");
  }
});

test("focused project labels stay inside 320px and 390px enhanced and fallback views", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");

  const expectFocusedLabelsInView = async (
    activePage: typeof page,
    width: number,
    height: number,
  ) => {
    const copyBounds = await activePage
      .locator(`${projectLinks} .project-constellation-copy`)
      .evaluateAll((copies) =>
        copies.map((copy) => {
          const box = copy.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          };
        }),
      );
    for (let a = 0; a < copyBounds.length; a += 1) {
      for (let b = a + 1; b < copyBounds.length; b += 1) {
        const first = copyBounds[a];
        const second = copyBounds[b];
        const overlapWidth =
          Math.min(first.right, second.right) -
          Math.max(first.left, second.left);
        const overlapHeight =
          Math.min(first.bottom, second.bottom) -
          Math.max(first.top, second.top);
        expect(
          overlapWidth > 1 && overlapHeight > 1,
          `project labels ${a} and ${b} overlap`,
        ).toBe(false);
      }
    }
    const links = activePage.locator(projectLinks);
    for (let index = 0; index < (await links.count()); index += 1) {
      const link = links.nth(index);
      await link.focus();
      await expect(link.locator(".project-constellation-details")).toHaveCSS(
        "display",
        "none",
      );
      const layout = await link.evaluate((element) => {
        const copy = element.querySelector<HTMLElement>(
          ".project-constellation-copy",
        );
        if (!copy) throw new Error("Project copy is missing");
        const bounds = (node: HTMLElement) => {
          const rectangle = node.getBoundingClientRect();
          return {
            left: rectangle.left,
            top: rectangle.top,
            right: rectangle.right,
            bottom: rectangle.bottom,
          };
        };
        return {
          projectId:
            element.closest<HTMLElement>("[data-project-id]")?.dataset
              .projectId,
          copy: bounds(copy),
        };
      });
      for (const [name, bounds] of Object.entries({
        copy: layout.copy,
      })) {
        expect(
          bounds.left,
          `${layout.projectId} ${name} left`,
        ).toBeGreaterThanOrEqual(-1);
        expect(
          bounds.top,
          `${layout.projectId} ${name} top`,
        ).toBeGreaterThanOrEqual(-1);
        expect(
          bounds.right,
          `${layout.projectId} ${name} right`,
        ).toBeLessThanOrEqual(width + 1);
        expect(
          bounds.bottom,
          `${layout.projectId} ${name} bottom`,
        ).toBeLessThanOrEqual(height + 1);
      }
    }
  };

  for (const [viewportIndex, viewport] of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ].entries()) {
    const activePage =
      viewportIndex === 0 ? page : await page.context().newPage();
    await activePage.setViewportSize(viewport);
    await activePage.goto("/?universeAudit=1#projects");
    const root = activePage.locator(rootSelector);
    await expect(root).toHaveAttribute("data-renderer-ready", "true", {
      timeout: 20_000,
    });
    await expectFocusedLabelsInView(
      activePage,
      viewport.width,
      viewport.height,
    );

    await activePage.evaluate(() => {
      const audit = (window as UniverseAuditWindow).__portfolioUniverseAudit;
      if (!audit) throw new Error("Universe audit is unavailable");
      audit.simulateContextLoss();
    });
    await expect(root).toHaveAttribute("data-renderer-type", "fallback");
    await expectFocusedLabelsInView(
      activePage,
      viewport.width,
      viewport.height,
    );
    if (activePage !== page) await activePage.close();
  }
});

test("no-JavaScript fallback retains visible project constellations and real links", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 700 },
  });
  const page = await context.newPage();
  await page.goto("/");

  const links = page.locator(projectLinks);
  const drawings = page.locator(projectDrawings);
  await expect(links).toHaveCount(3);
  await expect(drawings).toHaveCount(3);
  await expect(page.locator("[data-universe-world]")).toHaveCount(1);
  for (const drawing of await drawings.all())
    await expect(drawing).toHaveCSS("visibility", "visible");
  for (const title of await page
    .locator("#projects .project-constellation-title-text")
    .all()) {
    await expect(title).toHaveCSS("animation-name", "none");
    await expect(title).toHaveCSS("opacity", "1");
  }
  await expect(
    links.first().locator(".project-constellation-details"),
  ).toHaveCSS("display", "grid");
  const destinations = page.locator("[data-universe-destination]");
  await expect(destinations).toHaveCount(3);
  for (const destination of await destinations.all()) {
    await expect(destination).toBeVisible();
    await expect(destination).toHaveAttribute(
      "href",
      /^\/#(about|projects|travel)$/,
    );
  }
  await expect(destinations.filter({ hasText: "Projects" })).toHaveCount(1);
  await destinations.filter({ hasText: "Projects" }).focus();
  await expect(
    destinations
      .filter({ hasText: "Projects" })
      .locator("[data-region-outline]:visible"),
  ).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await expect(links.first()).toHaveAttribute("href", /\/projects\//);

  await context.close();
});

test("reduced motion reveals project names immediately and freezes ambient movement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?universeAudit=1#projects");
  await expect(page.locator(rootSelector)).toHaveAttribute(
    "data-enhanced",
    "true",
  );

  const titles = page.locator("#projects .project-constellation-title-text");
  await expect(titles).toHaveCount(3);
  for (const title of await titles.all()) {
    await expect(title).toHaveCSS("animation-name", "none");
    await expect(title).toHaveCSS("opacity", "1");
  }

  const clock = await page.evaluate(async () => {
    const audit = (window as UniverseAuditWindow).__portfolioUniverseAudit!;
    const before = audit.getSnapshot().effectTimeMs;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return { before, after: audit.getSnapshot().effectTimeMs };
  });
  expect(clock).toEqual({ before: 0, after: 0 });
});
