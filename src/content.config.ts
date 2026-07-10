import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const themeSchema = z.object({
  background: z.string().default("#11110f"),
  foreground: z.string().default("#f4f0e8"),
  accent: z.string().default("#3157ff"),
  rhythm: z.enum(["tight", "balanced", "expansive"]).default("balanced"),
  grain: z.number().min(0).max(1).default(0.25),
  motion: z.enum(["quiet", "spring", "kinetic"]).default("spring")
});

const imageSchema = z.object({
  type: z.literal("image"),
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().min(1),
  caption: z.string().optional(),
  layout: z.enum(["full", "wide", "portrait", "inset", "pair"]).default("wide")
});

const videoSchema = z.object({
  type: z.literal("video"),
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().min(1),
  caption: z.string().optional(),
  poster: z.string().optional(),
  layout: z.enum(["full", "wide", "portrait", "inset", "pair"]).default("wide")
});

const coverSchema = z.object({
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().min(1)
});

const photography = defineCollection({
  loader: glob({ base: "./src/content/photography", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    location: z.string(),
    description: z.string(),
    draft: z.boolean().default(true),
    featured: z.boolean().default(false),
    presentation: z.enum(["editorial-grid", "film-strip", "kinetic-collage", "custom"]),
    visualModule: z.string().optional(),
    theme: themeSchema,
    cover: coverSchema,
    media: z.array(z.discriminatedUnion("type", [imageSchema, videoSchema])).default([])
  })
});

const demoSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("native"), id: z.string() }),
  z.object({ type: z.literal("iframe"), url: z.url(), title: z.string() }),
  z.object({ type: z.literal("external"), url: z.url() }),
  z.object({ type: z.literal("none") })
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
    links: z.object({
      repository: z.url().optional(),
      live: z.url().optional()
    }).default({}),
    demo: demoSchema.default({ type: "none" })
  })
});

const profile = defineCollection({
  loader: glob({ base: "./src/content/profile", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    draft: z.boolean().default(true),
    summary: z.string()
  })
});

export const collections = { photography, projects, profile };
