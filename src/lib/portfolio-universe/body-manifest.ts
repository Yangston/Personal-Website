import artwork from "@/data/celestial-body-artwork.json";

export const CELESTIAL_BODIES = [
  {
    id: "ringed-planet",
    kind: "ringed",
    seed: 13,
    position: { x: -21, y: 20, z: -78 },
    mobilePosition: { x: -12, y: -17, z: -82 },
    radius: 1.7,
    opacity: 0.68,
    color: 0xd8c2b1,
    mobile: true,
  },
  {
    id: "crescent-moon",
    kind: "moon",
    seed: 29,
    position: { x: -43, y: 48, z: -108 },
    radius: 1.65,
    opacity: 0.48,
    color: 0xc8c6ce,
    mobile: false,
  },
  {
    id: "asteroid-chalk",
    kind: "asteroid",
    seed: 41,
    position: { x: -27, y: -22, z: -47 },
    mobilePosition: { x: 26, y: 53, z: -112 },
    radius: 0.85,
    opacity: 0.5,
    color: 0xc7b9ac,
    mobile: true,
  },
  {
    id: "asteroid-iron",
    kind: "asteroid",
    seed: 67,
    position: { x: 78, y: 33, z: -85 },
    radius: 1.05,
    opacity: 0.48,
    color: 0xa99da5,
    mobile: false,
  },
  {
    id: "asteroid-ice",
    kind: "asteroid",
    seed: 97,
    position: { x: 4, y: 29, z: -98 },
    radius: 0.9,
    opacity: 0.42,
    color: 0xd7dde0,
    mobile: false,
  },
] as const;
export type CelestialBody = (typeof CELESTIAL_BODIES)[number];
/** Adaptive detail recedes smoothly instead of toggling planets at a threshold. */
export function bodyDetailOpacity(
  detailScale: number,
  kind: CelestialBody["kind"],
) {
  if (kind === "ringed") return 1;
  const progress = Math.max(0, Math.min(1, (detailScale - 0.45) / 0.4));
  return progress * progress * (3 - 2 * progress);
}
/** Clear the Projects approach before nearby decorative planets fill the view. */
export function bodySceneOpacity(aboutWeight: number, projectsWeight: number) {
  const progress = Math.max(0, Math.min(1, projectsWeight / 0.35));
  return (
    (1 - aboutWeight * 0.85) * (1 - progress * progress * (3 - 2 * progress))
  );
}
export function bodySize(body: CelestialBody) {
  return (
    body.radius *
    (body.kind === "ringed" ? 4.6 : body.kind === "moon" ? 2.25 : 2.7)
  );
}
export function sampleBody(
  body: CelestialBody,
  timeMs: number,
  reduced = false,
  viewportWidth = 1440,
) {
  const t = reduced ? 0 : Math.max(0, timeMs) / 1000;
  const phase = body.seed * 0.27;
  const position =
    viewportWidth <= 700 && "mobilePosition" in body
      ? body.mobilePosition
      : body.position;
  return {
    position: {
      x: position.x + (Math.sin(t * 0.095 + phase) - Math.sin(phase)) * 0.9,
      y: position.y + (Math.cos(t * 0.075 + phase) - Math.cos(phase)) * 0.65,
      z: position.z,
    },
    roll: Math.sin(t * 0.09) * 0.065,
    spin: t * (body.kind === "asteroid" ? 0.028 : 0.008),
  };
}

export function bodyArtwork(body: CelestialBody, viewportWidth = 1440) {
  return artwork[body.id][viewportWidth <= 700 ? "mobile" : "desktop"];
}
