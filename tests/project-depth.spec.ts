import { expect, test } from "@playwright/test";
import type { PortfolioUniverseRenderer } from "../src/lib/portfolio-universe/renderer";
type AuditWindow = Window & {
  __portfolioUniverseAudit?: PortfolioUniverseRenderer;
};

test("golden project flight crosses foreground layers and keeps the rendering budget", async ({
  page,
}, info) => {
  await page.goto("/?universeAudit=1#home");
  const root = page.locator("[data-portfolio-universe]");
  await expect(root).toHaveAttribute("data-renderer-ready", "true", {
    timeout: 30000,
  });
  await expect(page.locator("[data-universe-world]")).toHaveAttribute(
    "data-artwork-ready",
    "true",
  );
  await page.locator('[data-universe-destination="projects"]').focus();
  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("data-active-scene", "projects");
  await expect(root).not.toHaveAttribute("data-transition-phase", /.+/);
  await expect(page.locator("#project-sky-title")).toBeFocused();
  const before = await page
    .locator("[data-universe-world]")
    .getAttribute("data-constellation-point-geometry");
  const samples = await page.evaluate(() => {
    const audit = (window as AuditWindow).__portfolioUniverseAudit!;
    audit.setEffectTime(0);
    return (
      [
        ["home", "projects"],
        ["projects", "home"],
      ] as const
    ).map(([from, to]) =>
      Array.from({ length: 21 }, (_, i) => {
        audit.seekFlight(from, to, i / 20);
        const frame = audit.getSnapshot();
        return { calls: frame.quality.drawCalls, z: frame.camera.position[2] };
      }),
    );
  });
  for (const flight of samples) {
    expect(Math.abs(flight[0].z - flight[20].z)).toBeGreaterThan(120);
    expect(Math.max(...flight.map((f) => f.calls))).toBeLessThanOrEqual(
      info.project.name === "mobile" ? 32 : 44,
    );
  }
  expect(
    await page
      .locator("[data-universe-world]")
      .getAttribute("data-constellation-point-geometry"),
  ).toBe(before);
});

test("narrow Projects stays readable and Home fallback stars survive context loss", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?universeAudit=1#projects");
  await expect(page.locator("[data-universe-world]")).toHaveAttribute(
    "data-artwork-ready",
    "true",
  );
  for (const link of await page
    .locator("#projects [data-project-constellation]")
    .all()) {
    await link.focus();
    await expect(page.locator("[data-project-preview]:visible")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(link).toBeFocused();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.simulateContextLoss(),
  );
  await page.locator("#projects .project-return").click();
  const fallback = page.locator("[data-world-project-fallback]");
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("viewBox", "0 0 320 700");
  expect(await fallback.locator("[data-star]").count()).toBeGreaterThan(20);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(fallback).toHaveAttribute("viewBox", "0 0 1440 900");
});
