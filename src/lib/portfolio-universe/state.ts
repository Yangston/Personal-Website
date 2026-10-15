export const universeSceneIds = [
  "home",
  "about",
  "projects",
  "travel",
] as const;

export type UniverseSceneId = (typeof universeSceneIds)[number];

export type UniverseHistoryMode = "push" | "replace" | "none";

export type UniverseTransitionState = {
  current: UniverseSceneId;
  from: UniverseSceneId;
  to: UniverseSceneId;
  phase: "idle" | "retreating" | "approaching";
  sequence: number;
};

export function beginUniverseTransition(
  current: UniverseSceneId,
  to: UniverseSceneId,
  sequence: number,
): UniverseTransitionState {
  return {
    current,
    from: current,
    to,
    phase:
      current === to
        ? "idle"
        : current !== "home" && to !== "home"
          ? "retreating"
          : "approaching",
    sequence: sequence + 1,
  };
}

export function settleUniverseTransition(
  state: UniverseTransitionState,
  sequence: number,
): UniverseTransitionState {
  if (state.sequence !== sequence) return state;
  return {
    current: state.to,
    from: state.to,
    to: state.to,
    phase: "idle",
    sequence,
  };
}

export const isUniverseSceneId = (value: string): value is UniverseSceneId =>
  universeSceneIds.includes(value as UniverseSceneId);

export function universeSceneFromHash(hash: string): UniverseSceneId {
  const candidate = hash.replace(/^#/, "");
  return isUniverseSceneId(candidate) ? candidate : "home";
}

export function universeSceneHref(scene: UniverseSceneId) {
  return scene === "home" ? "/#home" : `/#${scene}`;
}

export function withAuthoredEntries<T extends { entries: readonly unknown[] }>(
  items: readonly T[],
) {
  return items.filter((item) => item.entries.length > 0);
}
