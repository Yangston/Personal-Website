export function shouldScheduleUniverseFrame(
  state: Readonly<{
    effectsPinned: boolean;
    reducedMotion: boolean;
    flight: boolean;
    renderRequested: boolean;
    activeInput: boolean;
  }>,
) {
  return (
    state.flight ||
    state.renderRequested ||
    (!state.reducedMotion && !state.effectsPinned) ||
    (state.effectsPinned && state.activeInput)
  );
}
