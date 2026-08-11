import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  commitPhotographyInbox,
  preparePhotographyInbox,
} from "./lib/photography-inbox.mjs";
import { photographyCities } from "./lib/photography-config.mjs";
import { buildIntegrityIndexFromManifest } from "./lib/publishing-indexes.mjs";
import { createPhaseTimings, parseConcurrency } from "./lib/concurrency.mjs";
import {
  assertPublicationMembership,
  parsePublicationRecords,
} from "./lib/photography-publication.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const concurrencyArgument = args.find((value) =>
  value.startsWith("--concurrency="),
);
const supportedArguments = new Set(["--dry-run", concurrencyArgument]);
const unknownArguments = args.filter((value) => !supportedArguments.has(value));
if (unknownArguments.length)
  throw new Error(
    `Unsupported photography option: ${unknownArguments.join(", ")}`,
  );

const concurrency = parseConcurrency(args);
const timings = createPhaseTimings();
const manifestPath = path.join(root, "src/data/photography-manifest.json");
const integrityPath = path.join(root, "src/data/photography-integrity.json");
const archiveRoot = path.join(root, "src/content/photography/iCloud Photos");
const mediaRoot = path.join(root, "public/media/photography");
const publicationRecords = parsePublicationRecords(
  path.join(root, "src/config/photography-publication.json"),
);

const plan = await timings.measure("preflight", () =>
  preparePhotographyInbox({ root, cities: photographyCities, concurrency }),
);
console.log(
  plan.items.length
    ? `Found ${plan.items.length} valid inbox JPEG${plan.items.length === 1 ? "" : "s"}.`
    : "No inbox JPEGs found.",
);
if (args.includes("--dry-run")) {
  console.log(
    JSON.stringify(
      plan.items.map(
        ({ filename, destination, city, method, confidence, id }) => ({
          id,
          source: path.relative(root, filename),
          destination: path.relative(root, destination),
          city: city.id,
          method,
          confidence,
        }),
      ),
      null,
      2,
    ),
  );
  process.exit(0);
}

const imported = await timings.measure("encoding and commit", () =>
  commitPhotographyInbox(plan, { concurrency }),
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
assertPublicationMembership(manifest, publicationRecords);
const integrity = await timings.measure("integrity", () =>
  buildIntegrityIndexFromManifest({
    manifest,
    sourceRoot: archiveRoot,
    mediaRoot,
    concurrency,
  }),
);
await writeFile(integrityPath, `${JSON.stringify(integrity, null, 2)}\n`);
console.log(
  imported.length
    ? `Published ${imported.length} photo${imported.length === 1 ? "" : "s"} to the gallery.`
    : "Nothing to publish. The gallery is unchanged.",
);
timings.print();
