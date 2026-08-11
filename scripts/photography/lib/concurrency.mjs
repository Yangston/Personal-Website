import os from "node:os";

export const defaultPhotographyConcurrency = Math.max(
  1,
  Math.min(4, os.availableParallelism?.() ?? os.cpus().length),
);

export function parseConcurrency(
  args,
  fallback = defaultPhotographyConcurrency,
) {
  const argument = args.find((value) => value.startsWith("--concurrency="));
  if (!argument) return fallback;
  const parsed = Number.parseInt(argument.slice(argument.indexOf("=") + 1), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8)
    throw new Error("--concurrency must be an integer between 1 and 8.");
  return parsed;
}

export async function mapConcurrent(values, concurrency, worker) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => run()),
  );
  return results;
}

export function createPhaseTimings() {
  const startedAt = performance.now();
  const phases = [];
  return {
    async measure(label, operation) {
      const start = performance.now();
      const result = await operation();
      phases.push({ label, durationMs: performance.now() - start });
      return result;
    },
    print() {
      const totalMs = performance.now() - startedAt;
      console.log(
        [
          ...phases.map(
            ({ label, durationMs }) => `${label} ${Math.round(durationMs)}ms`,
          ),
          `total ${Math.round(totalMs)}ms`,
        ].join(" | "),
      );
    },
  };
}
