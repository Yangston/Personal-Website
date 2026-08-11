# Repository agent guide

## Authority and working agreement

This file is the repository-wide operating contract. Read it before changing anything, then read any nearer `AGENTS.md`; the nearest file adds or overrides guidance for its subtree.

- Preserve unrelated user changes. Inspect the diff and never discard, reset, or reformat work outside the task.
- Keep changes within scope and report pre-existing failures separately.
- Prefer existing architecture, design tokens, schemas, registries, and scripts.
- Update documentation when commands, contracts, generated artifacts, or boundaries change.
- Never commit secrets, `.env`, `.private`, `dist`, `.astro`, Playwright output, logs, or new full-resolution media without an explicit publishing need.

## System overview

This is a static-first portfolio built with Astro 7 on Node 24, strict TypeScript, React 19 islands, Tailwind CSS 4, Motion, Sharp, and a progressively enhanced canvas travel atlas. Vercel hosts static output; there is no application server, upload endpoint, provider credential, or private runtime secret.

Sightline is a separate repository and deployment. This portfolio must not contain its camera localization, pose reconstruction, provider viewers, scene endpoints, public reconstruction data, or research documentation.

Architecture rules:

- Use Astro for routes, layouts, metadata, content loading, static structure, and durable copy.
- Use React only for client state, coordinated motion, dialogs, or interaction that cannot remain static.
- Keep island props small, serializable, and scoped to the consuming route.
- Retain useful HTML without JavaScript. Canvas and motion are enhancements, not navigation requirements.

## Repository map

| Path                             | Responsibility                                      |
| -------------------------------- | --------------------------------------------------- |
| `src/pages`                      | Astro routes and composition                        |
| `src/layouts`                    | Shared document shell, metadata, navigation, footer |
| `src/components`                 | Astro presentation and hydrated React islands       |
| `src/content.config.ts`          | Zod-backed content contracts                        |
| `src/content`                    | Projects, countries, and archival photo inputs      |
| `src/lib/photography-atlas`      | Travel globe and country silhouette geometry        |
| `src/lib/photography-catalog.ts` | Gallery-only city configuration access              |
| `scripts/photography`            | Gallery publishing and archive maintenance          |
| `src/data`                       | Generated manifest, audit, and integrity index      |
| `public/media/photography`       | Generated responsive WebPs                          |
| `tests`                          | Playwright and Vitest coverage                      |
| `docs`                           | Contributor documentation                           |

## Authored, generated, and private data

- Hand-author MDX, `src/config/site.ts`, `src/config/photography.json`, and `src/config/photography-publication.json`.
- Treat `photography-manifest.json`, `photography-audit.json`, `photography-integrity.json`, and responsive WebPs as generated; never edit them by hand.
- Put new JPEGs in `src/content/photography/iCloud Photos/Unprocessed` and run `npm run photos`.
- Use `npm run photos:rebuild` after replacing/removing originals or changing processor rules.
- Raw sources are archival inputs, not served assets. Rich ExifTool output belongs only in ignored `.private` storage.
- The public manifest contains reviewed descriptions and date-only values, never source GPS or camera geometry.
- Project covers, portraits, resumes, icons, and social assets are manually managed.

## Commands

| Command                          | Purpose                                 | When required                         |
| -------------------------------- | --------------------------------------- | ------------------------------------- |
| `npm install`                    | Install locked dependencies             | Initial setup or lockfile changes     |
| `npm run dev`                    | Start Astro                             | Local authoring                       |
| `npm run photos -- --dry-run`    | Preflight inbox JPEGs                   | Before publishing                     |
| `npm run photos`                 | Incrementally publish gallery media     | New inbox photos                      |
| `npm run photos:rebuild`         | Atomically rebuild gallery outputs      | Replacement/removal/processor changes |
| `npm run photos:check`           | Source-aware integrity check            | Photography publishing validation     |
| `npm run photos:check:generated` | Source-independent state check          | CI and builds                         |
| `npm run photos:check -- --deep` | ExifTool and Sharp archive verification | Processor/release validation          |
| `npm run format:check`           | Check authored formatting               | All changes                           |
| `npm run lint`                   | Lint Astro/TypeScript/JavaScript        | Code changes                          |
| `npm run test:unit`              | Run deterministic unit tests            | Publishing/atlas logic changes        |
| `npm run check`                  | Astro and TypeScript diagnostics        | Code/content changes                  |
| `npm run build`                  | Build and scan production output        | Code/content/deploy changes           |
| `npm test`                       | Playwright mobile and desktop           | Route/layout/interaction changes      |

`npm test` does not run Vitest. Do not use rewriting commands during read-only validation.

## Change workflows

### Static pages and content

Validate frontmatter against `src/content.config.ts`, follow a neighboring entry, and confirm draft behavior in production. Covers need public URLs, intrinsic dimensions, and useful alt text. Native demos must be registered; iframe demos retain sandboxing and a direct-link fallback.

### Components and interaction

Read `src/components/AGENTS.md`. Preserve semantic HTML and static fallbacks. Every pointer action needs keyboard parity; dialogs need naming, Escape behavior, arrow controls where applicable, focus entry, and focus restoration. Clean up timers, observers, and listeners.

### Photography publishing

Read `src/content/AGENTS.md` and `docs/PHOTOGRAPHY.md`. The inbox is for new photos; country/region folders remain canonical after import. Region IDs must agree across folders, MDX, and config. Do not present inferred location as verified EXIF. Use `process-photography-images` for source changes.

## Engineering conventions

- Keep TypeScript strict and isolate unavoidable third-party casts.
- Use the `@/*` alias for `src/*` imports where practical.
- Match existing two-space formatting, TypeScript semicolons, and multiline trailing commas.
- Keep schemas and shared types at module boundaries.
- Prefer small Astro components; do not add React solely for styling or markup reuse.
- Reuse tokens and primitives. Motion should favor transform/opacity and respect reduced motion.

## Quality bar

Every public page and interaction must avoid overflow from 320px through desktop, expose visible keyboard focus and semantic names, preserve dialog focus, respect reduced motion, retain no-JavaScript content, and use responsive images with intrinsic dimensions. Add Playwright coverage for interaction and Vitest for deterministic logic.

## Environment, deployment, and privacy

The portfolio has no required runtime environment variables. Never expose `.private` records or credentials to client code. Astro output stays static; do not add runtime server dependencies or secret-dependent rendering without an explicit architecture decision.

## Documentation and handoff

Start at `docs/README.md`. Before handoff, inspect the final diff, run the checks selected by `validate-portfolio-site`, and report commands, results, skipped checks, generated files, and warnings.
