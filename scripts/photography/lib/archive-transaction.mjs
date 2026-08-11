import { access, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function replaceArchiveTargets(replacements) {
  const completed = [];
  try {
    for (const { target, source, backup } of replacements) {
      await mkdir(path.dirname(target), { recursive: true });
      await mkdir(path.dirname(backup), { recursive: true });
      const hadTarget = await exists(target);
      if (hadTarget) await rename(target, backup);
      try {
        await rename(source, target);
      } catch (error) {
        if (hadTarget) await rename(backup, target).catch(() => {});
        throw error;
      }
      completed.push({ target, backup, hadTarget });
    }
  } catch (error) {
    for (const item of completed.reverse()) {
      await rm(item.target, { recursive: true, force: true }).catch(() => {});
      if (item.hadTarget)
        await rename(item.backup, item.target).catch(() => {});
    }
    throw error;
  }
}
