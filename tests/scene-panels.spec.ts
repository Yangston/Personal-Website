import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
const ROOT = "[data-portfolio-universe]";
const SIGHTLINE = '[data-project-id="sightline"] [data-project-constellation]';
const PANEL = '[data-project-preview="sightline"]';
async function openProjects(page: Page) {
  await page.goto("/?universeAudit=1#projects");
  await expect(page.locator(ROOT)).toHaveAttribute("data-enhanced", "true");
  await expect(page.locator("#projects")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
}

test("constellation links navigate directly with click and keyboard", async ({
  page,
}) => {
  await openProjects(page);
  const link = page.locator(SIGHTLINE);
  await expect(link).toHaveRole("link");
  await expect(link).not.toHaveAttribute("aria-haspopup");
  await link.click();
  await expect(page).toHaveURL(/\/projects\/sightline\/?$/);
  await page.goBack();
  await expect(page.locator(ROOT)).toHaveAttribute("data-enhanced", "true");
  await page.locator(SIGHTLINE).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/projects\/sightline\/?$/);
});

test("focus previews authored content without moving focus, and Escape dismisses", async ({
  page,
}) => {
  await openProjects(page);
  const link = page.locator(SIGHTLINE);
  await link.focus();
  await expect(link).toBeFocused();
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAccessibleName("Sightline");
  await expect(panel.locator(".project-preview-summary")).not.toBeEmpty();
  await expect(panel.locator(".project-preview-facts")).toContainText("2026");
  await expect(
    panel.getByRole("list", { name: "Technology stack" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(link).toBeFocused();
});

test("pointer crosses to the preview, then departure closes it", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile);
  await openProjects(page);
  await page.locator(SIGHTLINE).hover();
  await expect(page.locator(PANEL)).toBeVisible();
  await page.locator(PANEL).hover();
  await expect(page.locator(PANEL)).toBeVisible();
  await page.mouse.move(10, 100);
  await expect(page.locator(PANEL)).toBeHidden();
  for (const link of await page.locator("[data-project-constellation]").all()) {
    await link.hover();
    await expect(page.locator("[data-project-preview]:visible")).toHaveCount(1);
    const id = await link.evaluate(
      (node) =>
        node.closest<HTMLElement>("[data-project-id]")!.dataset.projectId,
    );
    await expect(page.locator(ROOT)).toHaveAttribute(
      "data-interaction-target",
      `project:${id}`,
    );
    await expect(
      page.locator("[data-project-preview]:visible"),
    ).toHaveAttribute("data-project-preview", id!);
  }
});

test("touch preview has its own control, fits 320px and closes cleanly", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.setViewportSize({ width: 320, height: 700 });
  await openProjects(page);
  const info = page.locator('[data-project-info="sightline"]');
  for (const control of await page.locator("[data-project-info]").all())
    await expect(control).toHaveAttribute("data-info-ready", "true");
  const clearTargets = await page.evaluate(() => {
    const labels = [
      ...document.querySelectorAll(".project-constellation-copy"),
    ].map((node) => node.getBoundingClientRect());
    return [...document.querySelectorAll("[data-project-info]")].every(
      (node) => {
        const box = node.getBoundingClientRect();
        return (
          box.width >= 44 &&
          box.height >= 44 &&
          box.left >= 0 &&
          box.right <= innerWidth &&
          box.top >= 0 &&
          box.bottom <= innerHeight &&
          labels.every(
            (label) =>
              Math.min(box.right, label.right) <=
                Math.max(box.left, label.left) ||
              Math.min(box.bottom, label.bottom) <=
                Math.max(box.top, label.top),
          )
        );
      },
    );
  });
  expect(clearTargets).toBe(true);
  await info.click();
  await expect(info).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator(PANEL);
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y + box.height).toBeLessThanOrEqual(700);
  await panel.locator("[data-preview-close]").click();
  await expect(panel).toBeHidden();
  await expect(info).toBeFocused();
  await page.locator(SIGHTLINE).click();
  await expect(page).toHaveURL(/\/projects\/sightline\/?$/);
});

test("modified links preserve native navigation and Back clears previews", async ({
  page,
  context,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#home");
  await expect(page.locator(ROOT)).toHaveAttribute("data-enhanced", "true");
  await page.locator('[data-universe-destination="projects"]').click();
  await page.locator(SIGHTLINE).focus();
  await expect(page.locator(PANEL)).toBeVisible();
  if (!isMobile) {
    const newPage = context.waitForEvent("page");
    await page.locator(SIGHTLINE).click({ modifiers: ["Control"] });
    const detail = await newPage;
    await detail.bringToFront();
    await detail.waitForLoadState("domcontentloaded");
    await expect(detail).toHaveURL(/\/projects\/sightline\/?$/);
    await detail.close();
  }
  await page.goBack();
  await expect(page.locator("#home")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await expect(page.locator(PANEL)).toBeHidden();
});

test("without JavaScript the project listing remains readable and links navigate", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    ...testInfo.project.use,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  try {
    await page.goto("/#projects");
    const link = page.locator(SIGHTLINE);
    await expect(link).toHaveRole("link");
    await expect(link.locator(".project-constellation-summary")).toBeVisible();
    await expect(page.locator(PANEL)).toBeHidden();
    // Exercise native pointer input without in-page stability timers, which
    // can stall in Chrome contexts where JavaScript is disabled.
    const title = link.locator(".project-constellation-copy strong");
    const initial = await title.boundingBox();
    if (!initial) throw new Error("The project title is missing");
    const height = page.viewportSize()!.height;
    await page.mouse.wheel(0, initial.y + initial.height / 2 - height / 2);
    await expect
      .poll(async () => {
        const box = await title.boundingBox();
        return Boolean(
          box && box.y >= 100 && box.y + box.height <= height - 100,
        );
      })
      .toBe(true);
    const box = (await title.boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    expect(
      await title.evaluate(
        (node, { x, y }) =>
          document.elementFromPoint(x, y)?.closest("a") === node.closest("a"),
        point,
      ),
    ).toBe(true);
    await page.mouse.click(point.x, point.y);
    await expect(page).toHaveURL(/\/projects\/sightline\/?$/);
  } finally {
    await context.close();
  }
});
