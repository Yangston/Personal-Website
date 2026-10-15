import type { WorldPoint } from "./scene-manifest";

/** Self-contained so the first paint and context-loss fallback share projection. */
export function updateProjectFallback(
  root: HTMLElement,
  project: (
    point: WorldPoint,
  ) => { x: number; y: number; depth: number } | null,
  resolve: (point: WorldPoint) => WorldPoint,
  width: number,
  height: number,
) {
  const sky = root.querySelector<SVGSVGElement>(
    "[data-world-project-fallback]",
  );
  if (!sky) return;
  sky.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const center = project(resolve({ x: -2.8, y: 6.8, z: -50 }));
  sky.style.zIndex = String(
    Math.round(1_000_000 - (center?.depth ?? 1000) * 100),
  );
  for (const group of sky.querySelectorAll<SVGGElement>(
    "[data-project-vertices]",
  )) {
    const vertices = JSON.parse(group.dataset.projectVertices!) as WorldPoint[];
    const points = vertices.map((point) => project(resolve(point)));
    for (const star of group.querySelectorAll<SVGElement>("[data-star]")) {
      const point = points[Number(star.dataset.star)];
      star.setAttribute(
        "transform",
        point ? `translate(${point.x} ${point.y})` : "scale(0)",
      );
    }
    for (const line of group.querySelectorAll<SVGLineElement>("[data-edge]")) {
      const [a, b] = line.dataset.edge!.split(",").map(Number);
      const from = points[a],
        to = points[b];
      line.style.visibility = from && to ? "" : "hidden";
      if (!from || !to) continue;
      line.setAttribute("x1", String(from.x));
      line.setAttribute("y1", String(from.y));
      line.setAttribute("x2", String(to.x));
      line.setAttribute("y2", String(to.y));
    }
  }
}
