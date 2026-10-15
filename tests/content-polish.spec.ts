import { expect, test } from "@playwright/test";

test("shared links expose a working raster preview on home, projects, and archives", async ({
  request,
}) => {
  for (const route of [
    "/",
    "/projects/sightline",
    "/projects/sleep-wake-model",
    "/projects/robotic-card-thrower",
    "/photography/china",
    "/photography/china/chongqing",
  ]) {
    const response = await request.get(route);
    expect(response.ok(), route).toBe(true);
    const html = await response.text();
    const preview = html.match(/property="og:image" content="([^"]+)"/)?.[1];
    expect(preview, route).toBeTruthy();
    const image = await request.get(new URL(preview!).pathname);
    expect(image.ok(), `${route}: preview image`).toBe(true);
    expect(image.headers()["content-type"], route).toMatch(
      /^image\/(?:png|webp|jpeg)/,
    );
  }
});

test("case studies have usable section links and continue to another project", async ({
  page,
}) => {
  await page.goto("/projects/sleep-wake-model");
  const contents = page.getByRole("navigation", { name: "On this page" });
  await contents
    .getByRole("link", { name: /Grounded in clinical sleep testing/ })
    .click();
  await expect(page).toHaveURL(/#grounded-in-clinical-sleep-testing$/);
  await expect(
    page.getByRole("heading", { name: "Grounded in clinical sleep testing" }),
  ).toBeInViewport();
  const nextProject = page.locator(".project-case-next > a").first();
  await expect(nextProject).toHaveAttribute("href", /^\/projects\//);
  const destination = await nextProject.getAttribute("href");
  expect(destination).not.toBe("/projects/sleep-wake-model");
  await nextProject.click();
  await expect(page).toHaveURL(destination!);
  await expect(page.locator("main h1")).toBeVisible();
});
