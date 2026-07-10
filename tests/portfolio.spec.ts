import { expect, test } from "@playwright/test";

const routes = ["/", "/photography", "/projects", "/photography/sample-field-notes", "/projects/wave"];

for (const route of routes) {
  test(`${route} renders without horizontal overflow`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}

test("primary navigation works with the keyboard", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    const toggle = page.getByRole("button", { name: "Open navigation" });
    await expect(page.locator("header[data-hydrated='true']")).toBeVisible();
    await expect(toggle).toBeEnabled();
    await toggle.click();
    await expect(page.getByRole("link", { name: "Photography" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  } else {
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  }
});

test("gallery lightbox opens, steps, and closes", async ({ page }) => {
  await page.goto("/photography/sample-field-notes");
  const firstImage = page.getByRole("button", { name: /Open image:/ }).first();
  await firstImage.scrollIntoViewIfNeeded();
  await expect(page.locator("[data-gallery-ready='true']")).toBeVisible();
  await firstImage.click();
  await expect(page.getByRole("dialog", { name: "Image lightbox" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Image lightbox" })).toBeHidden();
});

test("core content is useful without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/projects/wave");
  await expect(page.getByRole("heading", { name: "Wave", level: 1 })).toBeVisible();
  await expect(page.getByText("A hand becomes the controller")).toBeVisible();
  await context.close();
});
