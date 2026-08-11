# Content and media guide

This guide applies under `src/content` and supplements the root guide.

## Collection contracts

- Hand-author country and project MDX against `src/content.config.ts`.
- Follow a neighboring entry; schema changes require consumer, documentation, and test updates.
- Draft content is visible in development and excluded from production helpers.
- Featured flags control homepage selection and do not override draft filtering.

## Projects and public assets

- Project covers need stable public paths, positive dimensions, and meaningful alt text.
- Keep demo frontmatter aligned with its discriminator. Register native demos and retain iframe sandboxing plus external fallbacks.
- Project covers, portraits, PDFs, and general public images do not enter the photography processor.

## Photography archive

- Put new JPEGs in `iCloud Photos/Unprocessed`; successful import moves them into `<Country>/<region>`.
- Keep country/region identifiers synchronized with config, country MDX, and the manifest.
- `npm run photos` generates responsive media, a sanitized audit, and the integrity index. Never hand-edit generated gallery data or WebPs.
- `npm run photos:rebuild` handles replacements, removals, and processor changes atomically.
- Review public alt text and date-only values in `src/config/photography-publication.json`.
- Videos remain archival until an explicit transcode/poster workflow exists.

## Privacy

Distinguish verified GPS from timestamp, folder, visual, or manual inference, but do not publish GPS or camera geometry from this portfolio. Supply useful alt text and intrinsic dimensions. Exact timestamps, rich EXIF, credentials, and private evidence stay ignored and outside production.

Use `author-portfolio-content` and `process-photography-images` for their respective workflows.
