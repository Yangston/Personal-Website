import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(root, "dist");
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".txt",
  ".xml",
]);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(filename)));
    else if (textExtensions.has(path.extname(entry.name))) files.push(filename);
  }
  return files;
}

const forbidden = [
  [/\.private[\\/]/i, "private metadata path"],
  [/iCloud Photos/i, "archival source path"],
  [/[A-Z]:\\Users\\/i, "Windows user path"],
  [/\/Users\/[^/]+\//, "macOS user path"],
  [
    /captureDate.{0,120}\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/i,
    "exact public capture timestamp",
  ],
  [
    /photograph-locator|photography-map|PhotoCalibration|scene\.json|CesiumSceneController/i,
    "removed Sightline runtime implementation",
  ],
];

const files = await walk(distRoot);
for (const filename of files) {
  const source = await readFile(filename, "utf8");
  for (const [pattern, label] of forbidden)
    if (pattern.test(source))
      throw new Error(`${path.relative(root, filename)} contains a ${label}.`);
}

console.log(
  `Artifact boundary verified across ${files.length} text files; the portfolio contains no private or Sightline runtime output.`,
);
