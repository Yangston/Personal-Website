import { resolveCloudLayout } from "./cloud-layout";

/** Top-origin image coordinates, shared by the camera, markup and interactions. */
export const NEBULA_FOCAL_POINT = { x: 0.465, y: 0.435 } as const;
export const NEBULA_INTEREST_REGIONS = [
  {
    id: "songs",
    name: "Music",
    label: "Current rotation",
    bounds: { x: 0.2, y: 0.19, width: 0.25, height: 0.29 },
    anchor: { x: 0.32, y: 0.32 },
    labelPoint: { x: 0.31, y: 0.445 },
    middle:
      "M12 79 C18 62 10 54 27 43 C22 32 39 31 43 19 C54 23 59 9 74 15 C84 17 89 27 80 35 C66 31 70 47 58 43 C53 57 42 48 40 67 C27 65 33 82 20 87Z",
    front:
      "M15 66 C23 72 28 45 37 54 C42 39 51 62 60 49 C67 39 73 59 83 54 C92 67 75 74 75 83 C61 78 55 93 44 83 C30 89 32 73 19 78Z",
  },
  {
    id: "books",
    name: "Books",
    label: "On the nightstand",
    bounds: { x: 0.53, y: 0.2, width: 0.24, height: 0.3 },
    anchor: { x: 0.64, y: 0.33 },
    labelPoint: { x: 0.645, y: 0.465 },
    middle:
      "M14 15 C32 11 35 23 49 22 C61 18 60 35 74 34 C70 48 87 48 83 65 C88 74 77 86 64 87 C61 72 49 76 53 61 C40 60 48 45 34 43 C36 31 21 37 16 28Z",
    front:
      "M15 65 C30 75 26 49 41 57 C53 46 55 65 67 54 C73 46 79 56 85 67 C81 82 67 72 62 85 C49 76 43 91 32 79 C20 83 24 71 15 65Z",
  },
  {
    id: "hobbies",
    name: "Hobbies",
    label: "Away from the screen",
    bounds: { x: 0.27, y: 0.56, width: 0.4, height: 0.3 },
    anchor: { x: 0.465, y: 0.7 },
    labelPoint: { x: 0.465, y: 0.83 },
    middle:
      "M10 48 C20 36 26 54 39 45 C45 53 55 43 60 35 C72 41 76 24 87 25 C91 38 79 45 82 58 C68 55 72 73 56 69 C46 83 36 69 28 76 C18 70 11 66 10 48Z",
    front:
      "M13 68 C24 75 23 48 36 58 C43 45 53 66 62 51 C69 58 76 46 85 61 C90 75 74 76 68 85 C58 77 48 91 39 81 C24 86 28 71 13 68Z",
  },
] as const;

export type NebulaInterestRegion = (typeof NEBULA_INTEREST_REGIONS)[number];

/** Transparent edges on every side; the path follows a wisp, not a rectangle. */
export function nebulaFoldMask(path: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><filter id="f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter></defs><path d="${path}" fill="white" filter="url(#f)"/></svg>`)}`;
}

/** A feathered, broken cloud ridge, cached as an SVG image rather than a live filter. */
export function nebulaLightMask(path: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><filter id="f" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".055 .085" numOctaves="2" seed="8" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="13" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="3.5"/></filter></defs><path d="${path}" fill="white" filter="url(#f)"/></svg>`)}`;
}

/** Self-contained for inline first-paint use. Every crop uses the full image UVs. */
export function placeNebulaRegions(
  root: ParentNode,
  regions: readonly NebulaInterestRegion[],
  projection: {
    bounds: { left: number; top: number; width: number; height: number };
  } | null,
  viewport = { width: innerWidth, height: innerHeight },
  resolve = resolveCloudLayout,
  referenceWidth = projection?.bounds.width ?? 1,
) {
  if (!projection) return;
  const p = projection.bounds;
  const scale = Math.max(0.02, Math.min(4, p.width / referenceWidth));
  const layout = resolve(viewport.width, viewport.height);
  for (const region of regions) {
    const node = root.querySelector<HTMLElement>(`[data-cloud="${region.id}"]`);
    if (!node) continue;
    const b = region.bounds;
    const slot = layout.find((entry) => entry.id === region.id)!;
    const x = (slot.x - viewport.width / 2) * scale + p.left + 0.465 * p.width;
    const y = (slot.y - viewport.height / 2) * scale + p.top + 0.435 * p.height;
    const values = {
      "--cloud-scale": String(scale),
      "--cloud-x": `${x}px`,
      "--cloud-y": `${y}px`,
      "--cloud-width": `${slot.size}px`,
      "--cloud-height": `${slot.size}px`,
      "--item-width": `${slot.itemWidth}px`,
      "--nebula-width": `${p.width}px`,
      "--nebula-height": `${p.height}px`,
      "--nebula-offset-x": `${-b.x * p.width}px`,
      "--nebula-offset-y": `${-b.y * p.height}px`,
      "--anchor-x": "0px",
      "--anchor-y": "0px",
    };
    for (const [key, value] of Object.entries(values))
      if (node.style.getPropertyValue(key) !== value)
        node.style.setProperty(key, value);
    node.dataset.regionReady = "true";
  }
}
