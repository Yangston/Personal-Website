# Personal Website

Stone Yang's static-first portfolio and geographic photography archive, built as a continuous ivory space environment. Home, the About nebula, project constellations, and the Travel globe share one scene composition and persistent world; case studies and galleries remain scrollable detail pages. The stack is Astro 7, strict TypeScript, Three.js, React islands, Tailwind CSS, Motion, and Sharp.

Sightline, the photograph-location and camera-pose reconstruction application, lives in the independent `Yangston/Sightline` repository and at `sightline.stoneyang.ca`. Its portfolio case study may link there; this repository contains no Sightline runtime, reconstruction data, provider integration, or scene endpoint.

## Local development

Use Node 24.16.0 or a later Node 24 release (`.node-version` pins the baseline).

```bash
npm ci
npm run dev
```

No runtime environment variables or paid app integrations are required. The universe uses `/#home`, `/#about`, `/#projects`, and `/#travel`; native links and content remain usable without JavaScript.

## Photography publishing

Place new JPEGs in `src/content/photography/iCloud Photos/Unprocessed`, then run:

```bash
npm run photos -- --dry-run
npm run photos
npm run photos:check
```

Use `npm run photos:rebuild` after replacing/removing originals or changing processor rules. The portfolio publisher owns gallery classification, reviewed copy and dates, the sanitized audit, integrity records, and responsive WebPs only.

## Validation

```bash
npm run photos:check
npm run format:check
npm run lint
npm run test:unit
npm run check
npm run build
npm test
```

See [docs/README.md](docs/README.md) for the contributor guide, [docs/PHOTOGRAPHY.md](docs/PHOTOGRAPHY.md) for the gallery workflow, and [design-qa.md](design-qa.md) for current visual acceptance status. Hardware performance and software-rendered test results are reported separately.

## Privacy

Original JPEGs, rich ExifTool output, exact timestamps, credentials, and local run evidence stay outside Git and production artifacts. The public manifest contains reviewed descriptions and date-only values; the portfolio does not publish camera geometry or reconstruction results.
