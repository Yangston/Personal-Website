import type { Page } from "@playwright/test";

export async function pointFor(page: Page, id: string) {
  return page
    .locator(`[data-universe-destination="${id}"]`)
    .evaluate((link) => {
      const box = link.getBoundingClientRect();
      const left = Math.max(2, box.left),
        right = Math.min(innerWidth - 2, box.right),
        top = Math.max(80, box.top),
        bottom = Math.min(innerHeight - 2, box.bottom);
      for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8])
        for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
          const x = left + (right - left) * fx,
            y = top + (bottom - top) * fy;
          if (document.elementFromPoint(x, y)?.closest("a") === link)
            return { x, y };
        }
      throw new Error(
        `No visible hit region for ${link.getAttribute("aria-label")}`,
      );
    });
}
