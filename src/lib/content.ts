import { getCollection } from "astro:content";

export async function getPhotography() {
  const entries = await getCollection(
    "photography",
    ({ data }) => !import.meta.env.PROD || !data.draft,
  );
  return entries.sort(
    (a, b) =>
      b.data.dateRange.start.valueOf() - a.data.dateRange.start.valueOf(),
  );
}

export async function getProjects() {
  const entries = await getCollection(
    "projects",
    ({ data }) => !import.meta.env.PROD || !data.draft,
  );
  return entries.sort((a, b) => b.data.year - a.data.year);
}
