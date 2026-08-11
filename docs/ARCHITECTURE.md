# Architecture

The portfolio is a static Astro 7 site deployed on Vercel. Astro owns routes, metadata, content loading, and durable markup. React is reserved for interaction that needs client state; the travel atlas uses a small canvas controller and retains ordinary links without JavaScript.

## Route ownership

| Route                           | Server-rendered responsibility            | Optional enhancement      |
| ------------------------------- | ----------------------------------------- | ------------------------- |
| `/`                             | Portfolio introduction                    | Coordinated motion        |
| `/projects`                     | Published project index                   | Constellation interaction |
| `/projects/[slug]`              | Project case study                        | Registered demos          |
| `/photography`                  | Country links and atlas copy              | Canvas globe              |
| `/photography/[country]`        | Country silhouette, samples, city links   | Transition polish         |
| `/photography/[country]/[city]` | City introduction and complete photo grid | Accessible lightbox       |

There are no portfolio scene endpoints, camera-pose routes, map providers, or reconstruction clients.

## Photography data

Hand-authored geography and publication policy live in `src/config`. Generated gallery state lives in `src/data/photography-manifest.json`, `photography-audit.json`, and `photography-integrity.json`, with responsive output under `public/media/photography`.

Canonical JPEGs are archival inputs. Rich metadata stays in `.private`; the public graph includes reviewed alt text, date-only values, archive membership, dimensions, and responsive asset URLs.

## Build boundary

The build checks generated gallery freshness, runs Astro diagnostics, creates static output, and scans artifacts for private paths and removed Sightline signatures. No server runtime or secret-dependent rendering is introduced.
