---
name: validate-portfolio-site
description: Select, run, and interpret risk-based validation for this Astro portfolio. Use before handing off changes, when checking generated photography freshness, when testing content, UI, Cesium, build, or deployment work, or when diagnosing failures from formatting, lint, Astro checks, Vitest, build, or Playwright.
---

# Validate the portfolio site

## Classify the change

1. Read `AGENTS.md`, `docs/TESTING.md`, the nearest nested `AGENTS.md`, and the current git diff.
2. Separate pre-existing failures and unrelated user changes from the task under validation.
3. Choose the smallest command set that covers the change, then include every broader check required by `AGENTS.md` or the user.

## Use the validation matrix

- Documentation or agent guidance: check Markdown paths and links; validate skills when present; run code checks only when confirming documented commands or when requested.
- Project, site config, Astro route, or layout: run `npm run check`, `npm run build`, and targeted Playwright coverage.
- React island, interaction, accessibility, motion, or responsive layout: add or update Playwright coverage, then run `npm run check`, `npm run build`, and `npm test` across mobile and desktop.
- New inbox photography: run `npm run photos -- --dry-run`, `npm run photos`, `npm run photos:check`, build, and affected gallery/map tests.
- Photography replacement, removal, or processor change: run `npm run photos:rebuild`, `npm run photos:check`, build, and affected route tests. Do not run mutating photo commands when sources and processor logic are unchanged.
- Photography manifest or audit consumers: run `npm run photos:check` before type, build, or browser tests.
- Photography map math, schemas, tiers, controller, calibration, or providers: run format check, lint, unit tests, Astro check, build, and Playwright map/fallback coverage.
- Deployment or dependency changes: run the full sequence and inspect generated output boundaries.

## Run commands deliberately

Use the canonical order when the full suite is required:

```bash
npm run photos:check
npm run format:check
npm run lint
npm run test:unit
npm run check
npm run build
npm test
```

`npm run format` rewrites only its configured subset; do not use it during read-only validation. `npm test` runs Playwright and does not include Vitest. Build already includes the combined photography check and Astro diagnostics, but retain the explicit check when its output is useful.

## Interpret results

- Treat stale manifest or audit output as a source/generated-artifact mismatch; do not patch JSON by hand.
- Treat browser failures as behavior failures until logs, screenshots, and traces show an environment-only cause.
- Verify no horizontal overflow, visible focus, keyboard parity, reduced motion, useful static content, missing-key behavior, and non-WebGL fallbacks when relevant.
- If sandbox or environment restrictions block module resolution, rerun in an approved context before labeling the code broken.
- Do not fix unrelated failures unless the user expands scope.

## Report evidence

List every command run and its result, targeted routes or scenarios, skipped checks with reasons, generated files touched, and any remaining warnings or environment constraints. Never claim the site is fully validated when a required check did not run.
