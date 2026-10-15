import type { WorldPoint } from "./scene-manifest";

export type RegionPoint = Readonly<{ x: number; y: number }>;
export type HomeRegion = Readonly<{
  id: "about" | "projects" | "travel";
  points: readonly RegionPoint[];
  depth: number;
}>;
export type HomeRegionInputs = Readonly<{
  earth: WorldPoint;
  radius: number;
  nebula: Readonly<{
    position: WorldPoint;
    width: number;
    height: number;
    rotation: number;
  }>;
  contour: readonly (readonly number[])[];
  stars: readonly WorldPoint[];
}>;
type Projector = (
  point: WorldPoint,
  width?: number,
  height?: number,
) => { x: number; y: number; scale: number; depth: number } | null;

/** Self-contained for the inline first-paint bootstrap as well as live input. */
export function projectHomeRegions(
  project: Projector,
  camera: WorldPoint,
  input: HomeRegionInputs,
  sphere = true,
): HomeRegion[] {
  const regions: HomeRegion[] = [];
  const globe = project(input.earth);
  if (globe) {
    const points: RegionPoint[] = [];
    if (sphere) {
      const subtract = (a: WorldPoint, b: WorldPoint) => ({
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
      });
      const cross = (a: WorldPoint, b: WorldPoint) => ({
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
      });
      const unit = (a: WorldPoint) => {
        const d = Math.hypot(a.x, a.y, a.z) || 1;
        return { x: a.x / d, y: a.y / d, z: a.z / d };
      };
      const offset = subtract(camera, input.earth);
      const distance = Math.hypot(offset.x, offset.y, offset.z);
      const normal = unit(offset);
      const u = unit(
        cross(
          normal,
          Math.abs(normal.y) < 0.9
            ? { x: 0, y: 1, z: 0 }
            : { x: 1, y: 0, z: 0 },
        ),
      );
      const v = cross(normal, u);
      const inset =
        (input.radius * input.radius) / Math.max(input.radius + 0.01, distance);
      const radius =
        input.radius *
        Math.sqrt(Math.max(0, 1 - (input.radius / distance) ** 2));
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        const p = project({
          x:
            input.earth.x +
            normal.x * inset +
            radius * (u.x * Math.cos(a) + v.x * Math.sin(a)),
          y:
            input.earth.y +
            normal.y * inset +
            radius * (u.y * Math.cos(a) + v.y * Math.sin(a)),
          z:
            input.earth.z +
            normal.z * inset +
            radius * (u.z * Math.cos(a) + v.z * Math.sin(a)),
        });
        if (p) points.push({ x: p.x, y: p.y });
      }
    } else {
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        points.push({
          x: globe.x + Math.cos(a) * input.radius * globe.scale,
          y: globe.y + Math.sin(a) * input.radius * globe.scale,
        });
      }
    }
    regions.push({ id: "travel", points, depth: globe.depth });
  }
  const nebula = project(input.nebula.position);
  if (nebula) {
    const c = Math.cos(input.nebula.rotation),
      s = Math.sin(input.nebula.rotation);
    const points = input.contour.map(([u, v]) => {
      const x = (u - 0.5) * input.nebula.width * nebula.scale,
        y = (v - 0.5) * input.nebula.height * nebula.scale;
      return { x: nebula.x + x * c + y * s, y: nebula.y - x * s + y * c };
    });
    regions.push({ id: "about", points, depth: nebula.depth });
  }
  const stars = input.stars
    .map((p) => project(p))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (stars.length > 2) {
    const points = stars
      .map((p) => ({ x: p.x, y: p.y }))
      .sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o: RegionPoint, a: RegionPoint, b: RegionPoint) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower: RegionPoint[] = [],
      upper: RegionPoint[] = [];
    for (const p of points) {
      while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0)
        lower.pop();
      lower.push(p);
    }
    for (const p of [...points].reverse()) {
      while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0)
        upper.pop();
      upper.push(p);
    }
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    const center = {
      x: hull.reduce((n, p) => n + p.x, 0) / hull.length,
      y: hull.reduce((n, p) => n + p.y, 0) / hull.length,
    };
    regions.push({
      id: "projects",
      depth: Math.min(...stars.map((p) => p.depth)),
      points: hull.map((p) => {
        const d = Math.hypot(p.x - center.x, p.y - center.y) || 1;
        return {
          x: p.x + ((p.x - center.x) / d) * 14,
          y: p.y + ((p.y - center.y) / d) * 14,
        };
      }),
    });
  }
  return regions;
}

export function regionLayout(region: HomeRegion) {
  const left = Math.min(...region.points.map((p) => p.x)),
    top = Math.min(...region.points.map((p) => p.y));
  const width = Math.max(1, Math.max(...region.points.map((p) => p.x)) - left),
    height = Math.max(1, Math.max(...region.points.map((p) => p.y)) - top);
  const polygon = region.points
    .map(
      (p) =>
        `${(((p.x - left) / width) * 100).toFixed(3)}% ${(((p.y - top) / height) * 100).toFixed(3)}%`,
    )
    .join(",");
  const outline =
    region.points
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${(((p.x - left) / width) * 1000).toFixed(2)},${(((p.y - top) / height) * 1000).toFixed(2)}`,
      )
      .join(" ") + " Z";
  return { left, top, width, height, polygon, outline };
}

/** The CSS clip is also the browser's pointer hit area; SVG supplies focus. */
export function applyHomeRegions(
  root: HTMLElement,
  regions: readonly HomeRegion[],
  layout: typeof regionLayout,
) {
  for (const region of regions) {
    const link = root.querySelector<HTMLElement>(
      `[data-universe-destination="${region.id}"]`,
    );
    if (!link || !region.points.length) continue;
    const value = layout(region);
    const style: Record<string, string> = {
      width: `${value.width.toFixed(2)}px`,
      height: `${value.height.toFixed(2)}px`,
      transform: `translate3d(${value.left.toFixed(2)}px,${value.top.toFixed(2)}px,0)`,
      "clip-path": `polygon(${value.polygon})`,
      "z-index": String(10000 - Math.round(region.depth * 10)),
    };
    for (const [key, next] of Object.entries(style))
      if (link.style.getPropertyValue(key) !== next)
        link.style.setProperty(key, next);
    for (const outline of link.querySelectorAll("[data-region-outline]"))
      if (outline.getAttribute("d") !== value.outline)
        outline.setAttribute("d", value.outline);
    link.dataset.regionReady = "true";
  }
}

export function pointInRegion(point: RegionPoint, region: HomeRegion) {
  let inside = false;
  for (
    let i = 0, j = region.points.length - 1;
    i < region.points.length;
    j = i++
  ) {
    const a = region.points[i],
      b = region.points[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
