# Photography gallery publishing

The portfolio owns the travel atlas and gallery archive only. Sightline owns camera localization, pose reconstruction, experiment outputs, provider renders, and scientific verification.

## Ownership

- Canonical JPEGs: `src/content/photography/iCloud Photos/<Country>/<region>`
- New-photo inbox: `src/content/photography/iCloud Photos/Unprocessed`
- Authored geography: `src/config/photography.json`
- Authored publication copy/dates: `src/config/photography-publication.json`
- Generated manifest/audit/integrity: `src/data/photography-*.json`
- Generated responsive output: `public/media/photography`
- Rich private metadata: `.private` (ignored)

Only `photography-manifest.json`, `photography-audit.json`, and `photography-integrity.json` are portfolio-generated registries. Do not add reconstruction registries or exact camera geometry.

## Add photographs

1. Place JPEGs in `Unprocessed`.
2. Run `npm run photos -- --dry-run`.
3. Review city classification, duplicate checks, and required publication records.
4. Run `npm run photos`.
5. Run `npm run photos:check` and the normal site validation.

The incremental publisher classifies files, archives originals, generates 480/960/1600px WebPs, updates the sanitized manifest/audit/integrity records, and leaves the inbox empty on success.

## Rebuild and removal

Run `npm run photos:rebuild` after replacing/removing originals or changing processor rules. It stages the complete gallery, validates membership and hashes, swaps generated targets atomically, and prunes confirmed orphaned WebPs.

## Privacy

The public manifest exposes reviewed alt text, a date-only capture value when approved, dimensions, archive membership, and responsive URLs. Exact timestamps, GPS, EXIF device data, local paths, credentials, and private evidence stay outside Git and production output.
