import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertPublicationMembership,
  parsePublicationRecords,
  publicCaptureDate,
} from "../../scripts/photography/lib/photography-publication.mjs";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("photography publication policy", () => {
  it("accepts reviewed records and rejects placeholder descriptions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "photo-publication-"));
    temporaryRoots.push(root);
    const filename = path.join(root, "publication.json");
    await writeFile(
      filename,
      JSON.stringify({
        records: [
          {
            id: "photo",
            alt: "A reviewed description of a specific visible scene.",
            location: "city",
            timestamp: "date",
          },
        ],
      }),
    );
    expect(parsePublicationRecords(filename)).toHaveLength(1);
    await writeFile(
      filename,
      JSON.stringify({
        records: [
          {
            id: "photo",
            alt: "Travel photograph from Toronto",
            location: "city",
            timestamp: "date",
          },
        ],
      }),
    );
    expect(() => parsePublicationRecords(filename)).toThrow(/placeholder/);
  });

  it("requires exact membership with the generated manifest", () => {
    expect(() =>
      assertPublicationMembership(
        [{ id: "one" }, { id: "two" }],
        [{ id: "one" }],
      ),
    ).toThrow(/Missing: two/);
  });

  it("publishes date precision or hides the timestamp", () => {
    expect(publicCaptureDate("2026-07-15T12:34:56.000Z", "date")).toBe(
      "2026-07-15",
    );
    expect(publicCaptureDate("2026-07-15T12:34:56.000Z", "hidden")).toBe(
      undefined,
    );
  });
});
