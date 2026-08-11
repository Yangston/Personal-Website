export function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

export function interpolatePoint(
  source: readonly [number, number],
  target: readonly [number, number],
  progress: number,
): [number, number] {
  return [
    source[0] + (target[0] - source[0]) * progress,
    source[1] + (target[1] - source[1]) * progress,
  ];
}
