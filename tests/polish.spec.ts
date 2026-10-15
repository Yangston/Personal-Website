import { expect, test } from "@playwright/test";

test("Home keeps native navigation, resume and contact without extra action buttons", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/#home");
  await expect(page.locator("[data-portfolio-universe]")).toHaveAttribute(
    "data-enhanced",
    "true",
  );
  await expect(page.getByRole("link", { name: "Explore my work" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "See the world" })).toHaveCount(
    0,
  );
  await expect(page.locator("[data-home-regions] a")).toHaveCount(3);
  const resume = page.locator("#home").getByRole("link", { name: "Résumé" });
  await expect(resume).toHaveAttribute("href", "/resume.pdf");
  await expect(resume).toHaveAttribute("rel", /noreferrer/);
  for (const link of [resume]) {
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.y).toBeGreaterThanOrEqual(72);
    expect(box.y + box.height).toBeLessThanOrEqual(700);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const hit = await link.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return node.contains(
        document.elementFromPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        ),
      );
    });
    expect(hit).toBe(true);
  }
  await page
    .getByRole("navigation", { name: "Primary", exact: true })
    .getByLabel("Open navigation")
    .click();
  await expect(
    page
      .locator(".mobile-navigation")
      .getByRole("link", { name: "Let’s talk" }),
  ).toHaveAttribute("href", "mailto:stoneyang17@gmail.com");
  await page.locator('.mobile-navigation a[href="/#projects"]').click();
  await expect(page.locator("#projects")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  expect((await page.request.get("/resume.pdf")).ok()).toBe(true);
});

test("mobile About captions remain separate from contact controls", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/#about");
  await expect(page.locator("[data-portfolio-universe]")).toHaveAttribute(
    "data-enhanced",
    "true",
  );
  await page.locator('[data-cloud-toggle="songs"]').click();
  await page
    .locator('[data-cloud="songs"] [data-floating-item]')
    .first()
    .focus();
  const caption = page.locator("[data-cloud-caption]");
  const connect = page.getByRole("navigation", { name: "Connect with Stone" });
  await expect(caption).toBeVisible();
  await expect(connect).toBeVisible();
  const captionBox = (await caption.boundingBox())!;
  const contactBox = (await connect.boundingBox())!;
  expect(
    Math.min(
      captionBox.y + captionBox.height,
      contactBox.y + contactBox.height,
    ) - Math.max(captionBox.y, contactBox.y),
  ).toBeLessThanOrEqual(0);
});

test("new homepage links remain usable in the static document", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 700 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("#home .home-actions a")).toHaveCount(0);
    await expect(page.locator('#home a[href="/resume.pdf"]')).toBeVisible();
    await expect(
      page.locator('#about a[href="mailto:stoneyang17@gmail.com"]'),
    ).toHaveText(/Say hello/);
    await expect(page.locator('#home a[href="/#projects"]')).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test("country cards use described responsive archive thumbnails", async ({
  page,
}) => {
  await page.goto("/photography/canada");
  const cards = page.locator(".country-city-grid article");
  expect(await cards.count()).toBeGreaterThan(0);
  for (const card of await cards.all()) {
    const photo = card.locator(".city-directory-image img");
    await expect(photo).toHaveCount(1);
    await expect(photo).toHaveAttribute("alt", /\S+/);
    await expect(photo).toHaveAttribute("width", /^[1-9]\d*$/);
    await expect(photo).toHaveAttribute("height", /^[1-9]\d*$/);
    await expect(photo).toHaveAttribute("srcset", /\.webp \d+w/);
    await expect(photo).toHaveAttribute("sizes", /max-width/);
    await expect(photo).toHaveAttribute("loading", "lazy");
    const source = (await photo.getAttribute("src"))!;
    expect(source).toMatch(/^\/media\/photography\/.*\.webp$/);
    expect((await page.request.get(source)).ok()).toBe(true);
    await expect(card.getByRole("link")).toHaveAttribute(
      "href",
      /^\/photography\/canada\/[^/]+$/,
    );
  }
});

test("missing pages are noindexed and offer real recovery links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const response = await page.goto("/a-page-that-does-not-exist/");
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /find a way back/,
  );
  const recovery = page.getByRole("navigation", { name: "Find your way back" });
  await expect(
    recovery.getByRole("link", { name: "Return home" }),
  ).toHaveAttribute("href", "/");
  await expect(
    recovery.getByRole("link", { name: "Explore projects" }),
  ).toHaveAttribute("href", "/#projects");
  await expect(
    recovery.getByRole("link", { name: "Travel archive" }),
  ).toHaveAttribute("href", "/#travel");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await recovery.getByRole("link", { name: "Return home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#universe-home-title")).toBeVisible();
});
