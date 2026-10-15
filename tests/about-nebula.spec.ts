import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { PortfolioUniverseRenderer } from "../src/lib/portfolio-universe/renderer";
import { NEBULA_FOCAL_POINT } from "../src/lib/portfolio-universe/nebula-regions";
type AuditWindow = Window & {
  __portfolioUniverseAudit?: PortfolioUniverseRenderer;
};

async function open(page: Page, scene = "home") {
  await page.goto(`/?universeAudit=1#${scene}`);
  await expect(page.locator("[data-portfolio-universe]")).toHaveAttribute(
    "data-enhanced",
    "true",
    { timeout: 30_000 },
  );
  await expect(page.locator("[data-universe-world]")).toHaveAttribute(
    "data-artwork-ready",
    "true",
    { timeout: 30_000 },
  );
}

test("nebula entry reveals three independent clouds and no dialogs", async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-universe-destination="about"]').click();
  await expect(page.locator("#about")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await expect(page.locator("[data-portfolio-universe]")).not.toHaveAttribute(
    "data-transition-phase",
    /.+/,
  );
  await expect(page.locator("[data-cloud-toggle]")).toHaveCount(3);
  await expect(page.locator(".cloud-rear")).toHaveCount(3);
  await expect(page.locator("[data-cloud-label]")).toHaveCount(3);
  await expect(page.locator(".cloud-name:visible")).toHaveCount(3);
  for (const name of [/Music/, /Books/, /Hobbies/])
    await expect(page.getByRole("button", { name }).first()).toBeVisible();
  for (const button of await page.locator("[data-cloud-toggle]").all()) {
    await button.focus();
    await button.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
  }
  await expect(page.locator('[data-cloud][data-open="true"]')).toHaveCount(3);
  await expect(page.locator("[data-cloud-label]:visible")).toHaveText([
    "Current rotation",
    "On the nightstand",
    "Away from the screen",
  ]);
  await expect(page.locator("[data-floating-item]:visible")).toHaveCount(9);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const item = page.locator('[data-floating-item="always"]');
  await item.focus();
  await item.press("Enter");
  await expect(item).toHaveAttribute("aria-pressed", "true");
  await expect(item.locator(".item-caption")).toHaveCSS("opacity", "1");
  if (page.viewportSize()!.width <= 700) {
    await expect(page.locator("[data-cloud-caption]")).toBeVisible();
    await expect(page.locator("[data-cloud-caption]")).toContainText("Always");
  }
  await item.press("Escape");
  await expect(page.locator('[data-cloud-toggle="songs"]')).toBeFocused();
  await expect(page.locator('[data-cloud][data-open="true"]')).toHaveCount(0);
  await expect(page.locator(".cloud-name:visible")).toHaveCount(3);
  await page.locator('[data-cloud-toggle="books"]').click();
  await page.goBack();
  await expect(page.locator("#home")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await page.goForward();
  await expect(page.locator('[data-cloud][data-open="true"]')).toHaveCount(0);
  await expect(page.locator(".cloud-name:visible")).toHaveCount(3);
});

test("cloud flight keeps the shared rendering budget in both directions", async ({
  page,
}, info) => {
  await open(page);
  const samples = await page.evaluate(() => {
    const audit = (window as AuditWindow).__portfolioUniverseAudit!;
    audit.setEffectTime(0);
    return (
      [
        ["home", "about"],
        ["about", "home"],
      ] as const
    ).flatMap(([from, to]) =>
      Array.from({ length: 21 }, (_, i) => {
        audit.seekFlight(from, to, i / 20);
        const snapshot = audit.getSnapshot();
        return {
          calls: snapshot.quality.drawCalls,
          position: snapshot.camera.position,
          cloudScale: Number(
            (
              document.querySelector("[data-cloud]") as HTMLElement
            ).style.getPropertyValue("--cloud-scale"),
          ),
        };
      }),
    );
  });
  expect(
    Math.max(...samples.map((sample) => sample.calls)),
  ).toBeLessThanOrEqual(info.project.name === "mobile" ? 32 : 44);
  expect(
    Math.abs(samples[0].position[2] - samples[20].position[2]),
  ).toBeGreaterThan(60);
  expect(samples[20].cloudScale).toBeCloseTo(1, 2);
  expect(samples[0].cloudScale).toBeLessThan(samples[20].cloudScale);
  expect(samples[41].cloudScale).toBeLessThan(samples[21].cloudScale);
});

test("narrow About and context loss retain reachable controls and readable copy", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "about");
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.simulateContextLoss(),
  );
  await expect(page.locator("#about")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  for (const toggle of await page.locator("[data-cloud-toggle]").all()) {
    await toggle.locator(".cloud-name").click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  await expect(page.locator(".cloud-name:visible")).toHaveCount(3);
  for (const item of await page.locator("[data-floating-item]").all()) {
    const bounds = (await item.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    expect(bounds.y + bounds.height).toBeLessThan(650);
    await item.focus();
    await expect(item).toBeFocused();
  }
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const positions = () =>
    page
      .locator("[data-cloud-item]")
      .evaluateAll((items) =>
        items.map((item) =>
          (item as HTMLElement).style.getPropertyValue("--item-y"),
        ),
      );
  const still = await positions();
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(75000),
  );
  expect(await positions()).toEqual(still);
});

test("rapid toggles reverse reveals and missing covers keep titled controls", async ({
  page,
}) => {
  await page.route("**/almanac/always.webp", (route) => route.abort());
  await open(page, "about");
  const toggle = page.locator('[data-cloud-toggle="songs"]');
  await toggle.locator(".cloud-name").click();
  await toggle.locator(".cloud-name").click();
  await toggle.locator(".cloud-name").click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const item = page.locator('[data-floating-item="always"]');
  await expect(item.locator("[data-image-failed]")).toHaveCount(1);
  await expect(item).toHaveAccessibleName(/Always/);
  await item.focus();
  await expect(item.locator(".item-caption")).toHaveCSS("opacity", "1");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(item).toBeHidden();
});

test("cloud light remains textured at idle and gains contrast on hover and focus", async ({
  page,
}, info) => {
  await open(page, "about");
  const cloud = page.locator('[data-cloud="songs"]');
  const toggle = page.locator('[data-cloud-toggle="songs"]');
  const energy = () =>
    cloud.evaluate((e) =>
      Number(
        getComputedStyle(e.querySelector(".cloud-rear")!).filter.match(
          /brightness\(([^)]+)\)/,
        )?.[1],
      ),
    );
  await page.mouse.move(0, 0);
  await expect.poll(energy).toBeCloseTo(1, 2);
  const initial = await cloud.evaluate((e) =>
    (e as HTMLElement).style.getPropertyValue("--cloud-drift-x"),
  );
  // The source's illuminated folds brighten directly, without any veil or halo.
  await expect(cloud.locator(".cloud-light")).toHaveCount(0);
  await expect
    .poll(() =>
      cloud.evaluate((e) =>
        (e as HTMLElement).style.getPropertyValue("--cloud-drift-x"),
      ),
    )
    .not.toBe(initial);
  if (info.project.name === "desktop") {
    await toggle.hover();
    await expect.poll(energy).toBeGreaterThan(1.1);
    await page.mouse.move(0, 0);
    await expect.poll(energy).toBeLessThan(1.02);
  }
  await toggle.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.mouse.move(0, 0);
  await expect.poll(energy).toBeGreaterThan(1.1);
  expect(
    await toggle.evaluate((e) => getComputedStyle(e, "::before").outlineStyle),
  ).toBe("solid");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      cloud.evaluate((e) =>
        (e as HTMLElement).style.getPropertyValue("--cloud-drift-x"),
      ),
    )
    .toBe("0px");
  // A settled motion-preference change preserves the visitor's focused control.
  await expect(toggle).toBeFocused();
  const still = await cloud.evaluate((e) =>
    (e as HTMLElement).style.getPropertyValue("--cloud-drift-x"),
  );
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(75000),
  );
  await expect
    .poll(() =>
      cloud.evaluate((e) =>
        (e as HTMLElement).style.getPropertyValue("--cloud-drift-x"),
      ),
    )
    .toBe(still);
  await expect.poll(energy).toBeCloseTo(1.12, 2);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.simulateContextLoss(),
  );
  await expect(page.locator("[data-universe-world]")).toHaveAttribute(
    "data-webgl-ready",
    "false",
  );
  await toggle.press("Tab");
  await toggle.focus();
  await expect.poll(energy).toBeCloseTo(1.12, 2);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("closed nebula folds drift while labels stay still and reduced motion freezes them", async ({
  page,
}) => {
  await open(page, "about");
  const sample = (time: number) =>
    page.evaluate((time) => {
      (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(time);
      return [...document.querySelectorAll("[data-cloud]")].map((cloud) => ({
        drift: getComputedStyle(cloud.querySelector(".cloud-rear")!).translate,
        label: cloud
          .querySelector(".cloud-name")!
          .getBoundingClientRect()
          .toJSON(),
      }));
    }, time);
  const start = await sample(0);
  const later = await sample(5000);
  for (let i = 0; i < start.length; i++) {
    expect(later[i].drift).not.toBe(start[i].drift);
    expect(later[i].label).toEqual(start[i].label);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await sample(9000)).toEqual(await sample(19000));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.simulateContextLoss(),
  );
  expect(await sample(24000)).toEqual(await sample(44000));
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [320, 700],
]) {
  test(`natural nebula folds stay centered and clear at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "about");
    if (process.env.ABOUT_CLOUD_CAPTURE === "1")
      await page.screenshot({
        path: `.playwright-mcp/sculpted-${info.project.name}-${width}-closed.png`,
      });
    const composition = await page.evaluate(() => ({
      nebula: (window as AuditWindow).__portfolioUniverseAudit!.projectAnchor(
        "about",
      )!.bounds,
      heading: document
        .querySelector(".about-heading")!
        .getBoundingClientRect()
        .toJSON(),
      layers: [
        ...document.querySelectorAll<HTMLImageElement>(".cloud-layer"),
      ].map((layer) => ({
        source: layer.currentSrc,
        loaded: layer.complete && layer.naturalWidth > 0,
      })),
    }));
    expect(
      composition.nebula.left + NEBULA_FOCAL_POINT.x * composition.nebula.width,
    ).toBeCloseTo(width / 2, 1);
    expect(
      composition.nebula.top + NEBULA_FOCAL_POINT.y * composition.nebula.height,
    ).toBeCloseTo(height / 2, 1);
    expect(composition.heading.x + composition.heading.width / 2).toBeCloseTo(
      width / 2,
      1,
    );
    expect(composition.layers).toHaveLength(6);
    for (const layer of composition.layers) {
      expect(layer.source).toContain("/about-nebula/");
      expect(layer.loaded).toBe(true);
    }
    for (const toggle of await page.locator("[data-cloud-toggle]").all())
      await toggle.locator(".cloud-name").click();
    if (process.env.ABOUT_CLOUD_CAPTURE === "1")
      await page.screenshot({
        path: `.playwright-mcp/sculpted-${info.project.name}-${width}-open.png`,
      });
    const layout = await page.evaluate(() => ({
      labels: [...document.querySelectorAll(".cloud-name, [data-cloud-label]")]
        .filter((e) => getComputedStyle(e).display !== "none")
        .map((e) => e.getBoundingClientRect().toJSON()),
      items: [...document.querySelectorAll("[data-floating-item]")].map((e) =>
        e.getBoundingClientRect().toJSON(),
      ),
    }));
    const intersects = (a: (typeof layout.items)[number], b: typeof a) =>
      Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
      Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
    for (const label of layout.labels) {
      expect(label.left).toBeGreaterThanOrEqual(0);
      expect(label.right).toBeLessThanOrEqual(width);
      expect(label.bottom).toBeLessThanOrEqual(height);
    }
    for (const item of layout.items) {
      expect(item.left).toBeGreaterThanOrEqual(0);
      expect(item.right).toBeLessThanOrEqual(width);
      expect(item.top).toBeGreaterThan(composition.heading.bottom);
      for (const label of layout.labels)
        expect(intersects(item, label)).toBe(false);
    }
    for (let i = 0; i < layout.items.length; i++)
      for (let j = i + 1; j < layout.items.length; j++)
        expect(intersects(layout.items[i], layout.items[j])).toBe(false);
  });
}

test("category labels remain discoverable through independent and interrupted reveals", async ({
  page,
}) => {
  await open(page, "about");
  const books = page.locator('[data-cloud-toggle="books"]');
  const label = page.locator('[data-cloud="books"] [data-cloud-label]');
  await books.locator(".cloud-name").click();
  await expect(label).toBeVisible();
  await expect(label).toHaveText("On the nightstand");
  await page.locator('[data-cloud-toggle="songs"] .cloud-name').click();
  await books.locator(".cloud-name").click();
  await expect(label).toBeVisible();
  await expect(
    page.locator('[data-cloud="songs"] [data-cloud-label]'),
  ).toBeVisible();
  await books.locator(".cloud-name").click();
  await expect(label).toHaveCSS("opacity", "0.75");
  await page.keyboard.press("Escape");
  await expect(page.locator(".cloud-name:visible")).toHaveCount(3);
});

test("revealed covers remain fully exposed after the opening settles", async ({
  page,
}) => {
  await open(page, "about");
  await expect
    .poll(() =>
      page.locator(".item-artwork img").evaluateAll((images) =>
        images.every((image) => {
          const cover = image as HTMLImageElement;
          return cover.complete && cover.naturalWidth > 0;
        }),
      ),
    )
    .toBe(true);
  const samples = await page.evaluate(() => {
    const audit = (window as AuditWindow).__portfolioUniverseAudit!;
    const cloud = document.querySelector<HTMLElement>('[data-cloud="books"]')!;
    audit.setEffectTime(0);
    cloud.querySelector<HTMLButtonElement>("[data-cloud-toggle]")!.click();
    const samples: {
      progress: number;
      items: { opacity: string; clip: string }[];
    }[] = [];
    for (let frame = 1; frame <= 36; frame++) {
      audit.setEffectTime(frame * 32);
      if (frame < 21) continue;
      samples.push({
        progress: Number(cloud.style.getPropertyValue("--cloud-open")),
        items: [
          ...cloud.querySelectorAll<HTMLElement>("[data-cloud-item]"),
        ].map((item) => ({
          opacity: item.style.getPropertyValue("--item-opacity"),
          clip: getComputedStyle(item).clipPath,
        })),
      });
    }
    return samples;
  });
  expect(samples).toHaveLength(16);
  for (const sample of samples) {
    expect(sample.progress).toBe(1);
    expect(sample.items).toHaveLength(2);
    for (const item of sample.items)
      expect(item).toEqual({ opacity: "1", clip: "none" });
  }
});

test("images emerge through a foreground fold and reverse without jumping", async ({
  page,
}, info) => {
  await open(page, "about");
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(0),
  );
  const toggle = page.locator('[data-cloud-toggle="books"] .cloud-name');
  const item = page.locator('[data-cloud="books"] [data-cloud-item]').first();
  await toggle.click();
  expect(
    await item.evaluate((e) =>
      Number((e as HTMLElement).style.getPropertyValue("--item-opacity")),
    ),
  ).toBe(0);
  for (let frame = 1; frame <= 12; frame++) {
    await page.evaluate(
      (t) => (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(t),
      frame * 32,
    );
    if (process.env.ABOUT_CLOUD_CAPTURE === "1" && [3, 8, 12].includes(frame))
      await page.screenshot({
        path: `.playwright-mcp/sculpted-${info.project.name}-reveal-${frame}.png`,
      });
  }
  const before = await item.evaluate((e) =>
    (e as HTMLElement).style.getPropertyValue("--item-y"),
  );
  await toggle.click();
  expect(
    await item.evaluate((e) =>
      (e as HTMLElement).style.getPropertyValue("--item-y"),
    ),
  ).toBe(before);
  const front = page.locator('[data-cloud="books"] .cloud-front');
  await expect(front).toHaveCSS("pointer-events", "none");
  expect(
    await front.evaluate((e) => Number(getComputedStyle(e).zIndex)),
  ).toBeGreaterThan(
    await page
      .locator('[data-cloud="books"] .cloud-items')
      .evaluate((e) => Number(getComputedStyle(e).zIndex)),
  );
  for (let frame = 13; frame <= 30; frame++)
    await page.evaluate(
      (t) => (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(t),
      frame * 32,
    );
  await expect(item).toBeHidden();
});
