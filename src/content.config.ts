import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const themeSchema = z.object({
  background: z.string().default("#11110f"),
  foreground: z.string().default("#f4f0e8"),
  accent: z.string().default("#3157ff"),
  rhythm: z.enum(["tight", "balanced", "expansive"]).default("balanced"),
  grain: z.number().min(0).max(1).default(0.25),
  motion: z.enum(["quiet", "spring", "kinetic"]).default("spring"),
});

const coverSchema = z.object({
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().min(1),
});

const photography = defineCollection({
  loader: glob({ base: "./src/content/photography", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    name: z.string(),
    isoCode: z.string().length(2),
    coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
    dateRange: z.object({ start: z.coerce.date(), end: z.coerce.date() }),
    description: z.string(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    theme: themeSchema,
    coverId: z.string(),
    regions: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        label: z.string(),
        coordinates: z
          .object({ latitude: z.number(), longitude: z.number() })
          .optional(),
      }),
    ),
  }),
});

const demoSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("native"), id: z.string() }),
  z.object({ type: z.literal("iframe"), url: z.url(), title: z.string() }),
  z.object({ type: z.literal("external"), url: z.url() }),
  z.object({ type: z.literal("none") }),
]);

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    year: z.number().int(),
    status: z.string(),
    role: z.string(),
    summary: z.string(),
    stack: z.array(z.string()),
    cover: coverSchema,
    draft: z.boolean().default(true),
    featured: z.boolean().default(false),
    links: z
      .object({
        repository: z.url().optional(),
        live: z.url().optional(),
      })
      .default({}),
    demo: demoSchema.default({ type: "none" }),
  }),
});

export const collections = { photography, projects };
