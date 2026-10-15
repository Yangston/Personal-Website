# Architecture

The portfolio is a static Astro 7 site deployed on Vercel. Astro owns routes, metadata, content loading, and durable markup. React is reserved for interactions that need client state. The universe, navigation coordinator, and travel atlas use plain TypeScript with useful HTML fallbacks.

## Route ownership

| Route                           | Server-rendered responsibility                     | Optional enhancement                    |
| ------------------------------- | -------------------------------------------------- | --------------------------------------- |
| `/`                             | Home, About, Projects, and Travel in reading order | Fixed universe with hash navigation     |
| `/projects`                     | Redirect to `/#projects`                           | None                                    |
| `/projects/[slug]`              | Project case study                                 | Registered demos; quiet shared world    |
| `/photography`                  | Redirect to `/#travel`                             | None                                    |
| `/photography/[country]`        | Country silhouette, samples, and city links        | Selected-city focus; quiet shared world |
| `/photography/[country]/[city]` | City introduction and complete photo grid          | Accessible lightbox; quiet shared world |

Public detail URLs and content schemas remain unchanged. Sightline may appear as authored portfolio content, but its application, provider integration, scene endpoints, camera geometry, and reconstruction data belong to its separate repository.

## One composition and persistent world

`src/lib/portfolio-universe/scene-manifest.ts` is the typed source for camera framing, celestial anchors, artwork planes, and separate desktop/mobile destination-label anchors. Its pure projection function is serialized into the initial markup and consumed by the runtime. The requested hash and viewport determine the initial composition before the asynchronous renderer loads. The opening cloud veil reveals this resting composition without an introductory camera flight or layout replacement.

`UniverseWorld.astro` is mounted by `BaseLayout.astro` and retained through Astro client navigation with `transition:persist`. It owns the first-paint DOM artwork, static Earth fallback, opening veil, and one WebGL canvas. The manifest defines 18 textured plates on desktop and a structural set of 10 on mobile, distributed across at least six depth bands. The nebula, marble planet, cloud banks, wisps, and small moons share asset sources and projection inputs between the DOM fallback and GPU scene.

`world.ts` owns the single runtime instance, reconnects page content to it, updates fallback projections from renderer frames, and suspends it for quiet detail pages. The Three.js renderer owns the camera, textured artwork planes, one live Earth, spatial star/constellation geometry, resource lifecycle, and frame scheduler. GPU artwork replaces the visible DOM artwork only after its replacement frame has rendered; the fallback elements remain available. The Earth fallback and live Earth are also mutually exclusive. Context loss restores fallback rendering and navigation.

`artwork-motion.ts` samples bounded drift from the shared elapsed-effect time for both artwork paths. Transparent GPU planes test depth without writing it and are ordered by camera depth, allowing foreground clouds to pass in front of the Earth. Repeated sources use the same texture cache; stale resize/load completions cannot install an obsolete plate selection. Reduced motion freezes ambient effects at their authored pose.

The scheduler samples fractional deadlines to target 60 fps during navigation and 30 fps at rest on different display refresh rates. Backing buffers are capped at two million desktop or one million mobile pixels. Two sufficiently sampled slow flights reduce decorative particles and rendering resolution at rest, down to a 0.7 scale; semantic constellation geometry, camera framing, and DOM artwork remain intact. Hidden-page gaps do not count toward quality decisions. These budgets require measured hardware verification.

Detail routes use `cosmicScene="universe"`, `worldMode="quiet"`, and a `returnScene` of `projects` or `travel`. A quiet page retains the shared environment under an ivory reading wash, permits ordinary document scrolling, and suspends an already-loaded runtime. A direct detail visit renders the static environment without downloading the WebGL renderer. Returning to a hash destination reconnects the scene coordinator and resumes the world.

## Opening reveal and Earth imagery

`cloud-reveal.ts` runs a 1600 ms cloud reveal independently of WebGL readiness. It first decodes its two bank images, with a 1500 ms limit that releases the veil if either image is slow or unavailable. Only a started or dismissed opening consumes the session guard. The banks move toward the top right and bottom left once per tab on an initial Home visit, with session-storage and in-memory guards. Direct non-Home hashes, quiet detail pages, same-document returns, and reduced motion skip it. Pointer or keyboard input, hash changes, navigation, and a reduced-motion preference change dismiss it immediately; the veil never intercepts navigation. Without JavaScript it stays absent.

`earth-material.ts` uses separate NASA day-surface, night-light, and cloud textures for a warm, detailed Earth and a slowly moving cloud shell. Those visual maps remain separate from the generated geographic mask used for ocean, visited-country, and active-country styling. Texture-space longitude correction preserves alignment with the atlas bridge's picking and markers. A missing visual texture falls back to the geographic material or omits the affected decorative layer. Source credits and processing notes belong with the public celestial asset set; photographic archive media is unchanged.

## Navigation and content

`controller.ts` is the navigation coordinator. It owns hash/history synchronization, destination state, heading focus, asset readiness, atlas activation, panel dismissal, and cancellation. All twelve directed journeys between Home, About, Projects, and Travel travel directly between their camera poses. Normal journeys take roughly 1.5–2.5 seconds and settle at rest; retargeting samples the current pose and motion so the latest destination wins. Camera movement, projected artwork, Earth rotation, and content fades use the same runtime clock.

Successful enhancement makes the index a fixed `100svh` viewport. Only the active scene is interactive; other scene sections are `inert` and `aria-hidden`. Reduced motion settles navigation immediately. Without JavaScript, all four sections remain in reading order with native project, country, and city links. A failed controller must leave that document usable.

`ScenePanel.astro` and the panel controller own country previews. Project links navigate directly; `project-previews.ts` provides hover/focus previews and an independent touch info control. The Projects camera reserves the right quarter of the scene without changing world vertices. About interests use independent, layered cloud reveals in `AboutClouds.astro`, with authored covers and icon identities from `src/config/almanac.ts`. Their emergence shares the runtime clock, while reduced-motion and unavailable-WebGL paths reveal immediately. Static entries remain readable without JavaScript.

The atlas is dynamically loaded as Travel approaches. It consumes the renderer-agnostic Earth bridge for projection, rotation, picking, and geographic focus. Country activation opens a compact preview through a callback while ordinary country/city links remain available. Its transparent canvas handles pointer input and becomes the visual globe fallback without WebGL. Atlas subscriptions and pointer work pause outside Travel.

## Rendering budget and diagnostics

The renderer caches layout bounds and resources, caps its backing surface to approximately two million pixels on desktop and one million on mobile, and uses a 30 fps ambient cadence with a 60 fps target during flights or interaction. Draw-call acceptance budgets are 32 on desktop and 24 on mobile; compare actual diagnostics against them. Hidden pages and quiet detail pages suspend rendering. These are scheduling, resolution, and draw-call budgets, not measured hardware performance guarantees.

Texture/output color spaces are explicit. Locally generated cloud, nebula, and marble-planet artwork is served from `public/media/site/celestial`, with smaller mobile variants; the Earth uses locally processed NASA maps. There is no runtime image-generation service, paid app, backend, or provider credential. Bodoni Moda is exposed through `--font-universe-display` for the four main scenes, their navigation, and previews; existing detail-page display typography retains its own token.

The world exposes diagnostics for readiness, renderer ownership, quality, camera/flight state, Earth projection, and lifecycle. `?universeAudit=1` exposes deterministic seeking, frame logs, snapshots, and context-loss simulation for browser tests. These diagnostics are a testing contract, not a public navigation API.

## Photography and build boundaries

Hand-authored geography and publication policy live in `src/config`. Generated gallery state lives in `src/data/photography-manifest.json`, `photography-audit.json`, and `photography-integrity.json`; responsive assets live under `public/media/photography`.

Canonical JPEGs remain archival inputs. Rich metadata stays in `.private`; public data contains reviewed alt text, date-only values, archive membership, dimensions, and responsive URLs. Neither the redesign nor the shared world changes this pipeline.

The build checks generated gallery freshness, runs Astro diagnostics, creates static output, and scans artifacts for private paths and removed Sightline runtime signatures. No server runtime or secret-dependent rendering is introduced.
