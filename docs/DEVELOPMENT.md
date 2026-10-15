# Development

Use Node 24.16.0 or a later Node 24 release, as required by `package.json`; `.node-version` pins the development baseline. Confirm the selected executable before installing dependencies.

```bash
node --version
npm ci
npm run dev
```

`npm ci` installs the lockfile without changing dependency versions. Use `npm install` when intentionally updating dependencies, and review both package files. No environment variables are required. Local `.env` files remain ignored and must not enter the build graph.

## Development server

`npm run dev` launches Astro in the foreground and forwards command-line options:

```bash
npm run dev -- --host 127.0.0.1 --port 4334
```

The launcher removes Astro's automatic Codex detachment flag so the invoking process owns the server and can observe a slow cold start. A process start alone does not prove readiness: verify the URL responds, the page renders, and the browser has no error overlay. Use one manual development server and reserve port 4333 for the browser-test launcher.

If development startup stalls, inspect its logs and process state. A successful production build can be inspected with `npm run preview -- --host 127.0.0.1 --port 4334`; report which server served the evidence rather than treating preview as proof that development startup is fixed.

## Clean restart

Before a broad restructure, identify this checkout's development/preview servers, test runners, and owned browser children by command line and process ancestry. Stop only those processes, preserving unrelated applications.

Snapshot modified and untracked work into ignored, timestamped private storage before clearing regenerable output. A clean restart may remove `dist`, `.astro`, Vite caches, `test-results`, and `playwright-report`, then run `npm ci`. Resolve and verify deletion targets inside this checkout before cleanup. Preserve authored content, original photographs, generated photography, private records, design assets, and the backup itself.

The 2026-09-06 redesign started with a 55-path snapshot in `.private/redesign-backups/20260906-001257` and a lockfile install under portable Node 24.16.0, checked against the official release checksum. This is local recovery evidence, not a runtime dependency or a file to publish.

## Common commands

| Command                          | Purpose                                      |
| -------------------------------- | -------------------------------------------- |
| `npm run dev`                    | Start Astro locally                          |
| `npm run photos -- --dry-run`    | Preflight inbox JPEGs                        |
| `npm run photos`                 | Publish gallery media incrementally          |
| `npm run photos:rebuild`         | Rebuild responsive media and gallery indexes |
| `npm run photos:check`           | Source-aware gallery integrity check         |
| `npm run photos:check:generated` | CI-safe generated-state check                |
| `npm run check`                  | Astro and strict TypeScript diagnostics      |
| `npm run build`                  | Production build plus artifact scan          |
| `npm test`                       | Mobile and desktop Playwright coverage       |

Vite ignores archival sources, generated photography media, `.private`, `.vercel`, and the retained local model environment so those large trees do not affect development startup. They are not runtime dependencies.

For media work, follow [Photography](PHOTOGRAPHY.md). For validation selection and capture commands, follow [Testing](TESTING.md).
