export type AdaptiveQuality = Readonly<{
  observeFlight: (intervals: readonly number[]) => number;
  scale: number;
}>;

/** Lower decorative resolution only after repeated, sufficiently sampled flights. */
export function createAdaptiveQuality(): AdaptiveQuality {
  let scale = 1;
  let slowFlights = 0;

  return {
    get scale() {
      return scale;
    },
    observeFlight(intervals) {
      const valid = intervals.filter(
        (interval) =>
          Number.isFinite(interval) && interval > 0 && interval <= 100,
      );
      if (valid.length < 30 || valid.length / intervals.length < 0.8) {
        slowFlights = 0;
        return scale;
      }

      const mean =
        valid.reduce((total, interval) => total + interval, 0) / valid.length;
      valid.sort((left, right) => left - right);
      const p95 = valid[Math.ceil(valid.length * 0.95) - 1];
      slowFlights = mean > 24 && p95 > 34 ? slowFlights + 1 : 0;

      if (slowFlights >= 2) {
        scale = Math.max(0.7, scale * 0.85);
        slowFlights = 0;
      }
      return scale;
    },
  };
}
