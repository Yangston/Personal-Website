import { expect, test } from "@playwright/test";
import type { PortfolioUniverseRenderer } from "../src/lib/portfolio-universe/renderer";
type AuditWindow = Window & {
  __portfolioUniverseAudit?: PortfolioUniverseRenderer;
};
test.use({ video: process.env.HOME_LAYER_CAPTURE === "1" ? "on" : "off" });

test("Earth journey carries foreground banks away and restores the cloud-layered Home", async ({
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
  await expect(page.locator("[data-cloud-reveal]")).not.toHaveAttribute(
    "data-intro-state",
    /playing|waiting/,
  );
  await page.evaluate(() =>
    (window as AuditWindow).__portfolioUniverseAudit!.setEffectTime(0),
  );
  const initial = await page.locator("[data-world-body]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const bounds = node.getBoundingClientRect();
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    }),
  );
  if (process.env.HOME_LAYER_CAPTURE === "1")
    await page.screenshot({ path: info.outputPath("home.png") });
  await page.locator('[data-universe-destination="travel"]').focus();
  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("data-active-scene", "travel");
  await expect(root).not.toHaveAttribute("data-transition-phase", /.+/);
  if (process.env.HOME_LAYER_CAPTURE === "1")
    await page.screenshot({ path: info.outputPath("travel.png") });
  await page.locator('#travel a[href="/#home"]').click();
  await expect(root).toHaveAttribute("data-active-scene", "home");
  await expect(root).not.toHaveAttribute("data-transition-phase", /.+/);
  const restored = await page
    .locator("[data-world-body]")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const bounds = node.getBoundingClientRect();
        return {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        };
      }),
    );
  for (let i = 0; i < initial.length; i++)
    for (const axis of ["x", "y", "width", "height"] as const)
      expect(Math.abs(initial[i][axis] - restored[i][axis])).toBeLessThan(1);
  const samples = await page.evaluate(() => {
    const audit = (window as AuditWindow).__portfolioUniverseAudit!;
    return (
      [
        ["home", "travel"],
        ["travel", "home"],
      ] as const
    ).flatMap(([from, to]) =>
      Array.from({ length: 41 }, (_, i) => {
        const snapshot = audit.seekFlight(from, to, i / 40);
        return {
          calls: snapshot.quality.drawCalls,
          opacities: ["foreground-left", "foreground-bottom"].map((id) =>
            Number(
              (
                document.querySelector(
                  `[data-world-plane="${id}"]`,
                ) as HTMLElement
              ).style.opacity,
            ),
          ),
        };
      }),
    );
  });
  for (const sample of samples) {
    expect(sample.opacities[0]).toBeCloseTo(0.97, 6);
    expect(sample.opacities[1]).toBeCloseTo(0.9, 6);
    expect(sample.calls).toBeLessThanOrEqual(
      info.project.name === "mobile" ? 32 : 44,
    );
  }
  await expect(
    page.locator("[data-world-body] a,[data-world-body] button"),
  ).toHaveCount(0);
});
