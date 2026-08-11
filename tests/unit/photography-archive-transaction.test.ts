import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { replaceArchiveTargets } from "../../scripts/photography/lib/archive-transaction.mjs";

const temporaryRoots: string[] = [];

async function temporaryRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "portfolio-photo-archive-"));
  temporaryRoots.push(root);
  return root;
}

async function pathExists(filename: string) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("photography archive replacement", () => {
  it("replaces the media tree so confirmed orphaned WebPs are pruned", async () => {
    const root = await temporaryRoot();
    const target = path.join(root, "public/media/photography");
    const staged = path.join(root, "transaction/staging/media");
    const backup = path.join(root, "transaction/backup/media");
    await Promise.all([
      mkdir(target, { recursive: true }),
      mkdir(staged, { recursive: true }),
    ]);
    await writeFile(path.join(target, "orphan.webp"), "obsolete");
    await writeFile(path.join(staged, "current.webp"), "current");

    await replaceArchiveTargets([{ target, source: staged, backup }]);

    expect(await pathExists(path.join(target, "orphan.webp"))).toBe(false);
    expect(await readFile(path.join(target, "current.webp"), "utf8")).toBe(
      "current",
    );
  });

  it("restores every prior target when a later replacement fails", async () => {
    const root = await temporaryRoot();
    const firstTarget = path.join(root, "manifest.json");
    const secondTarget = path.join(root, "audit.json");
    const firstStage = path.join(root, "staging/manifest.json");
    await mkdir(path.dirname(firstStage), { recursive: true });
    await Promise.all([
      writeFile(firstTarget, "old-manifest"),
      writeFile(secondTarget, "old-audit"),
      writeFile(firstStage, "new-manifest"),
    ]);

    await expect(
      replaceArchiveTargets([
        {
          target: firstTarget,
          source: firstStage,
          backup: path.join(root, "backup/manifest.json"),
        },
        {
          target: secondTarget,
          source: path.join(root, "staging/missing-audit.json"),
          backup: path.join(root, "backup/audit.json"),
        },
      ]),
    ).rejects.toThrow();

    expect(await readFile(firstTarget, "utf8")).toBe("old-manifest");
    expect(await readFile(secondTarget, "utf8")).toBe("old-audit");
  });
});
