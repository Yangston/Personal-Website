import sharp from "sharp";
import { resolveCloudLayout } from "../../src/lib/portfolio-universe/cloud-layout";
import { describe, expect, it } from "vitest";
import {
  advanceCloudReveal,
  sampleCloudItem,
  sampleCloudDrift,
} from "../../src/lib/portfolio-universe/about-clouds";
import { almanac } from "../../src/config/almanac";
import { existsSync } from "node:fs";
describe("cloud reveals", () => {
  it.each([16, 32, 64])(
    "settles at either endpoint without repeatedly reopening at %ims per frame",
    (delta) => {
      let progress = 0;
      for (let frame = 0; frame < 100; frame++) {
        const next = advanceCloudReveal(progress, true, delta);
        expect(next).toBeGreaterThanOrEqual(progress);
        expect(next).toBeLessThanOrEqual(1);
        progress = next;
      }
      expect(progress).toBe(1);
      for (let frame = 0; frame < 100; frame++) {
        const next = advanceCloudReveal(progress, false, delta);
        expect(next).toBeLessThanOrEqual(progress);
        expect(next).toBeGreaterThanOrEqual(0);
        progress = next;
      }
      expect(progress).toBe(0);
    },
  );
  it("reverses from the current reveal and resolves reduced motion immediately", () => {
    const progress = advanceCloudReveal(0, true, 300);
    expect(advanceCloudReveal(progress, false, 0)).toBe(progress);
    expect(advanceCloudReveal(progress, true, 0)).toBe(progress);
    expect(advanceCloudReveal(progress, false, 32)).toBeLessThan(progress);
    expect(advanceCloudReveal(progress, true, 32)).toBeGreaterThan(progress);
    expect(advanceCloudReveal(progress, true, 0, true)).toBe(1);
    expect(advanceCloudReveal(progress, false, 0, true)).toBe(0);
  });
  it("gives closed clouds distinct bounded drift and a stationary fallback", () => {
    for (let index = 0; index < 3; index++) {
      expect(sampleCloudDrift(0, index)).not.toEqual(
        sampleCloudDrift(5000, index),
      );
      expect(sampleCloudDrift(0, index, true)).toEqual(
        sampleCloudDrift(90000, index, true),
      );
      for (let time = 0; time < 90000; time += 500) {
        const drift = sampleCloudDrift(time, index);
        expect(Math.abs(drift.x)).toBeLessThanOrEqual(3);
        expect(Math.abs(drift.y)).toBeLessThanOrEqual(4);
        expect(Math.abs(drift.roll)).toBeLessThanOrEqual(1.2);
        expect(drift.breath).toBeGreaterThanOrEqual(0.982);
        expect(drift.breath).toBeLessThanOrEqual(1.018);
      }
    }
    expect(
      new Set([0, 1, 2].map((i) => sampleCloudDrift(3000, i).x)).size,
    ).toBe(3);
  });
  it.each([2, 3, 4])(
    "keeps %i revealed items separated and inside a 320px scene",
    (count) => {
      const positions = Array.from({ length: count }, (_, i) =>
        sampleCloudItem(1, i, count, 2400, true, false),
      );
      for (const item of positions) {
        expect(item.x - 28).toBeGreaterThan(-160);
        expect(item.x + 28).toBeLessThan(160);
        expect(item.opacity).toBe(1);
        expect(item.y).toBeLessThan(0);
      }
      for (let i = 1; i < positions.length; i++)
        expect(positions[i].x - positions[i - 1].x).toBeGreaterThanOrEqual(58);
    },
  );
  it("starts behind the foreground, reverses continuously, and freezes reduced motion", () => {
    expect(sampleCloudItem(0, 0, 3, 0, false, false)).toMatchObject({
      clip: 100,
      opacity: 0,
    });
    const a = sampleCloudItem(0.5, 0, 3, 1000, false, false);
    const b = sampleCloudItem(0.499, 0, 3, 1000, false, false);
    expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    expect(sampleCloudItem(1, 0, 3, 0, false, true)).toEqual(
      sampleCloudItem(1, 0, 3, 9000, false, true),
    );
  });
  it("gently starts and settles each item's staggered emergence", () => {
    // The first item uses 1.24 times the group clock; inspect its own reveal interval.
    const position = (progress: number) =>
      sampleCloudItem(progress / 1.24, 0, 3, 0, false, false).y;
    const start = position(0);
    const end = position(1);
    const distance = Math.abs(end - start);
    const openingFraction = Math.abs(position(0.1) - start) / distance;
    const settlingFraction = Math.abs(end - position(0.9)) / distance;
    expect(openingFraction).toBeGreaterThan(0);
    expect(openingFraction).toBeLessThan(0.02);
    expect(settlingFraction).toBeGreaterThan(0);
    expect(settlingFraction).toBeLessThan(0.02);
    expect(openingFraction).toBeCloseTo(settlingFraction, 10);
  });
  it("retains all authored entries with unique IDs and local, credited covers", () => {
    const entries = [...almanac.songs, ...almanac.books, ...almanac.hobbies];
    expect(entries).toHaveLength(9);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(9);
    for (const entry of [...almanac.songs, ...almanac.books]) {
      expect(existsSync(`public${entry.artwork.source}`)).toBe(true);
      expect(entry.artwork.sourceCredit).not.toBe("");
      expect(entry.artwork.width).toBeGreaterThan(0);
      expect(entry.artwork.height).toBeGreaterThan(0);
    }
  });
});

describe("sculpted cloud layout", () => {
  it.each([
    [320, 700],
    [390, 844],
    [701, 900],
    [1440, 900],
  ])("reserves non-overlapping revealed rows at %ix%i", (width, height) => {
    const slots = resolveCloudLayout(width, height);
    const boxes = slots.flatMap((slot) =>
      almanac[slot.id].map((entry, index, entries) => {
        const aspect =
          "artwork" in entry ? entry.artwork.height / entry.artwork.width : 1;
        const sample = sampleCloudItem(
          1,
          index,
          entries.length,
          0,
          width <= 700,
          true,
          slot,
          aspect,
        );
        const box = {
          left: slot.x + sample.x - slot.itemWidth / 2,
          top: slot.y + sample.y,
          right: slot.x + sample.x + slot.itemWidth / 2,
          bottom: slot.y + sample.y + slot.itemWidth * aspect,
        };
        expect(box.left).toBeGreaterThanOrEqual(8);
        expect(box.right).toBeLessThanOrEqual(width - 8);
        expect(box.top).toBeGreaterThan(180);
        expect(box.bottom).toBeLessThan(height - 80);
        return box;
      }),
    );
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        expect(
          Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top),
        ).toBe(false);
      }
  });
  it("ships responsive cloud artwork with real transparent margins", async () => {
    for (const id of ["songs", "books", "hobbies"])
      for (const size of [320, 640]) {
        const file = `public/media/site/about-nebula/${id}-${size}.webp`;
        const metadata = await sharp(file).metadata();
        expect(metadata.width).toBe(size);
        expect(metadata.height).toBe(size);
        expect(metadata.hasAlpha).toBe(true);
        const pixels = await sharp(file).ensureAlpha().raw().toBuffer();
        let visible = 0,
          transparent = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] > 128) visible++;
          if (pixels[i] === 0) transparent++;
        }
        expect(visible).toBeGreaterThan(size * size * 0.15);
        expect(transparent).toBeGreaterThan(size * size * 0.15);
      }
  });
});
