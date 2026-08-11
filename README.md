# Personal Website

Stone Yang's static-first portfolio and geographic photography archive. It is built with Astro 7, strict TypeScript, React islands, Tailwind CSS, Motion, Sharp, and a progressively enhanced canvas travel globe.

Sightline, the photograph-location and camera-pose reconstruction project, now lives in the independent `Yangston/Sightline` repository and at `sightline.stoneyang.ca`. This repository intentionally contains no Sightline runtime, reconstruction data, provider integration, or project route.

## Local development

```bash
npm install
npm run dev
```

No runtime environment variables are required.

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
npm run format:check
npm run lint
npm run test:unit
npm run check
npm run build
npm test
```

See [docs/README.md](docs/README.md) for the contributor guide and [docs/PHOTOGRAPHY.md](docs/PHOTOGRAPHY.md) for the gallery workflow.

## Privacy

Original JPEGs, rich ExifTool output, exact timestamps, credentials, and local run evidence stay outside Git and production artifacts. The public manifest contains reviewed descriptions and date-only values; the portfolio does not publish camera geometry or reconstruction results.
