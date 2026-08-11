import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertPhotographyAggregateState,
  assertUniquePhotographyContent,
  cityForGps,
  classifyInboxPhoto,
  commitPhotographyInbox,
  preparePhotographyInbox,
} from "../../scripts/photography/lib/photography-inbox.mjs";
import {
  exactMetadataFromTags,
  prepareResponsivePhoto,
  readResponsivePhoto,
  sanitizedAuditFromExact,
} from "../../scripts/photography/lib/photography-records.mjs";

const temporaryRoots: string[] = [];
const execFileAsync = promisify(execFile);

async function pathExists(filename: string) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

async function temporaryRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "portfolio-photo-inbox-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

const cities = [
  {
    id: "wide",
    country: "canada",
    archiveCountry: "Canada",
    region: "toronto",
    bounds: { west: -80, south: 43, east: -79, north: 44 },
  },
  {
    id: "narrow",
    country: "canada",
    archiveCountry: "Canada",
    region: "toronto",
    bounds: { west: -79.5, south: 43.5, east: -79.3, north: 43.8 },
  },
];

describe("photography inbox planning", () => {
  it("selects the smallest configured GPS boundary", () => {
    expect(cityForGps(cities, 43.65, -79.4)?.id).toBe("narrow");
    expect(
      classifyInboxPhoto(
        { GPSLatitude: 43.65, GPSLongitude: -79.4 },
        [],
        cities,
      ),
    ).toMatchObject({ city: { id: "narrow" }, method: "exif-gps" });
  });

  it("uses unambiguous capture sequence evidence without inventing GPS", () => {
    const result = classifyInboxPhoto(
      { DateTimeOriginal: "2026-07-13T12:05:00Z" },
      [
        {
          id: "reference",
          country: "canada",
          region: "toronto",
          captureDate: "2026-07-13T12:00:00Z",
        },
      ],
      cities,
    );
    expect(result.method).toBe("capture-sequence");
    expect(result.city.id).toBe("wide");
  });

  it("rejects inconsistent or duplicate aggregate state", () => {
    expect(() =>
      assertPhotographyAggregateState({
        manifest: [{ id: "one" }],
        exact: [{ id: "one" }],
        audit: [],
      }),
    ).toThrow("manifest and audit IDs differ");
    expect(() =>
      assertPhotographyAggregateState({
        manifest: [{ id: "one" }, { id: "one" }],
        exact: [{ id: "one" }],
        audit: [{ id: "one" }],
      }),
    ).toThrow("duplicate photo ID");
  });

  it("rejects content already present in the archive or current inbox", () => {
    expect(() =>
      assertUniquePhotographyContent({
        digest: "deadbeef",
        filename: "DUPLICATE.JPEG",
        existingDigests: new Map([
          [
            "deadbeef",
            { id: "original", source: "Canada/toronto/ORIGINAL.JPEG" },
          ],
        ]),
        batchDigests: new Map(),
      }),
    ).toThrow("duplicates existing photo original");
    expect(() =>
      assertUniquePhotographyContent({
        digest: "feedface",
        filename: "SECOND.JPEG",
        existingDigests: new Map(),
        batchDigests: new Map([["feedface", "FIRST.JPEG"]]),
      }),
    ).toThrow("duplicates inbox photo FIRST.JPEG");
  });

  it("does no aggregate or media work for an empty inbox", async () => {
    const root = await temporaryRoot();
    const plan = await preparePhotographyInbox({ root, cities });
    expect(plan.items).toEqual([]);
    expect(await commitPhotographyInbox(plan)).toEqual([]);
  });

  it("releases buffered metadata sources before an inbox commit", async () => {
    const root = await temporaryRoot();
    const inboxRoot = path.join(
      root,
      "src/content/photography/iCloud Photos/Unprocessed",
    );
    const filename = path.join(inboxRoot, "IMG_BUFFERED.JPEG");
    await mkdir(inboxRoot, { recursive: true });
    await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: "#123456",
      },
    })
      .jpeg()
      .withExif({ IFD2: { DateTimeOriginal: "2026:07:13 12:00:00" } })
      .toFile(filename);

    const photo = await readResponsivePhoto({
      filename,
      sourceRoot: inboxRoot,
      relativeSource: "Canada/toronto/IMG_BUFFERED.JPEG",
      country: "canada",
      region: "toronto",
      bufferMetadataInput: true,
    });
    expect(photo.captureDate).toBe("2026-07-13T12:00:00.000Z");

    const moved = path.join(inboxRoot, "IMG_BUFFERED-MOVED.JPEG");
    await rename(filename, moved);
    expect(await pathExists(moved)).toBe(true);
  });

  it("makes the full freshness check fail while inbox JPEGs are pending", async () => {
    const root = await temporaryRoot();
    const inbox = path.join(
      root,
      "src/content/photography/iCloud Photos/Unprocessed",
    );
    await mkdir(inbox, { recursive: true });
    await writeFile(path.join(inbox, "PENDING.JPEG"), "pending");
    const processor = path.resolve("scripts/photography/archive.mjs");
    await expect(
      execFileAsync(process.execPath, [processor, "--check"], { cwd: root }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Run `npm run photos`"),
    });
  });
});

describe("incremental photography commit", () => {
  it("adds multiple photos without touching existing responsive media", async () => {
    const root = await temporaryRoot();
    const manifestPath = path.join(root, "src/data/photography-manifest.json");
    const metadataPath = path.join(root, ".private/photography-metadata.json");
    const auditPath = path.join(root, "src/data/photography-audit.json");
    const outputRoot = path.join(root, "public/media/photography");
    const inboxRoot = path.join(
      root,
      "src/content/photography/iCloud Photos/Unprocessed",
    );
    await Promise.all([
      mkdir(path.dirname(manifestPath), { recursive: true }),
      mkdir(path.dirname(metadataPath), { recursive: true }),
      mkdir(path.join(outputRoot, "canada"), { recursive: true }),
      mkdir(inboxRoot, { recursive: true }),
    ]);

    const oldVariant = path.join(outputRoot, "canada/old-deadbeef-480.webp");
    await writeFile(oldVariant, "existing-webp-bytes");
    const oldStat = await stat(oldVariant);
    const oldManifest = [
      {
        id: "old",
        source: "Canada/toronto/OLD.JPEG",
        country: "canada",
        region: "toronto",
        captureDate: "2020-01-01T00:00:00.000Z",
        width: 480,
        height: 320,
        alt: "Existing",
        variants: [
          {
            width: 480,
            src: "/media/photography/canada/old-deadbeef-480.webp",
          },
        ],
      },
    ];
    const oldMetadata = [{ id: "old", country: "canada", region: "toronto" }];
    const oldAudit = [{ id: "old", country: "canada", region: "toronto" }];
    const snapshots = [
      [manifestPath, oldManifest],
      [metadataPath, oldMetadata],
      [auditPath, oldAudit],
    ] as const;
    for (const [filename, value] of snapshots)
      await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);

    const inputs = await Promise.all([
      sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: "#234567",
        },
      })
        .jpeg()
        .toBuffer(),
      sharp({
        create: {
          width: 320,
          height: 480,
          channels: 3,
          background: "#765432",
        },
      })
        .jpeg()
        .toBuffer(),
    ]);
    const items = [];
    for (const [index, input] of inputs.entries()) {
      const filename = path.join(inboxRoot, `IMG_NEW_${index + 1}.JPEG`);
      await writeFile(filename, input);
      const relativeSource = `Canada/toronto/IMG_NEW_${index + 1}.JPEG`;
      const prepared = prepareResponsivePhoto(
        {
          filename: path.basename(filename),
          sourcePath: filename,
          relativeSource,
          contentDigest:
            index === 0
              ? "0123456789abcdef0123456789abcdef01234567"
              : "fedcba9876543210fedcba9876543210fedcba98",
          metadata: {
            width: index === 0 ? 800 : 320,
            height: index === 0 ? 600 : 480,
            orientation: 1,
          },
          captureDate: `2026-07-1${index + 1}T12:00:00.000Z`,
          country: "canada",
          region: "toronto",
          exif: {},
        },
        {
          id: `img-new-${index + 1}`,
          alt: `A reviewed test scene for imported photo ${index + 1}.`,
          location: "city",
          timestamp: "date",
        },
      );
      const exact = exactMetadataFromTags({
        source: relativeSource,
        tags: {
          ImageWidth: prepared.manifestRecord.width,
          ImageHeight: prepared.manifestRecord.height,
        },
        published: prepared.manifestRecord,
      });
      items.push({
        filename,
        destination: path.join(
          root,
          "src/content/photography/iCloud Photos",
          relativeSource,
        ),
        id: prepared.manifestRecord.id,
        city: cities[1],
        method: "exif-gps",
        confidence: 1,
        prepared,
        exact,
        audit: sanitizedAuditFromExact(exact),
      });
    }

    const plan = {
      outputRoot,
      manifestPath,
      metadataPath,
      auditPath,
      manifestSnapshot: {
        value: oldManifest,
        text: `${JSON.stringify(oldManifest, null, 2)}\n`,
      },
      metadataSnapshot: {
        value: oldMetadata,
        text: `${JSON.stringify(oldMetadata, null, 2)}\n`,
      },
      auditSnapshot: {
        value: oldAudit,
        text: `${JSON.stringify(oldAudit, null, 2)}\n`,
      },
      items,
    };

    const committed = await commitPhotographyInbox(plan);
    expect(committed.map((item: { id: string }) => item.id)).toEqual([
      "img-new-1",
      "img-new-2",
    ]);
    expect(await readFile(oldVariant, "utf8")).toBe("existing-webp-bytes");
    expect((await stat(oldVariant)).mtimeMs).toBe(oldStat.mtimeMs);
    expect(
      JSON.parse(await readFile(manifestPath, "utf8")).map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual(["old", "img-new-1", "img-new-2"]);
    expect(
      JSON.parse(await readFile(metadataPath, "utf8")).map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual(["img-new-1", "img-new-2", "old"]);
    expect(
      JSON.parse(await readFile(auditPath, "utf8")).every(
        (item: Record<string, unknown>) => !("gps" in item),
      ),
    ).toBe(true);
    expect(
      await readFile(
        path.join(
          root,
          "src/content/photography/iCloud Photos/Canada/toronto/IMG_NEW_1.JPEG",
        ),
      ),
    ).toEqual(inputs[0]);
    const generated = items.flatMap((item) =>
      item.prepared.manifestRecord.variants.map((variant) =>
        path.join(outputRoot, "canada", path.basename(variant.src)),
      ),
    );
    for (const filename of generated)
      expect((await stat(filename)).size).toBeGreaterThan(0);
  });

  it("rolls back sources, media, and exact aggregate files on commit failure", async () => {
    const root = await temporaryRoot();
    const manifestPath = path.join(root, "src/data/photography-manifest.json");
    const metadataPath = path.join(root, ".private/photography-metadata.json");
    const auditPath = path.join(root, "src/data/photography-audit.json");
    const outputRoot = path.join(root, "public/media/photography");
    const inboxRoot = path.join(
      root,
      "src/content/photography/iCloud Photos/Unprocessed",
    );
    await Promise.all([
      mkdir(path.dirname(manifestPath), { recursive: true }),
      mkdir(path.dirname(metadataPath), { recursive: true }),
      mkdir(inboxRoot, { recursive: true }),
    ]);
    const snapshots = [
      [manifestPath, "[]\n"],
      [metadataPath, "[]\n"],
      [auditPath, "[]\n"],
    ] as const;
    for (const [filename, text] of snapshots) await writeFile(filename, text);

    const input = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: "#345678",
      },
    })
      .jpeg()
      .toBuffer();
    const filename = path.join(inboxRoot, "IMG_ROLLBACK.JPEG");
    await writeFile(filename, input);
    const relativeSource = "Canada/toronto/IMG_ROLLBACK.JPEG";
    const prepared = prepareResponsivePhoto(
      {
        filename: path.basename(filename),
        sourcePath: filename,
        relativeSource,
        input,
        metadata: { width: 640, height: 480, orientation: 1 },
        captureDate: "2026-07-13T12:00:00.000Z",
        country: "canada",
        region: "toronto",
        exif: {},
      },
      {
        id: "img-rollback",
        alt: "A reviewed test scene for a rollback photograph.",
        location: "city",
        timestamp: "date",
      },
    );
    const exact = exactMetadataFromTags({
      source: relativeSource,
      tags: { ImageWidth: 640, ImageHeight: 480 },
      published: prepared.manifestRecord,
    });
    const destination = path.join(
      root,
      "src/content/photography/iCloud Photos",
      relativeSource,
    );
    const plan = {
      outputRoot,
      manifestPath,
      metadataPath,
      auditPath,
      manifestSnapshot: { value: [], text: "[]\n" },
      metadataSnapshot: { value: [], text: "[]\n" },
      auditSnapshot: { value: [], text: "[]\n" },
      items: [
        {
          filename,
          destination,
          id: prepared.manifestRecord.id,
          city: cities[1],
          method: "exif-gps",
          confidence: 1,
          prepared,
          exact,
          audit: sanitizedAuditFromExact(exact),
        },
      ],
    };

    await expect(
      commitPhotographyInbox(plan, {
        beforeCommitStep(step: string) {
          if (step === "json:photography-metadata.json")
            throw new Error("injected commit failure");
        },
      }),
    ).rejects.toThrow("injected commit failure");

    for (const [aggregate, text] of snapshots)
      expect(await readFile(aggregate, "utf8")).toBe(text);
    expect(await readFile(filename)).toEqual(input);
    expect(await pathExists(destination)).toBe(false);
    for (const variant of prepared.manifestRecord.variants)
      expect(
        await pathExists(
          path.join(outputRoot, "canada", path.basename(variant.src)),
        ),
      ).toBe(false);
  });
});
