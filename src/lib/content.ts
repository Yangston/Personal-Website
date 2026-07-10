import { getCollection } from "astro:content";

export async function getPhotography() {
  const entries = await getCollection("photography", ({ data }) => !import.meta.env.PROD || !data.draft);
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getProjects() {
  const entries = await getCollection("projects", ({ data }) => !import.meta.env.PROD || !data.draft);
  return entries.sort((a, b) => b.data.year - a.data.year);
}
