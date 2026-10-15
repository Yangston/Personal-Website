import { expect, test } from "@playwright/test";

const countryRoute = "/photography/canada";
const cityRoute = "/photography/canada/toronto";

test("detail pages retain readable ivory layouts and real return destinations", async ({
  page,
}) => {
  for (const route of [
    "/projects/robotic-card-thrower",
    countryRoute,
    cityRoute,
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    const layout = await page
      .locator(".project-case-study, .country-page, .city-page")
      .evaluate((element) => ({
        color: getComputedStyle(element).color,
        overflow: document.documentElement.scrollWidth - innerWidth,
        dark: document.documentElement.classList.contains("dark"),
      }));
    expect(layout.dark, route).toBe(false);
    expect(layout.color, route).toBe("rgb(23, 22, 21)");
    expect(layout.overflow, route).toBeLessThanOrEqual(1);
    await expect(
      page
        .locator(
          `main a[href="/#${route.startsWith("/projects") ? "projects" : "travel"}"]`,
        )
        .first(),
    ).toBeVisible();
  }
});

test("city lightbox rebinds after client navigation while the backdrop persists", async ({
  page,
}) => {
  await page.goto(cityRoute);
  const backdrop = page.locator("[data-cosmic-backdrop]");
  await backdrop.evaluate((element) => {
    (element as HTMLElement).dataset.detailContinuity = "same-world";
  });

  for (let visit = 0; visit < 2; visit += 1) {
    const photo = page.locator(".city-lightbox-trigger").first();
    await photo.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Toronto image lightbox" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Close lightbox" }),
    ).toBeFocused();
    const firstSource = await dialog.locator("img").getAttribute("src");
    await page.keyboard.press("ArrowRight");
    await expect(dialog.locator("img")).not.toHaveAttribute(
      "src",
      firstSource!,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(photo).toBeFocused();

    if (visit === 0) {
      await page
        .locator(`.city-page-breadcrumb a[href="${countryRoute}"]`)
        .click();
      await expect(page).toHaveURL(countryRoute);
      await page.locator(`.country-city-grid a[href="${cityRoute}"]`).click();
      await expect(page).toHaveURL(cityRoute);
      await expect(backdrop).toHaveAttribute(
        "data-detail-continuity",
        "same-world",
      );
    }
  }
});

test("320px lightbox gives the photograph the available width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(cityRoute);
  await page.locator(".city-lightbox-trigger").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const image = await dialog.locator("img").boundingBox();
  const previous = await dialog
    .getByRole("button", { name: "Previous image" })
    .boundingBox();
  expect(image?.width).toBeGreaterThanOrEqual(280);
  expect(previous?.y).toBeGreaterThanOrEqual(
    (image?.y ?? 0) + (image?.height ?? 0),
  );
  expect(previous?.width).toBeGreaterThanOrEqual(44);
  expect(
    await dialog.evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test("gallery images retain a full-size link without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 700 },
  });
  const page = await context.newPage();
  await page.goto(cityRoute);
  const photo = page.locator(".city-lightbox-trigger").first();
  await expect(photo).toHaveAttribute(
    "href",
    /\/media\/photography\/.+\.webp$/,
  );
  await expect(photo.locator("img")).toBeVisible();
  await context.close();
});
