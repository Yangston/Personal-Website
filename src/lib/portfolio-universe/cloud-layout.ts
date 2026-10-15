export type CloudLayout = {
  id: "songs" | "books" | "hobbies";
  x: number;
  y: number;
  size: number;
  itemWidth: number;
  gap: number;
};

/** Reserved regions are independent of open state, including on short phones. */
export function resolveCloudLayout(
  width: number,
  height: number,
): CloudLayout[] {
  const narrow = width <= 700;
  const top = narrow ? 190 : 242;
  const available = Math.max(240, height - top - (narrow ? 112 : 82));
  const size = narrow
    ? Math.max(100, Math.min(140, available / 3 - 40))
    : Math.max(180, Math.min(260, available * 0.43, width * 0.2));
  const ids = ["songs", "books", "hobbies"] as const;
  return ids.map((id, index) => ({
    id,
    x: narrow ? width / 2 : width * [0.28, 0.73, 0.49][index],
    y:
      top +
      available * (narrow ? (index + 0.5) / 3 : [0.27, 0.34, 0.76][index]),
    size,
    itemWidth: narrow ? (id === "books" ? 46 : 52) : id === "books" ? 68 : 86,
    gap: narrow ? 12 : 20,
  }));
}
