import { expect, test } from "@playwright/test";

test("navigation keeps its current destination and contact on reading pages", async ({
  page,
}) => {
  for (const [path, destination] of [
    ["/projects/sightline", "projects"],
    ["/photography/china", "travel"],
  ]) {
    await page.goto(path);
    const navigation = page.getByRole("navigation", {
      name: "Primary",
      exact: true,
    });
    const menu = navigation.locator("summary");
    if (await menu.isVisible()) await menu.click();
    await expect(
      navigation.locator(`a[href="/#${destination}"]:visible`),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      navigation
        .getByRole("link", { name: "Let’s talk" })
        .filter({ visible: true }),
    ).toHaveAttribute("href", "mailto:stoneyang17@gmail.com");
  }
});

test("mobile navigation names its state and dismisses without trapping focus", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/#home");
  await expect(page.locator("[data-portfolio-universe]")).toHaveAttribute(
    "data-enhanced",
    "true",
  );
  const navigation = page.getByRole("navigation", {
    name: "Primary",
    exact: true,
  });
  const details = navigation.locator(".mobile-navigation");
  const menu = navigation.locator("summary");
  const logo = navigation.getByRole("link", { name: "Stone Yang, home" });

  await menu.click();
  await expect(menu).toHaveAccessibleName("Close navigation");
  await expect(details.locator('a[href="/#home"]')).toHaveAttribute(
    "aria-current",
    "location",
  );
  const panel = await details.locator(":scope > div").boundingBox();
  expect(panel).not.toBeNull();
  expect(panel!.x).toBeGreaterThanOrEqual(-1);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(321);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(700);

  await page.keyboard.press("Escape");
  await expect(menu).toHaveAccessibleName("Open navigation");
  await expect(menu).toBeFocused();
  await expect(details).not.toHaveAttribute("open");

  await menu.click();
  await page.keyboard.press("Shift+Tab");
  await expect(logo).toBeFocused();
  await expect(details).not.toHaveAttribute("open");

  await menu.click();
  // Empty header space dismisses the menu without selecting another destination.
  await navigation.click({ position: { x: 150, y: 35 } });
  await expect(details).not.toHaveAttribute("open");

  await menu.click();
  await details.locator('a[href="/#about"]').click();
  await expect(details).not.toHaveAttribute("open");
  await expect(page.locator("#universe-about-title")).toBeFocused();
  await menu.click();
  await expect(details.locator('a[href="/#about"]')).toHaveAttribute(
    "aria-current",
    "location",
  );
  await expect(details.locator('a[href="/#home"]')).not.toHaveAttribute(
    "aria-current",
  );
});
