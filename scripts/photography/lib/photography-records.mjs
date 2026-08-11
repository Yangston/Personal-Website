import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import exifReader from "exif-reader";
import sharp from "sharp";
import { photographyRegionByArchivePath } from "./photography-config.mjs";
import { hashFileDigests } from "./publishing-indexes.mjs";
import { publicCaptureDate } from "./photography-publication.mjs";

export const photographyWidths = [480, 960, 1600];

export function isPhotographyJpeg(filename) {
  return /\.(jpe?g)$/i.test(filename);
}

export function normalizePhotoId(filename) {
  return path.parse(filename).name.toLowerCase().replaceAll("_", "-");
}

export function numberFromExif(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export async function walkPhotographyFiles(
  directory,
  { excludedDirectoryNames = [] } = {},
) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const excluded = new Set(excludedDirectoryNames);
  return (
    await Promise.all(
      entries.map((entry) => {
        if (entry.isDirectory() && excluded.has(entry.name)) return [];
        return entry.isDirectory()
          ? walkPhotographyFiles(path.join(directory, entry.name), {
              excludedDirectoryNames,
            })
          : [path.join(directory, entry.name)];
      }),
    )
  ).flat();
}

export async function readResponsivePhoto({
  filename,
  sourceRoot,
  relativeSource,
  country,
  region,
  bufferMetadataInput = false,
}) {
  const resolvedRelativeSource = (
    relativeSource ?? path.relative(sourceRoot, filename)
  ).replaceAll("\\", "/");
  const [countryFolder, inferredRegion] = resolvedRelativeSource.split("/");
  const configuredRegion = photographyRegionByArchivePath.get(
    `${countryFolder}/${inferredRegion}`,
  );
  const resolvedCountry = country ?? configuredRegion?.country;
  const resolvedRegion = region ?? configuredRegion?.id;
  if (!resolvedCountry || !resolvedRegion || !configuredRegion)
    throw new Error(
      `Photo must be sorted into country/region folders: ${resolvedRelativeSource}`,
    );

  const metadataPromise = bufferMetadataInput
    ? readFile(filename).then((input) => sharp(input).metadata())
    : sharp(filename).metadata();
  const [metadata, sourceStat, digests] = await Promise.all([
    metadataPromise,
    stat(filename),
    hashFileDigests(filename),
  ]);
  let exif = {};
  try {
    if (metadata.exif) exif = exifReader(metadata.exif);
  } catch {
    // Compact EXIF is optional; required fields are checked below.
  }
  const rawDate = exif?.Photo?.DateTimeOriginal ?? exif?.Image?.ModifyDate;
  const captureDate = rawDate instanceof Date ? rawDate.toISOString() : null;
  if (!captureDate || !metadata.width || !metadata.height)
    throw new Error(`Missing required metadata: ${path.basename(filename)}`);

  return {
    filename: path.basename(filename),
    sourcePath: filename,
    relativeSource: resolvedRelativeSource,
    ...digests,
    sourceBytes: sourceStat.size,
    metadata,
    captureDate,
    country: resolvedCountry,
    region: resolvedRegion,
    exif,
  };
}

export function prepareResponsivePhoto(photo, publication) {
  const id = normalizePhotoId(photo.filename);
  if (!publication)
    throw new Error(
      `Photo ${id} needs a reviewed entry in src/config/photography-publication.json before it can be published.`,
    );
  const digest = (
    photo.contentDigest ?? createHash("sha1").update(photo.input).digest("hex")
  ).slice(0, 8);
  const orientation = photo.metadata.orientation ?? 1;
  const swapsDimensions = orientation >= 5 && orientation <= 8;
  const displayWidth = swapsDimensions
    ? photo.metadata.height
    : photo.metadata.width;
  const displayHeight = swapsDimensions
    ? photo.metadata.width
    : photo.metadata.height;
  const variantWidths = photographyWidths
    .filter((value) => value < displayWidth)
    .concat(Math.min(displayWidth, 1600))
    .filter(
      (value, widthIndex, allWidths) => allWidths.indexOf(value) === widthIndex,
    );
  const variants = variantWidths.map((width) => ({
    width,
    src: `/media/photography/${photo.country}/${id}-${digest}-${width}.webp`,
  }));
  return {
    photo,
    contentDigest: digest,
    variantWidths,
    manifestRecord: {
      id,
      source: photo.relativeSource,
      country: photo.country,
      region: photo.region,
      ...(publication.timestamp === "date"
        ? {
            captureDate: publicCaptureDate(
              photo.captureDate,
              publication.timestamp,
            ),
          }
        : {}),
      width: displayWidth,
      height: displayHeight,
      alt: publication.alt,
      variants,
    },
  };
}

export async function writeResponsivePhoto(prepared, outputRoot) {
  const outputDirectory = path.join(outputRoot, prepared.photo.country);
  await mkdir(outputDirectory, { recursive: true });
  const input = prepared.photo.input ?? prepared.photo.sourcePath;
  const pipeline = sharp(input).rotate();
  await Promise.all(
    prepared.manifestRecord.variants.map((variant) =>
      pipeline
        .clone()
        .resize({ width: variant.width, withoutEnlargement: true })
        .webp({ quality: variant.width >= 1600 ? 76 : 78, effort: 4 })
        .toFile(
          path.join(
            outputRoot,
            variant.src.split("/").at(-2),
            path.basename(variant.src),
          ),
        ),
    ),
  );
}

export function exactMetadataFromTags({ source, tags, published }) {
  const latitude = numberFromExif(tags.GPSLatitude);
  const longitude = numberFromExif(tags.GPSLongitude);
  const altitudeM = numberFromExif(tags.GPSAltitude);
  const horizontalAccuracyM = numberFromExif(tags.GPSHPositioningError);
  const width =
    numberFromExif(tags.ImageWidth ?? tags.ExifImageWidth) ?? published?.width;
  const height =
    numberFromExif(tags.ImageHeight ?? tags.ExifImageHeight) ??
    published?.height;
  const rawCaptureDate =
    tags.DateTimeOriginal ?? tags.CreateDate ?? tags.ModifyDate;
  const captureDateValue =
    rawCaptureDate instanceof Date
      ? rawCaptureDate
      : typeof rawCaptureDate?.toDate === "function"
        ? rawCaptureDate.toDate()
        : typeof rawCaptureDate === "string"
          ? new Date(rawCaptureDate)
          : undefined;
  const captureDate =
    captureDateValue instanceof Date &&
    Number.isFinite(captureDateValue.getTime())
      ? captureDateValue.toISOString()
      : published?.captureDate;

  return {
    id: normalizePhotoId(source),
    source,
    country: published?.country,
    region: published?.region,
    captureDate,
    make: tags.Make,
    model: tags.Model,
    orientation: tags.Orientation,
    width,
    height,
    gps:
      latitude !== undefined && longitude !== undefined
        ? {
            latitude,
            longitude,
            altitudeM: altitudeM ?? 0,
            altitudeReference: tags.GPSAltitudeRef,
            horizontalAccuracyM,
          }
        : undefined,
  };
}

export function sanitizedAuditFromExact(item) {
  return {
    id: item.id,
    country: item.country,
    region: item.region,
    hasGps: Boolean(item.gps),
    hasAltitude: item.gps ? item.gps.altitudeM !== 0 : false,
    hasDimensions: Boolean(item.width && item.height),
  };
}

export function sortManifestRecords(records) {
  return records.sort(
    (left, right) =>
      (left.captureDate ?? "").localeCompare(right.captureDate ?? "") ||
      left.id.localeCompare(right.id),
  );
}

export function sortAuditRecords(records) {
  return records.sort((left, right) => left.id.localeCompare(right.id));
}
