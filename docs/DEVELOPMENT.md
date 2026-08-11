# Development

Use Node 24 and the locked npm dependencies.

```bash
npm install
npm run dev
```

No environment variables are required. Local `.env` files remain ignored and must not enter the build graph.

## Common commands

| Command                          | Purpose                                          |
| -------------------------------- | ------------------------------------------------ |
| `npm run dev`                    | Start Astro locally                              |
| `npm run photos -- --dry-run`    | Preflight inbox JPEGs                            |
| `npm run photos`                 | Publish gallery media incrementally              |
| `npm run photos:rebuild`         | Rebuild all responsive media and gallery indexes |
| `npm run photos:check`           | Source-aware gallery integrity check             |
| `npm run photos:check:generated` | CI-safe generated-state check                    |
| `npm run check`                  | Astro and strict TypeScript diagnostics          |
| `npm run build`                  | Production build plus artifact scan              |
| `npm test`                       | Mobile and desktop Playwright coverage           |

Vite ignores archival sources, generated photography media, `.private`, `.vercel`, and the retained local model environment so those large trees do not affect development startup. They are not runtime dependencies.

For media work, follow [Photography](PHOTOGRAPHY.md). For validation selection, follow [Testing](TESTING.md).
