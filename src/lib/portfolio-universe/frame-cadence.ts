export type FrameCadence = Readonly<{
  shouldRender: (time: number, targetFps: 30 | 60) => boolean;
  reset: () => void;
}>;

/** Sample display frames against a stable clock without quantizing the target rate. */
export function createFrameCadence(): FrameCadence {
  let nextDeadline: number | null = null;
  let previousTime: number | null = null;
  let activeFps: 30 | 60 | null = null;

  return {
    shouldRender(time, targetFps) {
      if (!Number.isFinite(time)) return false;
      const interval = 1_000 / targetFps;
      const restart =
        nextDeadline === null ||
        activeFps !== targetFps ||
        (previousTime !== null && time < previousTime);
      previousTime = time;
      activeFps = targetFps;

      if (restart || nextDeadline === null) {
        nextDeadline = time + interval;
        return true;
      }

      // Browser RAF timestamps are rounded and jitter around the ideal display
      // clock. Accept a sub-millisecond early frame without changing the phase.
      if (time + 0.8 < nextDeadline) return false;

      // Keep the original phase during normal refresh-rate sampling. After a
      // missed target interval, discard the backlog instead of catching up.
      nextDeadline =
        time - nextDeadline >= interval
          ? time + interval
          : nextDeadline + interval;
      return true;
    },
    reset() {
      nextDeadline = null;
      previousTime = null;
      activeFps = null;
    },
  };
}
