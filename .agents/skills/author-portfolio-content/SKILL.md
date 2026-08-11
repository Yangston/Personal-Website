---
name: author-portfolio-content
description: Create and update schema-valid portfolio content and its supporting assets. Use when authoring project or photography MDX; changing site identity or navigation; publishing or featuring entries; registering project demos; or diagnosing content collection and route-generation failures.
---

# Author portfolio content

## Ground the change

1. Read `AGENTS.md`, `src/content/AGENTS.md`, and `docs/CONTENT.md`.
2. Inspect `src/content.config.ts`, a neighboring entry of the same collection, the consuming route, and the current git diff.
3. Identify whether the request targets site configuration, a project, or a photography country.

## Follow the collection contract

### Projects

- Create `src/content/projects/<slug>.mdx` with schema-valid title, year, status, role, summary, stack, cover, draft, featured, links, and demo data.
- Supply a public cover with accurate intrinsic dimensions, useful alt text, optimization, and publishing approval. Files under `public` deploy even when their associated MDX is a draft.
- Choose exactly one demo discriminator: `native`, `iframe`, `external`, or `none`.
- Register a native demo ID in `src/components/demos/registry.ts`; keep iframe sandboxing and a direct-link fallback. External demos require no registry entry.
- Remember that draft entries render in development and are excluded from production collections.

### Photography countries

- Create or update `src/content/photography/<country-slug>.mdx` with a two-letter ISO code, globe coordinates, date range, description, theme, cover ID, and ordered regions.
- Keep region IDs identical across archive folder names, MDX chapters, and `src/config/photography.json`.
- Choose a `coverId` that exists in the generated manifest. Use `$process-photography-images` when source photos change.
- Treat geographic and date claims as editorial facts that require review; never present inferred per-frame placement as EXIF truth.

### Site configuration

- Update `src/config/site.ts` for public identity, navigation, contact, resume, and social links. Confirm external-link and mailto behavior.

## Preserve frontend boundaries

- Keep route composition and durable copy in Astro. Add React only for stateful interaction.
- Reuse design tokens and component patterns rather than embedding a new visual system in MDX.
- Preserve useful static content, headings, metadata, canonical URLs, keyboard behavior, and reduced-motion behavior.
- Do not hand-edit generated photography JSON or responsive images.

## Validate and report

Run `npm run check` for all content changes. Run `npm run photos:check` for photography content, `npm run build` for draft filtering and static paths, and targeted Playwright tests for changed routes. Run `npm test` when navigation, demos, galleries, route lists, or interaction contracts change.

Report the authored entry, publication state, route, assets, registry changes, and validation results. Call out editorial facts, missing source assets, or publicly deployed draft assets.
