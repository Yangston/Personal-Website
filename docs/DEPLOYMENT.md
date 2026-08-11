# Deployment

The portfolio builds as static Astro output for Vercel.

```bash
npm run build
```

The command verifies committed gallery state, runs Astro diagnostics, emits `dist`, and scans text artifacts for private paths, local filesystem references, exact timestamps, and removed Sightline runtime signatures.

No runtime environment variables are required. The portfolio does not ship third-party map-provider credentials or assets.

Do not commit or deploy:

- original photography sources;
- `.private` metadata or evidence;
- `.env` files or credentials;
- model environments or caches;
- `dist`, `.astro`, Playwright output, or logs.

After deployment, smoke-test `/`, `/projects`, `/photography`, one country, and one city on mobile and desktop. Confirm navigation, gallery images, lightbox focus behavior, and the absence of provider requests.
