import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { exiftool } from "exiftool-vendored";
import sharp from "sharp";
import {
  exactMetadataFromTags,
  isPhotographyJpeg,
  prepareResponsivePhoto,
  readResponsivePhoto,
  sanitizedAuditFromExact,
  sortAuditRecords,
  sortManifestRecords,
  walkPhotographyFiles,
  writeResponsivePhoto,
} from "./lib/photography-records.mjs";
import { replaceArchiveTargets } from "./lib/archive-transaction.mjs";
import {
  createPhaseTimings,
  mapConcurrent,
  parseConcurrency,
} from "./lib/concurrency.mjs";
import { buildIntegrityIndex, hashFile } from "./lib/publishing-indexes.mjs";
import {
  assertPublicationMembership,
  parsePublicationRecords,
  publicationRecordMap,
} from "./lib/photography-publication.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const checking = args.includes("--check");
const checkingGenerated = args.includes("--check-generated");
const deep = args.includes("--deep");
const concurrencyArgument = args.find((value) =>
  value.startsWith("--concurrency="),
);
const supported = new Set([
  "--check",
  "--check-generated",
  "--deep",
  concurrencyArgument,
]);
const unknown = args.filter((value) => !supported.has(value));
if (unknown.length)
  throw new Error(`Unsupported photography option: ${unknown.join(", ")}`);
const concurrency = parseConcurrency(args);
const timings = createPhaseTimings();
const sourceRoot = path.join(root, "src/content/photography/iCloud Photos");
const inboxRoot = path.join(sourceRoot, "Unprocessed");
const outputRoot = path.join(root, "public/media/photography");
const manifestPath = path.join(root, "src/data/photography-manifest.json");
const auditPath = path.join(root, "src/data/photography-audit.json");
const integrityPath = path.join(root, "src/data/photography-integrity.json");
const metadataPath = path.join(root, ".private/photography-metadata.json");
if (checking) {
  const pendingInbox = (await walkPhotographyFiles(inboxRoot)).filter(
    isPhotographyJpeg,
  );
  if (pendingInbox.length)
    throw new Error(
      `Run \`npm run photos\` before checking the archive; ${pendingInbox.length} inbox JPEG(s) are pending.`,
    );
}
const publicationRecords = parsePublicationRecords(
  path.join(root, "src/config/photography-publication.json"),
);
const publicationById = publicationRecordMap(publicationRecords);

async function json(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

async function walkFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(filename)));
    else files.push(filename);
  }
  return files;
}

function assertSameIds(label, left, right) {
  const a = left.map(({ id }) => id).sort();
  const b = right.map(({ id }) => id).sort();
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${label} membership does not match the manifest.`);
  if (new Set(a).size !== a.length)
    throw new Error(`${label} contains duplicate IDs.`);
}

async function checkGenerated() {
  const [manifest, audit, integrity] = await Promise.all([
    json(manifestPath),
    json(auditPath),
    json(integrityPath),
  ]);
  assertPublicationMembership(manifest, publicationRecords);
  assertSameIds("Audit", manifest, audit);
  assertSameIds("Integrity", manifest, integrity);
  const expected = new Set();
  const manifestById = new Map(manifest.map((item) => [item.id, item]));
  for (const record of integrity) {
    const item = manifestById.get(record.id);
    if (
      !item ||
      JSON.stringify(item.variants) !==
        JSON.stringify(
          record.variants.map(({ width, src }) => ({ width, src })),
        )
    )
      throw new Error(`Integrity variants are stale for ${record.id}.`);
    for (const variant of record.variants) {
      const filename = path.join(
        root,
        "public",
        ...variant.src.split("/").filter(Boolean),
      );
      const info = await stat(filename);
      if (
        info.size !== variant.bytes ||
        (await hashFile(filename)) !== variant.digest
      )
        throw new Error(`Responsive media is stale: ${variant.src}`);
      if (deep) {
        const metadata = await sharp(filename).metadata();
        if (metadata.format !== "webp" || metadata.width !== variant.width)
          throw new Error(
            `Responsive media has invalid dimensions: ${variant.src}`,
          );
      }
      expected.add(path.resolve(filename));
    }
  }
  const actual = (await walkFiles(outputRoot)).map((filename) =>
    path.resolve(filename),
  );
  const orphaned = actual.filter((filename) => !expected.has(filename));
  if (actual.length !== expected.size || orphaned.length)
    throw new Error(
      `Photography media contains ${orphaned.length} orphaned files.`,
    );
  console.log(
    `Generated photography is current (${manifest.length} images, ${actual.length} responsive files).`,
  );
  return { manifest, integrity };
}

async function checkSources(manifest, integrity) {
  const sources = (
    await walkPhotographyFiles(sourceRoot, {
      excludedDirectoryNames: ["Unprocessed"],
    })
  ).filter(isPhotographyJpeg);
  const byRelative = new Map(
    sources.map((filename) => [
      path.relative(sourceRoot, filename).replaceAll("\\", "/"),
      filename,
    ]),
  );
  if (byRelative.size !== manifest.length)
    throw new Error(
      `Archive membership differs from the ${manifest.length}-photo manifest.`,
    );
  const integrityById = new Map(integrity.map((item) => [item.id, item]));
  await mapConcurrent(manifest, concurrency, async (item) => {
    const filename = byRelative.get(item.source);
    const expected = integrityById.get(item.id);
    if (!filename || !expected)
      throw new Error(`Archive source is missing: ${item.source}`);
    const info = await stat(filename);
    if (
      info.size !== expected.sourceBytes ||
      (await hashFile(filename)) !== expected.sourceDigest
    )
      throw new Error(`Archive source digest is stale: ${item.source}`);
    if (deep) await exiftool.read(filename);
  });
  if (deep) await exiftool.end();
  console.log(
    `Photography archive is current (${sources.length} source JPEGs).`,
  );
}

async function rebuild() {
  const inbox = (await walkPhotographyFiles(inboxRoot)).filter(
    isPhotographyJpeg,
  );
  if (inbox.length)
    throw new Error(
      "Move or publish every Unprocessed JPEG before a full rebuild.",
    );
  const sources = (
    await walkPhotographyFiles(sourceRoot, {
      excludedDirectoryNames: ["Unprocessed"],
    })
  ).filter(isPhotographyJpeg);
  const stagingRoot = path.join(
    root,
    ".private/photo-gallery-rebuild",
    randomUUID(),
  );
  const stagedMedia = path.join(stagingRoot, "media");
  const stagedJson = path.join(stagingRoot, "json");
  const backupRoot = path.join(stagingRoot, "backup");
  try {
    const prepared = await timings.measure("metadata", () =>
      mapConcurrent(sources, concurrency, async (filename) => {
        const photo = await readResponsivePhoto({ filename, sourceRoot });
        const id = path.parse(filename).name.toLowerCase().replaceAll("_", "-");
        const published = prepareResponsivePhoto(
          photo,
          publicationById.get(id),
        );
        const tags = await exiftool.read(filename);
        const exact = exactMetadataFromTags({
          source: photo.relativeSource,
          tags,
          published: published.manifestRecord,
        });
        return { ...published, exact, audit: sanitizedAuditFromExact(exact) };
      }),
    );
    await exiftool.end();
    const ids = prepared.map((item) => item.manifestRecord.id);
    if (new Set(ids).size !== ids.length)
      throw new Error("Archive contains duplicate photo IDs.");
    const digests = prepared.map((item) => item.photo.sourceDigest);
    if (new Set(digests).size !== digests.length)
      throw new Error("Archive contains duplicate source content.");
    const manifest = sortManifestRecords(
      prepared.map((item) => item.manifestRecord),
    );
    assertPublicationMembership(manifest, publicationRecords);
    await timings.measure("responsive media", () =>
      mapConcurrent(prepared, concurrency, (item) =>
        writeResponsivePhoto(item, stagedMedia),
      ),
    );
    const integrity = await timings.measure("integrity", () =>
      buildIntegrityIndex({
        photos: prepared,
        mediaRoot: stagedMedia,
        concurrency,
      }),
    );
    const records = [
      ["photography-manifest.json", manifest],
      [
        "photography-audit.json",
        sortAuditRecords(prepared.map((item) => item.audit)),
      ],
      ["photography-integrity.json", integrity],
      [
        "photography-metadata.json",
        sortAuditRecords(prepared.map((item) => item.exact)),
      ],
    ];
    await mkdir(stagedJson, { recursive: true });
    await Promise.all(
      records.map(([name, value]) =>
        writeFile(
          path.join(stagedJson, name),
          `${JSON.stringify(value, null, 2)}\n`,
        ),
      ),
    );
    await replaceArchiveTargets([
      {
        target: outputRoot,
        source: stagedMedia,
        backup: path.join(backupRoot, "media"),
      },
      {
        target: manifestPath,
        source: path.join(stagedJson, "photography-manifest.json"),
        backup: path.join(backupRoot, "manifest.json"),
      },
      {
        target: auditPath,
        source: path.join(stagedJson, "photography-audit.json"),
        backup: path.join(backupRoot, "audit.json"),
      },
      {
        target: integrityPath,
        source: path.join(stagedJson, "photography-integrity.json"),
        backup: path.join(backupRoot, "integrity.json"),
      },
      {
        target: metadataPath,
        source: path.join(stagedJson, "photography-metadata.json"),
        backup: path.join(backupRoot, "metadata.json"),
      },
    ]);
    console.log(`Rebuilt ${manifest.length} gallery photographs atomically.`);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
  timings.print();
}

if (checking || checkingGenerated) {
  const state = await checkGenerated();
  if (checking) await checkSources(state.manifest, state.integrity);
} else await rebuild();
