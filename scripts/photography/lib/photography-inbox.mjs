import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { exiftool } from "exiftool-vendored";
import {
  exactMetadataFromTags,
  isPhotographyJpeg,
  normalizePhotoId,
  numberFromExif,
  prepareResponsivePhoto,
  readResponsivePhoto,
  sanitizedAuditFromExact,
  sortAuditRecords,
  sortManifestRecords,
  walkPhotographyFiles,
  writeResponsivePhoto,
} from "./photography-records.mjs";
import {
  parsePublicationRecords,
  publicationRecordMap,
} from "./photography-publication.mjs";
import { createProgressReporter } from "./terminal-progress.mjs";
import {
  defaultPhotographyConcurrency,
  mapConcurrent,
} from "./concurrency.mjs";

function idsFor(records) {
  return records.map((record) => record.id).sort();
}

function assertUniqueIds(records, label) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.id))
      throw new Error(`${label} contains duplicate photo ID: ${record.id}`);
    seen.add(record.id);
  }
}

export function manifestContentDigest(record) {
  const filename = path.basename(record.variants?.[0]?.src ?? "");
  return filename.match(/-([a-f0-9]{8})-\d+\.webp$/i)?.[1]?.toLowerCase();
}

export function assertUniquePhotographyContent({
  digest,
  filename,
  existingDigests,
  batchDigests,
}) {
  const existingDuplicate = existingDigests.get(digest);
  if (existingDuplicate)
    throw new Error(
      `${filename} duplicates existing photo ${existingDuplicate.id} (${existingDuplicate.source}); refusing to publish duplicate content.`,
    );
  const batchDuplicate = batchDigests.get(digest);
  if (batchDuplicate)
    throw new Error(
      `${filename} duplicates inbox photo ${batchDuplicate}; refusing to publish duplicate content.`,
    );
}

export function assertPhotographyAggregateState({ manifest, exact, audit }) {
  assertUniqueIds(manifest, "Photography manifest");
  assertUniqueIds(exact, "Private photography metadata");
  assertUniqueIds(audit, "Sanitized photography audit");
  const manifestIds = JSON.stringify(idsFor(manifest));
  if (
    manifestIds !== JSON.stringify(idsFor(exact)) ||
    manifestIds !== JSON.stringify(idsFor(audit))
  )
    throw new Error(
      "Photography manifest and audit IDs differ. Run `npm run photos:rebuild` before importing new photos.",
    );
}

export function cityForGps(cities, latitude, longitude) {
  const matches = cities.filter(
    ({ bounds }) =>
      longitude >= bounds.west &&
      longitude <= bounds.east &&
      latitude >= bounds.south &&
      latitude <= bounds.north,
  );
  return matches.sort(
    (left, right) =>
      (left.bounds.east - left.bounds.west) *
        (left.bounds.north - left.bounds.south) -
      (right.bounds.east - right.bounds.west) *
        (right.bounds.north - right.bounds.south),
  )[0];
}

function cityFromArchiveRecord(cities, record) {
  return cities.find(
    (city) => record.country === city.country && record.region === city.region,
  );
}

export function classifyInboxPhoto(tags, historical, cities) {
  const latitude = numberFromExif(tags.GPSLatitude);
  const longitude = numberFromExif(tags.GPSLongitude);
  if (latitude !== undefined && longitude !== undefined) {
    const city = cityForGps(cities, latitude, longitude);
    if (!city)
      throw new Error(
        "Photo GPS is outside every configured city boundary; refusing to publish it.",
      );
    return { city, method: "exif-gps", confidence: 1 };
  }

  const date = new Date(
    tags.DateTimeOriginal ?? tags.CreateDate ?? tags.ModifyDate,
  ).getTime();
  const ranked = historical
    .map((record) => ({
      record,
      city: cityFromArchiveRecord(cities, record),
      delta: Math.abs(new Date(record.captureDate).getTime() - date),
    }))
    .filter((item) => item.city && Number.isFinite(item.delta))
    .sort((left, right) => left.delta - right.delta);
  if (!ranked[0] || ranked[0].delta > 36 * 60 * 60 * 1000)
    throw new Error(
      "No GPS and no unambiguous archive capture within 36 hours.",
    );
  const competing = ranked.find((item) => item.city.id !== ranked[0].city.id);
  if (competing && competing.delta < ranked[0].delta * 1.5 + 30 * 60 * 1000)
    throw new Error(
      "Temporal city inference is ambiguous; refusing to misclassify the photograph.",
    );
  return {
    city: ranked[0].city,
    method: "capture-sequence",
    confidence: Math.max(0.7, 1 - ranked[0].delta / (36 * 60 * 60 * 1000)),
  };
}

async function readRequiredJson(filename, recoveryCommand) {
  let text;
  try {
    text = await readFile(filename, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT")
      throw new Error(
        `${path.relative(process.cwd(), filename)} is missing. Run \`${recoveryCommand}\` before importing new photos.`,
      );
    throw error;
  }
  return { text, value: JSON.parse(text) };
}

async function pathExists(filename) {
  try {
    await access(filename);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function preparePhotographyInbox({
  root,
  cities,
  concurrency = defaultPhotographyConcurrency,
}) {
  const archiveRoot = path.join(root, "src/content/photography/iCloud Photos");
  const incomingRoot = path.join(archiveRoot, "Unprocessed");
  const outputRoot = path.join(root, "public/media/photography");
  const manifestPath = path.join(root, "src/data/photography-manifest.json");
  const metadataPath = path.join(root, ".private/photography-metadata.json");
  const auditPath = path.join(root, "src/data/photography-audit.json");
  await mkdir(incomingRoot, { recursive: true });
  const incoming = (await walkPhotographyFiles(incomingRoot)).filter(
    isPhotographyJpeg,
  );
  if (!incoming.length)
    return {
      incomingRoot,
      outputRoot,
      manifestPath,
      metadataPath,
      auditPath,
      items: [],
    };
  const publicationById = publicationRecordMap(
    parsePublicationRecords(
      path.join(root, "src/config/photography-publication.json"),
    ),
  );

  const [manifestSnapshot, metadataSnapshot, auditSnapshot] = await Promise.all(
    [
      readRequiredJson(manifestPath, "npm run photos:rebuild"),
      readRequiredJson(metadataPath, "npm run photos:rebuild"),
      readRequiredJson(auditPath, "npm run photos:rebuild"),
    ],
  );
  assertPhotographyAggregateState({
    manifest: manifestSnapshot.value,
    exact: metadataSnapshot.value,
    audit: auditSnapshot.value,
  });
  const existingIds = new Set(manifestSnapshot.value.map((item) => item.id));
  const existingDigests = new Map(
    manifestSnapshot.value.flatMap((item) => {
      const digest = manifestContentDigest(item);
      return digest ? [[digest, item]] : [];
    }),
  );
  const batchIds = new Set();
  const batchDigests = new Map();
  const progress = createProgressReporter({
    total: incoming.length,
    label: "Preflighting inbox photo",
  });

  let candidates;
  try {
    candidates = await mapConcurrent(
      incoming,
      concurrency,
      async (filename, index) => {
        progress.update(index + 1, path.basename(filename));
        const tags = await exiftool.read(filename);
        const assignment = classifyInboxPhoto(
          tags,
          metadataSnapshot.value,
          cities,
        );
        const id = normalizePhotoId(filename);
        const relativeSource = [
          assignment.city.archiveCountry,
          assignment.city.region,
          path.basename(filename),
        ].join("/");
        const destination = path.join(
          archiveRoot,
          ...relativeSource.split("/"),
        );
        const photo = await readResponsivePhoto({
          filename,
          sourceRoot: incomingRoot,
          relativeSource,
          country: assignment.city.country,
          region: assignment.city.region,
          bufferMetadataInput: true,
        });
        const prepared = prepareResponsivePhoto(photo, publicationById.get(id));
        const exact = exactMetadataFromTags({
          source: relativeSource,
          tags,
          published: prepared.manifestRecord,
        });
        return {
          filename,
          destination,
          id,
          relativeSource,
          ...assignment,
          prepared,
          exact,
          audit: sanitizedAuditFromExact(exact),
        };
      },
    );
  } finally {
    progress.finish();
    await exiftool.end();
  }

  const items = [];
  for (const candidate of candidates) {
    const { filename, destination, id, relativeSource, prepared } = candidate;
    if (existingIds.has(id))
      throw new Error(
        `${path.basename(filename)} conflicts with existing photo ID ${id}. Replacements require the full rebuild workflow.`,
      );
    if (batchIds.has(id))
      throw new Error(`Inbox contains duplicate photo ID: ${id}`);
    batchIds.add(id);
    if (await pathExists(destination))
      throw new Error(`Destination already exists: ${relativeSource}`);
    assertUniquePhotographyContent({
      digest: prepared.contentDigest,
      filename: path.basename(filename),
      existingDigests,
      batchDigests,
    });
    batchDigests.set(prepared.contentDigest, path.basename(filename));
    for (const variant of prepared.manifestRecord.variants) {
      const publicPath = path.join(
        outputRoot,
        candidate.city.country,
        path.basename(variant.src),
      );
      if (await pathExists(publicPath))
        throw new Error(
          `Generated destination already exists: ${path.relative(root, publicPath)}`,
        );
    }
    items.push(candidate);
  }

  return {
    archiveRoot,
    incomingRoot,
    outputRoot,
    manifestPath,
    metadataPath,
    auditPath,
    manifestSnapshot,
    metadataSnapshot,
    auditSnapshot,
    concurrency,
    items,
  };
}

async function rollbackCommittedInbox({
  movedSources,
  movedOutputs,
  jsonReplacements,
}) {
  for (const replacement of jsonReplacements.reverse()) {
    await rm(replacement.target, { force: true }).catch(() => {});
    if (replacement.hadTarget)
      await rename(replacement.backup, replacement.target).catch(() => {});
  }
  for (const output of movedOutputs.reverse())
    await rm(output, { force: true }).catch(() => {});
  for (const item of movedSources.reverse()) {
    await mkdir(path.dirname(item.filename), { recursive: true });
    await rename(item.destination, item.filename).catch(() => {});
  }
}

export async function commitPhotographyInbox(plan, options = {}) {
  if (!plan.items.length) return [];
  const root = path.dirname(path.dirname(path.dirname(plan.manifestPath)));
  const stagingRoot = path.join(
    root,
    ".private/photo-inbox-staging",
    randomUUID(),
  );
  const stagingMediaRoot = path.join(stagingRoot, "media");
  const stagingJsonRoot = path.join(stagingRoot, "json");
  const backupJsonRoot = path.join(stagingRoot, "backup");
  const movedSources = [];
  const movedOutputs = [];
  const jsonReplacements = [];

  try {
    console.log("Generating responsive media for new inbox photos...");
    await mapConcurrent(
      plan.items,
      options.concurrency ?? plan.concurrency ?? defaultPhotographyConcurrency,
      async (item) => {
        // Sharp can retain a filename-backed input handle long enough for the
        // following source rename to fail with EBUSY on Windows. Buffer only
        // the currently active inbox workers; full archive rebuilds continue
        // to stream their canonical sources from disk.
        const input = await readFile(item.filename);
        await writeResponsivePhoto(
          {
            ...item.prepared,
            photo: { ...item.prepared.photo, input },
          },
          stagingMediaRoot,
        );
      },
    );

    const manifest = sortManifestRecords([
      ...plan.manifestSnapshot.value,
      ...plan.items.map((item) => item.prepared.manifestRecord),
    ]);
    const metadata = sortAuditRecords([
      ...plan.metadataSnapshot.value,
      ...plan.items.map((item) => item.exact),
    ]);
    const audit = sortAuditRecords([
      ...plan.auditSnapshot.value,
      ...plan.items.map((item) => item.audit),
    ]);
    const stagedJson = [
      [
        plan.manifestPath,
        path.join(stagingJsonRoot, "manifest.json"),
        manifest,
      ],
      [
        plan.metadataPath,
        path.join(stagingJsonRoot, "metadata.json"),
        metadata,
      ],
      [plan.auditPath, path.join(stagingJsonRoot, "audit.json"), audit],
    ];
    await mkdir(stagingJsonRoot, { recursive: true });
    await Promise.all(
      stagedJson.map(([, filename, value]) =>
        writeFile(filename, `${JSON.stringify(value, null, 2)}\n`),
      ),
    );

    console.log("Committing inbox photos and generated records...");
    for (const item of plan.items) {
      await options.beforeCommitStep?.(`source:${item.id}`);
      await mkdir(path.dirname(item.destination), { recursive: true });
      await rename(item.filename, item.destination);
      movedSources.push(item);
    }
    for (const item of plan.items) {
      for (const variant of item.prepared.manifestRecord.variants) {
        const staged = path.join(
          stagingMediaRoot,
          item.city.country,
          path.basename(variant.src),
        );
        const output = path.join(
          plan.outputRoot,
          item.city.country,
          path.basename(variant.src),
        );
        await options.beforeCommitStep?.(`media:${item.id}:${variant.width}`);
        await mkdir(path.dirname(output), { recursive: true });
        await rename(staged, output);
        movedOutputs.push(output);
      }
    }
    for (const [target, staged] of stagedJson) {
      const backup = path.join(backupJsonRoot, path.basename(target));
      const hadTarget = await pathExists(target);
      await mkdir(path.dirname(backup), { recursive: true });
      if (hadTarget) await rename(target, backup);
      try {
        await options.beforeCommitStep?.(`json:${path.basename(target)}`);
        await rename(staged, target);
      } catch (error) {
        if (hadTarget) await rename(backup, target).catch(() => {});
        throw error;
      }
      jsonReplacements.push({ target, backup, hadTarget });
    }
  } catch (error) {
    await rollbackCommittedInbox({
      movedSources,
      movedOutputs,
      jsonReplacements,
    });
    throw error;
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }

  return plan.items.map(
    ({ filename, destination, id, city, method, confidence }) => ({
      filename,
      destination,
      id,
      city,
      method,
      confidence,
    }),
  );
}
