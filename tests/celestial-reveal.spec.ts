import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import cloudArtwork from "../src/data/cloudscape-artwork.json" with { type: "json" };

const REVEAL = "[data-cloud-reveal]";
const BANKS = `${REVEAL} [data-cloud-direction]`;
const STORAGE_KEY = "celestial-cloud-reveal-v1";

// Hold only the decorative reveal timeline. The application, navigation, and
// WebGL startup still run normally, so slow renderer startup cannot hide bugs.
async function holdReveal(page: Page) {
  // The held animation still needs a foreground rendering frame to be created.
  await page.bringToFront();
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      if (this.matches("[data-cloud-direction]")) animation.pause();
      return animation;
    };
  });
}

async function expectPlaying(page: Page) {
  await expect(page.locator(REVEAL)).toHaveAttribute(
    "data-intro-state",
    "playing",
  );
  await expect(page.locator(REVEAL)).toBeVisible();
  // Cold renderer compilation can block a protocol evaluation for >5 seconds
  // after the inline reveal has already started. Await its rendering frame
  // in-page rather than putting a short host-side deadline around that call.
  await page.waitForFunction(
    () => {
      const banks = [
        ...document.querySelectorAll(
          "[data-cloud-reveal] [data-cloud-direction]",
        ),
      ];
      return (
        banks.length === 2 &&
        banks.every((bank) => bank.getAnimations().length === 1)
      );
    },
    undefined,
    { timeout: 20_000 },
  );
}

async function finishReveal(page: Page) {
  await page.locator(BANKS).evaluateAll((banks) => {
    for (const bank of banks)
      for (const animation of bank.getAnimations()) animation.finish();
  });
  await expect(page.locator(REVEAL)).toHaveAttribute(
    "data-intro-state",
    "finished",
  );
  await expect(page.locator(REVEAL)).toBeHidden();
}

async function bankPositions(page: Page, time: number) {
  return page.locator(BANKS).evaluateAll(
    (banks, currentTime) =>
      banks.map((bank) => {
        for (const animation of bank.getAnimations())
          animation.currentTime = currentTime;
        const bounds = bank.getBoundingClientRect();
        return {
          direction: (bank as HTMLElement).dataset.cloudDirection,
          x: bounds.x,
          y: bounds.y,
          opacity: Number(getComputedStyle(bank).opacity),
        };
      }),
    time,
  );
}

test("waits for decoded cloud banks before consuming the opening", async ({
  page,
}) => {
  await holdReveal(page);
  let releaseImages!: () => void;
  const imagesReleased = new Promise<void>((resolve) => {
    releaseImages = resolve;
  });
  await page.route(
    "**/media/site/celestial/cloudscape-v3/{upper-left,lower-left}-*.webp",
    async (route) => {
      await imagesReleased;
      await route.continue();
    },
  );
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator(REVEAL)).toHaveAttribute(
      "data-intro-state",
      "waiting",
    );
    expect(
      await page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY),
    ).toBeNull();
    releaseImages();
    await expectPlaying(page);
    expect(
      await page
        .locator(BANKS)
        .evaluateAll((banks) =>
          banks.every((bank) => (bank as HTMLImageElement).naturalWidth > 0),
        ),
    ).toBe(true);
    await finishReveal(page);
  } finally {
    releaseImages();
  }
});

test("a delayed cloud download releases the veil and leaves the opening unconsumed", async ({
  page,
}) => {
  let releaseImages!: () => void;
  const imagesReleased = new Promise<void>((resolve) => {
    releaseImages = resolve;
  });
  await page.route(
    "**/media/site/celestial/cloudscape-v3/{upper-left,lower-left}-*.webp",
    async (route) => {
      await imagesReleased;
      await route.continue();
    },
  );
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator(REVEAL)).toHaveAttribute(
      "data-intro-state",
      "skipped",
    );
    await expect(page.locator(REVEAL)).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Stone Yang.", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY),
    ).toBeNull();
  } finally {
    releaseImages();
  }
});

test("first Home parts two clouds diagonally over 1600 ms without waiting for scripts", async ({
  page,
}) => {
  await holdReveal(page);
  // Exercise the fast-load path with the actual pixels. Slow downloads and
  // decode gating have separate tests; routing otherwise disables HTTP cache.
  const banks = new Map(
    await Promise.all(
      [cloudArtwork["upper-left"], cloudArtwork["lower-left"]]
        .flatMap((variants) => Object.values(variants))
        .map(
          async (image) =>
            [
              image.source,
              await readFile(
                new URL(`../public${image.source}`, import.meta.url),
              ),
            ] as const,
        ),
    ),
  );
  // Abort external modules rather than leaving them pending: pending module
  // loads can hold Chromium's first paint and image decode in mobile emulation.
  await page.route("**/*", (route) => {
    const bank = banks.get(new URL(route.request().url()).pathname);
    if (bank) return route.fulfill({ contentType: "image/webp", body: bank });
    return route.request().resourceType() === "script"
      ? route.abort()
      : route.continue();
  });

  await page.goto("/", { waitUntil: "commit" });
  await expectPlaying(page);
  await expect(page.locator("[data-portfolio-universe]")).toHaveAttribute(
    "data-enhanced",
    "false",
  );
  await expect(page.locator(REVEAL)).toHaveCSS("pointer-events", "none");
  expect(
    await page
      .locator(BANKS)
      .evaluateAll((banks) =>
        banks.flatMap((bank) =>
          bank
            .getAnimations()
            .map((animation) => animation.effect!.getTiming().duration),
        ),
      ),
  ).toEqual([1600, 1600]);

  const start = await bankPositions(page, 0);
  const middle = await bankPositions(page, 800);
  const viewport = page.viewportSize()!;
  for (const [index, initial] of start.entries()) {
    const current = middle[index];
    if (initial.direction === "upper-right") {
      expect(current.x - initial.x).toBeGreaterThan(viewport.width * 0.3);
      expect(initial.y - current.y).toBeGreaterThan(viewport.height * 0.3);
    } else {
      expect(initial.direction).toBe("lower-left");
      expect(initial.x - current.x).toBeGreaterThan(viewport.width * 0.3);
      expect(current.y - initial.y).toBeGreaterThan(viewport.height * 0.3);
    }
    expect(current.opacity).toBeLessThan(initial.opacity);
  }
  await bankPositions(page, 1599);
  await expect(page.locator(REVEAL)).toHaveAttribute(
    "data-intro-state",
    "playing",
  );
  await finishReveal(page);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), STORAGE_KEY),
  ).toBe("seen");
});

test("plays once per tab and stays dismissed on scene return and refresh", async ({
  page,
}) => {
  await holdReveal(page);
  await page.goto("/");
  await expectPlaying(page);
  await finishReveal(page);
  await expect(page.locator("[data-portfolio-universe]")).toHaveAttribute(
    "data-enhanced",
    "true",
  );
  await page.locator('[data-universe-destination="travel"]').click();
  await expect(page.locator("#travel")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await page.locator('#travel a[href="/#home"]').click();
  await expect(page.locator("#home")).toHaveAttribute(
    "data-scene-active",
    "true",
  );
  await expect(page.locator(REVEAL)).toHaveAttribute(
    "data-intro-state",
    "finished",
  );
  await expect(page.locator(REVEAL)).toBeHidden();
  await page.reload();
  await expect(page.locator(REVEAL)).toHaveAttribute(
    "data-intro-state",
    "skipped",
  );
  await expect(page.locator(REVEAL)).toBeHidden();
});

for (const scene of ["about", "projects", "travel"] as const) {
  test(`direct ${scene} skips the Home reveal`, async ({ page }) => {
    await holdReveal(page);
    await page.goto(`/#${scene}`);
    await expect(page.locator(REVEAL)).toHaveAttribute(
      "data-intro-state",
      "skipped",
    );
    await expect(page.locator(REVEAL)).toBeHidden();
    expect(
      await page
        .locator(BANKS)
        .evaluateAll(
          (banks) => banks.flatMap((bank) => bank.getAnimations()).length,
        ),
    ).toBe(0);
    await expect(page.locator(`#${scene}`)).toHaveAttribute(
      "data-scene-active",
      "true",
    );
  });
}

test("reduced motion reveals Home immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(REVEAL)).toHaveAttribute(
    "data-intro-state",
    "skipped",
  );
  await expect(page.locator(REVEAL)).toBeHidden();
  await expect(page.locator("#universe-home-title")).toBeVisible();
  expect(
    await page
      .locator(BANKS)
      .evaluateAll(
        (banks) => banks.flatMap((bank) => bank.getAnimations()).length,
      ),
  ).toBe(0);
});

for (const input of ["pointer", "keyboard"] as const) {
  test(`${input} navigation immediately dismisses the opening clouds`, async ({
    page,
  }) => {
    await holdReveal(page);
    await page.goto("/");
    await expectPlaying(page);
    await expect(page.locator("[data-portfolio-universe]")).toHaveAttribute(
      "data-enhanced",
      "true",
    );
    const destination = page.locator('[data-universe-destination="projects"]');
    if (input === "pointer") await destination.click();
    else {
      await destination.focus();
      await destination.press("Enter");
    }
    await expect(page.locator(REVEAL)).toHaveAttribute(
      "data-intro-state",
      "finished",
      { timeout: 500 },
    );
    await expect(page.locator(REVEAL)).toBeHidden();
    expect(
      await page
        .locator(BANKS)
        .evaluateAll(
          (banks) => banks.flatMap((bank) => bank.getAnimations()).length,
        ),
    ).toBe(0);
    await expect(page).toHaveURL(/#projects$/);
    await expect(page.locator("#projects")).toHaveAttribute(
      "data-scene-active",
      "true",
    );
    await expect(page.locator("#project-sky-title")).toBeFocused();
  });
}
