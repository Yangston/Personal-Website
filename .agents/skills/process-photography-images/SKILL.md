---
name: process-photography-images
description: Process, replace, remove, and audit archival photography images for this portfolio. Use when adding JPEG sources under the country/region archive, regenerating responsive WebP variants and the photography manifest, checking EXIF coverage, reviewing generated assets, or diagnosing stale photography output.
---

# Process photography images

## Ground the change

1. Read `AGENTS.md`, `src/content/AGENTS.md`, and `docs/PHOTOGRAPHY.md`.
2. Inspect `scripts/photography/import.mjs`, `archive.mjs`, the affected country MDX, and the current git diff.
3. Confirm that the request concerns the photography archive. Do not route project covers, the portrait, social images, or arbitrary `public/` assets through this pipeline.

## Prepare sources

- Place new JPEG sources in `src/content/photography/iCloud Photos/Unprocessed`. The incremental publisher moves accepted inputs into `<Country>/<region>` after classification and preflight.
- Preserve the original file and EXIF data. Do not resize, recompress, rename, or strip metadata before processing unless the user explicitly requests an archival change.
- Reject root-level, unknown-country, or unknown-region placement. When introducing a country or region, update `src/config/photography.json` and the matching country MDX deliberately.
- Treat MOV and MP4 files as archival-only. Do not publish them without a separate transcode and poster workflow.
- Check capture date and intrinsic dimensions before running the processor; both are required.
- Review location sensitivity before processing. The processor can copy compact exact GPS into the public manifest, and gallery hydration can serialize it even when the photo is not in the map pilot.

## Generate and audit

1. Run `npm run photos -- --dry-run`, then `npm run photos`, for new inbox images. Gallery publication is authoritative; missing calibration prerequisites or a rejected pose still returns success with retry guidance. Complete rejected candidates remain visible for warned camera review; incomplete attempts remain marker-only.
2. Run `npm run photos:rebuild` after replacing or removing originals or changing processor rules. It stages responsive media, exact private metadata, the sanitized audit, and map membership together, then prunes confirmed generated orphans.
3. Review each manifest record for stable ID, country, region, date, orientation, dimensions, variants, alt text, and optional public GPS. Replace generic location alt text editorially when the scene is known.
4. Check the generated asset diff and confirm that rebuild pruning removed only WebPs absent from the canonical manifest.
5. Update `coverId`, regional chapters, or pilot data only when the content or map task requires it. Never copy hashed URLs into pilot authoring data.

## Protect privacy and publishing boundaries

- Treat the full-resolution source and any manifest GPS as publication-sensitive. Repository visibility and browser-serialized manifest records are separate from map-pilot visibility.
- Keep rich `.private` audit data and sensitive timestamps out of public runtime records.
- Do not infer per-frame GPS from folder names or capture order. Label manual or visual placement as estimated.
- Never hand-edit the generated manifest, sanitized audit, or responsive variants.
- Do not expose provider credentials or add originals to served paths.

## Validate and report

Run, in order:

```bash
npm run photos:check
npm run check
npm run build
```

Run targeted Playwright coverage for affected country routes; run `npm test` when counts, galleries, covers, routes, or map integration change. Report source files changed, generated files added or removed, public GPS exposure, audit coverage, validation results, and any images needing editorial alt text or manual calibration.
