import { readFileSync } from "node:fs";

const allowedTimestamps = new Set(["date", "hidden"]);

export function parsePublicationRecords(filename) {
  const document = JSON.parse(readFileSync(filename, "utf8"));
  if (!Array.isArray(document.records))
    throw new Error(
      "Photography publication config must contain a records array.",
    );

  const records = document.records.map((record, index) => {
    const label = `Publication record ${index + 1}`;
    if (!record || typeof record !== "object")
      throw new Error(`${label} must be an object.`);
    if (typeof record.id !== "string" || !record.id)
      throw new Error(`${label} requires an id.`);
    if (typeof record.alt !== "string" || record.alt.trim().length < 20)
      throw new Error(
        `${record.id} requires a reviewed, scene-specific alt description.`,
      );
    if (/^travel photograph from\b/i.test(record.alt))
      throw new Error(
        `${record.id} still uses the location-only placeholder alt text.`,
      );
    if (!allowedTimestamps.has(record.timestamp))
      throw new Error(
        `${record.id} has an invalid timestamp publication policy.`,
      );
    return {
      id: record.id,
      alt: record.alt.trim(),
      timestamp: record.timestamp,
    };
  });

  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id))
      throw new Error(
        `Duplicate photography publication record: ${record.id}.`,
      );
    ids.add(record.id);
  }
  return records;
}

export function publicationRecordMap(records) {
  return new Map(records.map((record) => [record.id, record]));
}

export function assertPublicationMembership(manifest, records) {
  const manifestIds = new Set(manifest.map((record) => record.id));
  const publicationIds = new Set(records.map((record) => record.id));
  const missing = [...manifestIds].filter((id) => !publicationIds.has(id));
  const extra = [...publicationIds].filter((id) => !manifestIds.has(id));
  if (missing.length || extra.length)
    throw new Error(
      `Photography publication records must exactly match the manifest. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`,
    );
}

export function publicCaptureDate(captureDate, policy) {
  if (policy === "hidden") return undefined;
  if (
    typeof captureDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}/.test(captureDate)
  )
    throw new Error(
      "A date-approved photo requires an exact private capture timestamp.",
    );
  return captureDate.slice(0, 10);
}
