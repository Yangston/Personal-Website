import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import { mapConcurrent } from "./concurrency.mjs";

export async function hashFile(filename, algorithm = "sha256") {
  const hash = createHash(algorithm);
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filename);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

export async function hashFileDigests(filename) {
  const sha1 = createHash("sha1");
  const sha256 = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filename);
    stream.on("data", (chunk) => {
      sha1.update(chunk);
      sha256.update(chunk);
    });
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return {
    contentDigest: sha1.digest("hex"),
    sourceDigest: sha256.digest("hex"),
  };
}

export async function buildIntegrityIndex({ photos, mediaRoot, concurrency }) {
  return mapConcurrent(photos, concurrency, async (photo) => {
    const variants = await mapConcurrent(
      photo.manifestRecord.variants,
      Math.min(concurrency, photo.manifestRecord.variants.length),
      async (variant) => {
        const filename = path.join(
          mediaRoot,
          variant.src.split("/").at(-2),
          path.basename(variant.src),
        );
        const [metadata, digest] = await Promise.all([
          stat(filename),
          hashFile(filename),
        ]);
        return { ...variant, bytes: metadata.size, digest };
      },
    );
    return {
      id: photo.manifestRecord.id,
      source: photo.manifestRecord.source,
      sourceDigest: photo.photo.sourceDigest,
      sourceBytes: photo.photo.sourceBytes,
      variants,
    };
  });
}

export async function buildIntegrityIndexFromManifest({
  manifest,
  sourceRoot,
  mediaRoot,
  concurrency,
}) {
  const photos = await mapConcurrent(manifest, concurrency, async (record) => {
    const filename = path.join(sourceRoot, ...record.source.split("/"));
    const [sourceDigest, sourceStat] = await Promise.all([
      hashFile(filename),
      stat(filename),
    ]);
    return {
      manifestRecord: record,
      photo: { sourceDigest, sourceBytes: sourceStat.size },
    };
  });
  return buildIntegrityIndex({ photos, mediaRoot, concurrency });
}
