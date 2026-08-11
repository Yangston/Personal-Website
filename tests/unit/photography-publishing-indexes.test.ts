import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  mapConcurrent,
  parseConcurrency,
} from "../../scripts/photography/lib/concurrency.mjs";
import { buildIntegrityIndexFromManifest } from "../../scripts/photography/lib/publishing-indexes.mjs";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("bounded photography work", () => {
  it("honors the configured limit while preserving deterministic ordering", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapConcurrent(
      [4, 3, 2, 1, 0],
      2,
      async (value: number) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, value));
        active -= 1;
        return value * 2;
      },
    );

    expect(peak).toBe(2);
    expect(result).toEqual([8, 6, 4, 2, 0]);
    expect(parseConcurrency(["--concurrency=4"])).toBe(4);
    expect(() => parseConcurrency(["--concurrency=9"])).toThrow(
      /between 1 and 8/,
    );
  });
});

describe("photography integrity index", () => {
  it("records streamed source hashes and output metadata", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "photo-integrity-"));
    temporaryRoots.push(root);
    const sourceRoot = path.join(root, "sources");
    const mediaRoot = path.join(root, "media");
    await Promise.all([
      mkdir(path.join(sourceRoot, "Example", "region"), { recursive: true }),
      mkdir(path.join(mediaRoot, "example"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        path.join(sourceRoot, "Example", "region", "photo.jpg"),
        "source",
      ),
      writeFile(path.join(mediaRoot, "example", "photo-480.webp"), "variant"),
    ]);

    const [entry] = await buildIntegrityIndexFromManifest({
      manifest: [
        {
          id: "photo",
          source: "Example/region/photo.jpg",
          variants: [
            {
              width: 480,
              height: 320,
              src: "/media/photography/example/photo-480.webp",
            },
          ],
        },
      ],
      sourceRoot,
      mediaRoot,
      concurrency: 2,
    });

    expect(entry.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.sourceBytes).toBe(6);
    expect(entry.variants).toEqual([
      expect.objectContaining({
        width: 480,
        height: 320,
        bytes: 7,
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
  });
});
