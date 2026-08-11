# Testing

## Validation matrix

| Change                   | Required checks                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Documentation only       | `npm run format:check`                                                                         |
| Astro/TypeScript/content | format check, lint, `npm run check`, `npm run build`                                           |
| Gallery publisher        | above plus `npm run test:unit`, `npm run photos:check`, deep check when processor rules change |
| Route/layout/interaction | above plus `npm test`                                                                          |

`npm test` runs Playwright on mobile and desktop. It covers public routes, keyboard navigation, reduced motion, no-JavaScript photography content, complete one-time gallery membership, lightbox focus restoration, 320px overflow, and 404s for removed Sightline routes.

`npm run test:unit` runs deterministic atlas geometry and gallery publishing tests. Add unit coverage for parsing, hashing, transactions, and source classification; browser behavior belongs in Playwright.

For production-output browser validation, set `PLAYWRIGHT_USE_PREVIEW=1` before `npm test`.

Do not use rewriting commands during a read-only validation pass. Report pre-existing failures separately from failures introduced by the current change.
