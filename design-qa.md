# Gentle motion and cloud continuity — 2026-10-15

The two Home action buttons are removed. Camera journeys now use quintic ease-in/ease-out timing over 1.4–1.9 seconds, with quiet acceleration at both endpoints and preserved velocity when interrupted. About item emergence shares this easing; the opening curtain already uses ease-in/ease-out.

Two reproduced flicker causes are corrected. About reveals previously oscillated from progress 1 back to 0.928889, repeatedly reapplying clipping; completed reveals now hold their target. The five small local covers preload at low priority and begin decoding before interaction. The world renderer previously evicted an opaque, still-visible Home cloud at 2% of the Home-to-Travel journey. It now retains geometrically visible clouds, sorts by physical depth consistently, and keeps the current decoded texture set visible until responsive replacements commit. Adaptive quality changes no longer exchange the cloud composition. Transit-only Project veils reveal smoothly with distance instead of all appearing together.

Current verification:

- All 365 unit tests pass with two workers. Formatting and lint pass.
- The production build checks 153 files with zero diagnostics and emits 23 routes; generated photography and artifact/privacy checks pass.
- The final audit covers 984 samples across all twelve directions on both profiles. Desktop peaks at 44 draw calls and mobile at 31, within the unchanged 44/32 limits; Home/Projects peaks at 42/30. Artwork readiness and all 40/29 loaded layers remain stable throughout.
- Sixteen settled About frames per viewport hold progress 1, opacity 1, and no clipping. The reviewed desktop/mobile covers remain complete and stable.
- Intermediate Home/Travel and Home/Projects screenshots preserve continuous cloud coverage. Evidence is under `.private/refinement-validation/cloud-review/`; software rendering does not establish physical-device frame rates.
- All 28 focused browser scenarios pass across desktop and mobile, including all twelve full-speed journeys, interrupted navigation, Home/Travel continuity, settled About covers, context loss, static fallback, and resize budgets. The final inventory is `cloud-review/browser-acceptance.json`. This is accumulated verification across the main run and focused reruns; the mobile journey and resize helpers now wait on coherent browser state within their existing limits, with behavior and budget assertions retained.

The release uses a reviewed Git snapshot so local working files and the existing index remain intact. Its manifest excludes private files, credentials, original photography, logs, browser captures, and caches. Exact commit and deployment records are kept in `.private/motion-release/`. No photography source, generated gallery, or new raster artwork changed in this follow-up.

---

# Portfolio refinement — 2026-10-14

This pass preserves the ivory celestial world and distinct scene/detail destinations. It improves how visitors find the work, read project stories, browse photography, and make contact.

## Changes and visual review

1. **Home:** direct Projects and Travel actions, a résumé link, and a quiet location footer. Mobile actions have a translucent ivory surface after rendered review found the constellation reducing their contrast.
2. **About:** email, résumé, and profile links. At narrow widths, the email and résumé share the bottom row with the return link; selected-item captions keep their own space above it.
3. **Projects:** the constellation experience is retained. Case studies now have a section directory, a next-project destination, accurate illustration labels, and consistent sharing metadata.
4. **Travel:** public copy now describes the photographs instead of EXIF, camera poses, or testing machinery. Country directories include responsive photo previews; notes have a comfortable reading width. Published dates and counts were reconciled with the reviewed manifest.
5. **Shared pages:** consistent navigation, current-page underlines, contact access, mobile menu dismissal and focus handling, and a themed 404 with recovery links and noindex metadata.
6. **Motion:** scene journeys now take 0.9–1.3 seconds; incoming copy begins at 38% of the journey rather than 65%. Existing camera easing, interruption, reduced-motion behavior, and persistent world ownership remain.

The broad regression run also exposed a settled-scene reduced-motion bug: changing the preference called scene navigation again, rewound the globe, and moved keyboard focus. The controller now immediately settles only an active flight. Changing the preference in an already settled scene preserves both orientation and focus; the regression keeps its exact zero-rotation assertion and checks focus preservation.

Current production evidence is in `.private/refinement-validation/`: 1440×900, 390×844, and 320×700 captures of Home, About, Projects, Travel, a project, a country, a city, and the 404. `capture-results.json` records zero horizontal overflow and zero page errors across these 24 checks. The initial full-page city screenshots were rejected because off-screen lazy images had not decoded; the final city captures scroll through each image before capture. Mobile Home was recaptured after the contrast fix. Additional inspected desktop captures are in `.playwright-mcp/refinement-*.png`.

## Validation

- Node 24.16.0 was used for production validation. The final build checked 152 files with zero Astro errors, warnings, or hints.
- `npm run format:check` and `npm run lint` pass on the final source.
- `npm run test:unit`: 25 files, 351 tests passed, including all directed camera journeys, retargeting, and the revised duration bounds.
- `npm run build`: 23 routes; Astro diagnostics, generated photography, and artifact/privacy checks passed (149 photographs, 447 responsive images, 45 text output files).
- Static link audit: 4,196 internal references across the 23 routes, 579 unique targets, 36 distinct fragment destinations, and 17 JavaScript chunk imports resolve. The résumé PDF is present. External profile/service links were not included in this local audit.
- A separate public external-link check returned HTTP 200 for six destinations, including the live project and demonstration. LinkedIn returns an automated-access restriction (999), not a confirmed broken link. The Sightline case study now explicitly describes its original photography-atlas iteration; its live project has evolved separately.
- Mobile browser coverage is complete across the production runs: 96 passed and 4 expected skips. The first complete mobile batch had 88 passes, 4 skips, and 8 failures; all eight focused follow-ups pass on the final build. Those follow-ups cover the corrected reduced-motion reset, redirect document readiness, updated arrival/duration expectations, and the procedures interrupted by software-renderer timeouts. Original artifacts remain under `.private/refinement-validation/`.
- Desktop browser coverage is complete: 94 passed and 6 expected skips across the full batch and focused follow-ups. The full desktop batch had 90 passes, 6 skips, and 4 follow-ups; the final checks confirmed preserved About focus, artwork-before-canvas readiness, all twelve journeys, and correct resize budgets. The original resize test passed unchanged in isolation; direct measurements also confirmed all four widths, including a 4K viewport with 1,998,100 backing pixels within the two-million-pixel limit.
- Combined `npm test` coverage: **190 passed, 10 expected skips, zero unresolved scenarios**, across serial mobile/desktop batches and focused reruns. Four skips are optional capture-only cases; six are profile-specific cases covered on the applicable other profile. This is accumulated verification, not one uninterrupted green run. The scenario inventory and merged results are in `.private/refinement-validation/final-coverage-summary.json`. Browser behavior assertions and per-test limits were retained; intentional timing/focus contracts and readiness ordering were updated. Trace collection was disabled after a controlled comparison showed substantial instrumentation overhead. Purely diagnostic Travel screenshots now require `TRAVEL_CAPTURE=1`.
- `npm run photos:check` reproduces a pre-existing mismatch: 15 archival JPEGs are missing locally. All published responsive assets remain present and current; no photography outputs were regenerated. Deep EXIF checks and photography rebuilds were not needed because source photos and processing rules were unchanged.
- The existing bundle-size warning remains. Software-rendered browser checks do not establish hardware phone frame rates.
- Development startup was unreliable in this environment even under Node 24.16.0; the visual evidence uses the verified production preview. A missing Vite watch exclusion for the 40,144-file `.venv-photo-calibration` directory was restored. Dependency upgrades and generated photography changes were not needed for this pass.

Four public raster social images were generated from the existing SVG assets: the default card and three project cards. New checks cover sharing images, section/next-project navigation, mobile navigation state, homepage links and hit targets, static fallback, caption spacing, photo-card attributes, and 404 recovery. Existing user work was retained. This pass was not deployed.

---

# Nebula clarity, openings, and cloud lighting - 2026-09-15

The remaining haze came from clouds classified using authored depth: after the nebula's threefold depth transform, those clouds were actually in front of it. The resolver now fades those foreground planes in About using their final positions. The distant panorama and entry/exit approach clouds remain. A shared display-space grade deepens the nebula and its HTML crops without turning the highlights into a flat white area.

Category icons are textured outline openings with recessed edges and restrained spill beneath the foreground wisps. Expanded categories show “Current rotation,” “On the nightstand,” and “Away from the screen” below their icons. The labels hide on collapse, Escape, and departure. At 320px, an additional 14px of hobby-item clearance prevents the music label from touching the dice icon.

Irregular feathered ridge masks replace elliptical illumination. Each category retains an independent moving core and weaker spill, with the existing 180/300 ms hover and keyboard emphasis. Peripheral motion now curls locally instead of translating patches. The central eye and interactive crops are protected; reduced motion and WebGL fallback remain stationary and interactive.

## Current evidence

- Before/after captures: `.playwright-mcp/nebula-{before,after}-{1440,390,320}-{idle,hover,focus,songs,books,hobbies,all}.png`.
- Layer isolation: `.playwright-mcp/nebula-before-no-folds.png` and `.playwright-mcp/nebula-without-resolved-foreground.png`. Removing the HTML folds barely changed the wash; removing the misclassified WebGL foreground recovered cloud contrast.
- Motion samples: `.playwright-mcp/nebula-motion-idle-{0,1,2,3}.png` and `.playwright-mcp/nebula-motion-{songs,books,hobbies}.png`. Full-speed idle lighting and Home/About travel are recorded in `.playwright-mcp/nebula-motion/page@dd8e9fad1d93fb62e6382aff1c51dbd2.webm` (includes a stationary inspection interval).
- Both journey directions at 0/25/50/75/100 percent: `.playwright-mcp/nebula-flight-{home-about,about-home}-{0,1,2,3,4}.png`.
- Mobile journey samples: `.playwright-mcp/nebula-flight-390-{home-about,about-home}-{0,1,2,3,4}.png`.

The screenshots were inspected at 1440x900, 390x844, and 320x700. Category labels remain clear of the images; cloud texture and irregular boundaries remain visible. Production browser inspection reported no console errors. No dependencies, raster assets, or photography outputs changed, and no deployment was performed.

## Validation

- All 345 unit tests pass across 25 files.
- Formatting and lint pass. All 18 About/nebula browser cases pass across desktop and mobile, including the new label lifecycle and 320px clearance checks.
- Production build passes: 23 routes, zero Astro/TypeScript diagnostics, and the artifact boundary check passes across 45 text files.
- Full production-preview browser run: 166 passed, 8 intentional device/capture skips, and 4 failures across 178 cases (`.playwright-mcp/nebula-regression.json`). The documented Home intro decode-deadline check skips its opening on both device profiles; both twelve-direction journey tests also reached their 100-second per-test limit. Individual About flights, all category interactions, all fallback checks, history, and interruption cases pass.
- Both twelve-direction journeys pass in the focused follow-up (2/2, 3.4 minutes). This uses the existing `IVORY_CAPTURE=1` mode (180-second timeout), records video, and disables tracing without changing navigation assertions. Results are in `.playwright-mcp/nebula-journey-followup.json`; recordings and journey metrics are under `.playwright-mcp/nebula-journey-followup/`. The original full-run timeouts remain recorded; this is accumulated verification, not a clean repeat of the full suite.
- Source-aware photography integrity reproduces the existing archive-membership mismatch. Generated outputs are current: 149 images and 447 responsive WebPs.
- The existing large-chunk build warning remains. Node 24.13.1 was available; the repository requests 24.16.0 or later. Headless browser performance does not establish physical-phone frame rates.

---

# Natural centered nebula - 2026-09-13

Home's original nebula lighting is restored. About now centers the visible eye and uses a compact top-center introduction. Music, Books, and Hobbies belong to three existing folds: six feathered masks sample the same nebula pixels, with matched projection and restrained hover movement. The old rectangular bridge/puff images and colored pools are removed. Items emerge in curved arrangements; mobile captions sit quietly below the nebula.

Visual review at 1440x900, 390x844, and 320x700 shows a centered eye, no pasted rectangles, and all nine entries inside the viewport without overlapping the introduction or category labels. Evidence is under `.playwright-mcp/natural-nebula-about-{width}-{closed,open}.png`; Home is `.playwright-mcp/natural-nebula-home.png`. No raster assets, dependencies, project interactions, or photography outputs were changed.

## Validation

- Formatting, lint, and Astro/TypeScript checks pass; 337 unit tests pass across 24 files.
- Production build passes: 23 static routes; artifact boundary scan passes across 45 text files. The existing bundle-size warning remains.
- The broad browser run exercised 172 cases: 161 passed, 8 intentional device/capture skips, and 3 timing-related failures. The focused follow-up passed 4 cases, including both recorded twelve-direction journeys, with 1 device skip and 1 remaining headless desktop intro timing failure. Across runs, 165 distinct browser cases passed; all 14 About/nebula cases pass.
- The remaining headless check expects the initial curtain animation to start before its 1500 ms asset deadline; the application takes its existing nonblocking skip path. The equivalent external-scripts-blocked check passes in the interactive review browser: two 1600 ms animations, correct diagonal movement and opacity at 800 ms, completion, and tab-local seen state. No production timeout was changed.
- Source-aware photography integrity still reports archive membership differing from the 149-photo manifest. Generated output is current: 149 images and 447 responsive files. Photography sources and outputs were not changed.
- Headless tests use SwiftShader; numeric hardware frame-time gates are intentionally skipped. Physical-phone performance is unverified.

Reports: `.playwright-mcp/natural-nebula-regression.json` and `.playwright-mcp/natural-nebula-final.json`. The initial development run passed 13/14 targeted checks and exposed a sticky-touch caption issue; the production run confirms its correction.

## Visual and motion evidence

Individual Music, Books, and Hobbies states are saved as `.playwright-mcp/natural-nebula-about-{width}-{songs,books,hobbies}.png`, alongside the closed and fully expanded captures. Each state was reviewed at 1440x900, 390x844, and 320x700 without rectangles or text/item collisions.

`.playwright-mcp/natural-flight-grid-1440.png` and `natural-flight-grid-390.png` show Home to About (top row) and About to Home (bottom row), at 0/25/50/75/100 percent. The nebula remains visible and the cloud transition has no pasted panel edges. Full-speed all-direction recordings are in `.playwright-mcp/natural-nebula-final/ivory-universe-complete-ca-cecaf-cene-journeys-at-full-speed-{mobile,desktop}/video.webm`.

No deployment was performed. Node 24.13.1 was used; the repository guide requests Node 24.16.0 or later.

---

## Previous verification (historical)

# Continuous globe and cloud reveals - 2026-09-12

Implemented continuous 3-degree/second Home and Travel rotation, direct project links with individual hover/focus effects and nonmodal previews, and three independently expandable About clouds. Real music/book covers and four vector hobby icons emerge through the layered cloud artwork. The central nebula highlight and the biography wash are reduced. Mobile info controls use projected label bounds to avoid covering titles.

## Current checks

| Check                              | Result                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source-aware photography integrity | Pre-existing failure: archive membership differs from the 149-photo manifest. No archival sources or generated photography outputs were changed. |
| Generated photography integrity    | Passed: 149 images and 447 responsive files.                                                                                                     |
| Formatting and lint                | Passed.                                                                                                                                          |
| Unit tests                         | 334 passed across 23 files.                                                                                                                      |
| Astro / TypeScript                 | 0 errors, warnings, or hints across 141 files.                                                                                                   |
| Production build                   | Passed: 23 static routes. Build reports a chunk larger than 500 kB.                                                                              |
| Artifact boundary scan             | Passed across 45 text files.                                                                                                                     |
| Browser regression coverage        | 160 unique scenarios passed across full passes and focused reruns; 8 intentional device/capture skips.                                           |

The first mobile pass exercised all 84 configured scenarios: 71 passed, 4 were intentionally skipped, and 9 required correction or a focused rerun. After rebuilding the final fixes, the complete desktop pass produced 73 passes, 4 intentional skips, and 7 cases to revisit. The focused desktop/mobile rerun produced 23 passes and 3 skips; its remaining two test-instrumentation failures then passed their final rerun. This is accumulated coverage across runs, not a second clean 168-case invocation.

All earlier browser failures are resolved. Tests now follow direct project links, expect continuous country-label motion, use the new 40/29 artwork counts, and check hidden planes when a camera cannot project them. Focus precedence follows the latest input. Popup tests await document readiness; reveal inspection waits for the rendering frame after cold renderer compilation rather than timing out a host-side protocol call. The per-project effect assertion uses audit mode. Existing animation duration, geometry, privacy, and frame-budget assertions were retained.

The complete twelve-direction journeys passed on both profiles using the existing recording workflow and its 180-second test budget (mobile test: 154.6 seconds; desktop: 130.4 seconds, including browser automation and recording). Each flight retains the configured 1500-2500 ms duration and passes monotonic-progress checks. Draw-call limits passed. The headless regression browser uses SwiftShader, so its numeric hardware frame-time and long-task gates were intentionally skipped; physical-device performance remains unverified. These software-rendered timings must not be presented as hardware performance.

Reports: `.playwright-mcp/desktop-final.json`, `.playwright-mcp/final-interactions.json`, and `.playwright-mcp/final-two-checks.json`. Full-direction recordings are under `.playwright-mcp/final-interaction-results/ivory-universe-complete-ca-cecaf-cene-journeys-at-full-speed-{mobile,desktop}/video.webm`.

## Visual evidence

- `design-qa-about-fallback-390.png`: simulated WebGL failure retains native cloud hover/focus feedback, all three expanded groups, nine accessible items, and no horizontal overflow.

- `design-qa-clouds-1440.png`, `design-qa-clouds-390.png`, `design-qa-clouds-320.png`: all nine entries open, including a book caption. Captures show textured nebula folds, internal cloud light, retained cover aspect ratios, and no horizontal overflow.
- `design-qa-projects-320.png`: three separate 44px info targets; all clear every project label and remain inside the viewport.
- `design-qa-project-sightline.png`, `design-qa-project-sleep-wake-model.png`, `design-qa-project-robotic-card-thrower.png`: desktop project previews and individual constellation highlights.
- `.playwright-mcp/nebula-refresh-videos/page@8c82b4f290293e3bf340e73c47632789.webm`: full-speed Home/About/Projects/Travel interaction recording, including the return to Home. Representative frames were extracted for visual inspection.
- `.playwright-mcp/mobile-first-pass`: preserved first-pass failure traces for comparison with the final reruns.

The review browser reported hardware rendering and 41 draw calls on return to desktop Home (44-call limit). Mobile browser checks use viewport/device emulation; they do not establish physical-handset frame rates. Five new optimized cover assets total approximately 113 KiB; their sources are recorded in `docs/CELESTIAL-ASSETS.md` and the Almanac config. No cloud bitmap, photography output, runtime service, or dependency was added. No deployment was performed.

Environment: installed Node 24.13.1 is below the repository guide's Node 24.16.0 minimum; the checks above ran successfully on the installed version. The dependency installation was preserved.

---

## Previous verification (historical)

# Distant nebula and About orbs ? visual QA

Date: 2026-09-08. Implemented and verified locally; no commit or deployment. Previous QA is retained in `.private/nebula-qa/prior-design-qa.md`.

## Result

Home keeps the original nebula position and size while the shared resolver places it three times farther away. Three cloud veils and a steady champagne edge improve its presence. Hobbies, Music, and Books appear as distinct amber, lavender, and pearl/gold glimmers. Clicking any Home orb enters the About overview.

The two-second Home ? About journey crosses six staggered cloud layers (four on mobile), with near-camera fading and a clear approach lane. Arrival centers the nebula across nearly the full viewport and keeps the introduction readable in its center. Peripheral orbs open existing authored panels. Labels appear on desktop hover/focus and remain visible on touch devices. The scene retains native hashes, focus restoration, reduced motion, no-JavaScript content, and WebGL fallback.

The final cleanup resets transforms for clouds behind the camera so invisible artwork cannot retain obsolete geometry after a Travel round trip. Projects content, constellation controls, and detail routes retain their existing behavior.

## Verification

| Check                                                               | Result                                                                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm.cmd run format:check` and final changed-file formatting checks | Passed.                                                                                                                                          |
| `npm.cmd run lint` and final affected-file ESLint checks            | Passed.                                                                                                                                          |
| `npm.cmd run test:unit -- --reporter=dot`                           | 309 passed across 19 files on the final code.                                                                                                    |
| `npm.cmd run build`                                                 | Astro: 0 errors, warnings, or hints; 23 static pages; generated photography and artifact-boundary scans passed.                                  |
| Full desktop/mobile Playwright, with motion captures                | 146 scenarios exercised: 130 passed, 5 intentional device skips, 11 failures identified for correction.                                          |
| Final targeted production rerun                                     | 22/22 passed, covering every prior failure plus orb panels, first paint, direct About, and context-loss behavior. No unresolved failures remain. |
| `git diff --check`                                                  | Passed.                                                                                                                                          |

Ten initial browser failures came from old layer-count/projection expectations; those assertions now resolve the new geometry and distinguish loaded planes from visible, culled planes. The remaining failure exposed the hidden-transform cleanup above. Final coverage therefore includes 141 passing browser scenarios and five device-specific skips across the full run and focused rerun; this was not a second complete suite run.

Both device profiles passed all twelve directed journeys at full speed, interrupted navigation, Back/Forward, reduced motion, keyboard interaction, and static fallbacks. Existing performance thresholds were retained.

## Visual evidence

- `.private/nebula-qa/full-suite`: full-speed recordings and 120 quarter-progress captures across all twelve journeys on desktop/mobile; reviewed Home ? About and About ? Home framing, intermediate clouds, and settled scenes.
- `.private/nebula-qa/1440-*.png`, `390-*.png`, and `320-*.png`: composition, unique orb focus states, and the Music panel. The final flight density is represented by the full-suite captures.
- `.private/nebula-qa/targeted-results.json`: final 22-check production rerun.
- `.private/nebula-qa/full-results.json`: complete original run, including performance attachments and the superseded failures.
- `.private/nebula-qa/about-performance.json`: final Home ? About measurements without video recording overhead.

Home projection regression tests require equality with the original framing at 1440x900, 1659x948, 390x844, 320x700, and the 701px breakpoint. Arrival, orb reachability, serialized first-paint parity, and approach-only cloud visibility have dedicated unit coverage. Responsive captures show readable copy and visible interest cores without overflow.

## Home ? About performance

Chrome / ANGLE Direct3D11, NVIDIA GeForce RTX 4070 Laptop GPU. Warmed production output, 243 observed flight frames per profile, no video recording. Mobile is iPhone 13 emulation on the laptop GPU, not a physical phone measurement.

| Profile                   | p95 frame interval | Maximum draw calls | Draw-call limit | Maximum long task |
| ------------------------- | ------------------ | ------------------ | --------------- | ----------------- |
| Desktop, 1440x900         | 19.4 ms            | 42                 | 44              | 0 ms              |
| Mobile emulation, 390x844 | 22.4 ms            | 30                 | 32              | 0 ms              |

The environment loads 37 desktop / 26 mobile planes, culls offscreen artwork, and caps visible planes at 26 / 17. Three functional orbs are retained ahead of secondary decoration. The two-million / one-million pixel limits remain unchanged.

## Assets and limits

The nebula and cloud bitmap sources remain unchanged. Orb artwork is native SVG in `about-orbs.ts`; approach and veil layers reuse existing cloud textures. No generated photography or full-resolution media was changed. Build outputs, screenshots, and recordings remain ignored.

The existing large-client-chunk build warning remains. Source-photo checks and deep archive verification were skipped because photography sources and processing are unchanged; generated integrity passed for 149 images / 447 responsive files. Physical-phone performance remains unmeasured.

Production browser checks used `PLAYWRIGHT_USE_PREVIEW=1`, `PLAYWRIGHT_EXTERNAL_SERVER=1`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4334`, and `.private/nebula-qa/playwright.config.ts`. Full capture used `IVORY_CAPTURE=1`; the final targeted pass selected `about-nebula`, `universe-constellations`, `universe-refresh`, and `universe-runtime` cases. `node .private/nebula-qa/performance.mjs` records the final dedicated flight measurements.

## Projects update - 2026-09-09

The final star field is twice as distant as the first golden-field revision: six times its original authored depth, versus three times for the About nebula. Home-to-Projects travels approximately 174 world units on desktop and 142 on mobile within the existing duration cap. Nine cloud planes span the approach. Three retain their nearer Home positions so they pass faster; six additional planes appear only during the journey. The feathered sky mask follows the three constellations and removes the excess upper-left opening. Stars retain ivory cores, gold halos, varied four-point rays, and fine dust. Project layouts, previews, and URLs remain intact; mobile moves the upper label above its stars for clearance.

Production screenshots were inspected at 1440x900, 390x844, and 320x700. Both real-time journeys were recorded, and 0/25/50/75/100 percent forward/reverse frames inspected. Evidence is ignored under `.private/golden-projects-qa/`: `home-*.png`, `projects-*.png`, direction/progress PNGs, `journey-1440.webm`, `journey-390.webm`, and `summary.json`. Final captures used Chrome / ANGLE Direct3D11 / NVIDIA GeForce RTX 4070 Laptop GPU, device scale 1, with no page errors. Sampled draw calls peaked at 42 desktop / 30 mobile against the existing 44 / 32 limits. Loaded artwork is 46 / 35, with the existing 26 / 17 visible-plane caps. Mobile is browser emulation, not a physical-phone measurement.

Validation: 315 unit tests passed, including responsive projection, sixfold depth, and stars more than twice as deep as the nebula. Formatting and lint passed. The production build passed with zero Astro/TypeScript diagnostics; subsequent asset and audit-work optimizations were rebuilt and artifact boundaries checked. Generated photography integrity passed for 149 images / 447 responsive files. No photography outputs or sources changed; source/deep archive checks were skipped because that pipeline is unaffected. The existing large-client-chunk build warning remains.

The initial full desktop/mobile run exercised 150 scenarios: 136 passed, 9 intentional device/capture skips, and 5 failures. After the requested additional depth revision, 20 targeted scenarios covered all twelve scene directions on each device, interrupted flights, direct Projects startup, both Projects flights, responsive fallbacks, and rendering budgets. Outdated focus-colour and nebula-visibility assertions were updated to the new gold sky; opacity comparisons now tolerate insignificant floating-point interpolation differences. Final focused checks verified those corrections and exact audit seeking. All affected functional scenarios passed across the final runs.

Timing remains a qualified result. Mobile passed its 34 ms p95 automated limit. The combined desktop timing test most recently measured 28.6 ms against a 25 ms gate (see `verification.log` and `results.json`); it is not reported as passing. Hidden SVG and cloud DOM projection is now skipped during live GPU flights, while explicit audit seeks and fallback views still synchronize. A separate warmed desktop measurement without test-runner instrumentation passed the same 25 ms threshold for each journey: Projects 20.2 ms p95, Travel 20.1 ms, Home 19.4 ms, with 142?145 measured frames per journey and 16.7 ms median intervals. See `per-stage-performance.json` and `performance.mjs`. No blanket 60 fps or physical-device claim is made.

Commands: `npm.cmd run test:unit`, `npm.cmd run format:check`, `npm.cmd run lint`, `npm.cmd run build`, final affected-file ESLint/format checks, `npm.cmd run check:artifacts`, and `git diff --check`. Browser tests used `PLAYWRIGHT_USE_PREVIEW=1`, `PLAYWRIGHT_EXTERNAL_SERVER=1`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4334`, and `.private/golden-projects-qa/playwright.config.ts`. Complete logs and JSON reports are kept in that ignored QA directory. The full 150-scenario suite was not repeated after the final depth revision; affected scene, fallback, projection, and timing cases were rerun instead.

## Home layering cleanup - 2026-09-09

Decorative planets and asteroids are now smaller, lower contrast, and scattered across cloud depths, with a separate two-body portrait arrangement. All remain decorative and outside the native destination hit regions. The marble planet is smaller and tucked behind the lower cloud bank. Transparent body materials no longer write opaque depth, and adaptive quality attenuates small bodies gradually instead of switching them at a threshold.

The marble planet and the two foreground banks are retained in the rendering budget. During Home/Travel transitions, the near clouds translate outward at their authored depth and leave the frustum with their opacity intact. This replaces the previous reduction to roughly six percent opacity. The same Travel-weighted resolver positions initial HTML, WebGL artwork, context-loss fallbacks, and audit frames. No new bitmap assets or photography outputs were introduced.

Validation: 320 unit tests passed, including 101 camera samples at each of three viewports, stable planet retention, full-opacity foreground exits, transparent depth behavior, and adaptive fade continuity. `npm.cmd run format:check`, `npm.cmd run lint`, and `npm.cmd run build` passed; Astro reported zero errors, warnings, or hints, and generated-photo and artifact-boundary checks passed. The existing large-client-chunk build warning remains.

Final production browser checks: **24/24 passed** across desktop and mobile. The selected mobile/desktop scenarios cover all twelve directed journeys, interrupted flights, decorative hit testing, the Earth round trip, direct Travel first paint, refresh and return alignment, reduced motion, and WebGL failure/context loss. The full unrelated gallery/content suite and standalone FPS benchmarks were not rerun for this iteration; previous timing qualifications above remain applicable. Physical-phone verification is still unavailable.

Evidence: `.private/home-layer-qa/` contains before/after Earth-transition frames and placement samples, final Home/Travel screenshots at 390x844 and 320x700, the browser log, and JSON results. The recorded Earth journeys and endpoint captures are copied into the same QA directory with `earth-journey-mobile` and `earth-journey-desktop` prefixes. Screenshots were inspected on Chrome / ANGLE Direct3D11 / NVIDIA GeForce RTX 4070 Laptop GPU; mobile uses browser emulation. All evidence stays ignored.

## About cloud lighting - 2026-09-14

About now removes unrelated foreground cloud haze at arrival while preserving background opacity and transition layers. The three category controls use luminous musical-note, book, and compass outlines. Asymmetric masks reveal moving, source-aligned cloud light beneath foreground folds; hover and keyboard focus double light energy with 180/300 ms emphasis. Outer nebula wisps move in staggered 18–30 second cycles, bounded to 0.004 UV and excluded from the eye and interactive crops. Reduced motion and WebGL fallback use stationary lighting. No bitmap, photography output, dependency, route, or public content schema changed.

Development screenshots were inspected at 1440x900, 390x844, and 320x700: idle, hover, keyboard focus, and fully expanded controls retain cloud texture, readable icons, item clearance, and no horizontal overflow. Browser console capture contained zero warnings or errors. Evidence is ignored under `.playwright-mcp/nebula-*.png`; final production captures and browser reports belong to `.private/nebula-light-qa/`.

Validation: `npm.cmd run format:check`, `npm.cmd run lint`, and `npm.cmd run check` passed (145 files, zero diagnostics). The final `npm.cmd run test:unit` passed 343 tests, including rasterized-mask coverage proving that each moving light core and spill stays inside its visible fold. The final `npm.cmd run build` passed: 23 static pages, current generated photography (149 images / 447 responsive files), and the artifact/privacy boundary scan. The existing large-client-chunk warning remains. This environment ran Node 24.13.1, below the repository's declared 24.16 minimum; the listed checks completed successfully on that installed runtime.

`npm.cmd run photos:check` failed on the existing source-archive membership mismatch, while its generated-output check passed. No source/rebuild commands were run. Deep archive verification and physical-phone performance measurements were not run because this change does not alter photography processing and no physical-phone session is available.

The full production browser run completed **164 passed / 8 intentional skips / 4 failed**. Both new light tests assumed focus would remain on their icon after changing reduced-motion preferences; the existing scene coordinator instead focuses the heading. The test now uses keyboard input to refocus the icon. A desktop no-JavaScript project hit-test and a mobile long-task timing gate also failed. The six-case focused rerun completed **5 passed / 1 timing failure**: both corrected light tests and both no-JavaScript project tests passed, as did mobile timing. All functional cases passed across these runs, including all twelve directed scene journeys on both profiles. After the final light-path refinement, **16/16 About browser cases passed** on the rebuilt production output. The full unrelated suite was not repeated after that refinement.

Timing remains qualified. Chrome used ANGLE Direct3D11 on the NVIDIA RTX 4070 Laptop GPU; mobile is emulation, not a physical phone. Full-run desktop p95 was 23.5 ms with a 62 ms maximum long task; the focused rerun measured 25.5 ms against the 25 ms p95 gate, with a 55 ms maximum long task. Full-run mobile p95 was 26.7 ms with one 207 ms long task; its rerun passed at 22.3 ms p95 and 73 ms maximum long task. Draw calls remained at 42 desktop / 30 mobile against 44 / 32 limits. No blanket frame-rate acceptance is claimed.

Browser commands used `PLAYWRIGHT_USE_PREVIEW=1` and `npm.cmd test -- --config .private/nebula-light-qa/playwright.config.ts`; the focused rerun added `--grep "cloud light remains|warmed flights|without JavaScript the project listing"`. The ignored configuration selects installed Chrome with ANGLE D3D11 and one worker while preserving the repository's desktop/mobile projects and assertions. JSON results are `.private/nebula-light-qa/full-results.json` and `rerun-results.json`; logs are `.playwright-mcp/nebula-final-suite.log` and `nebula-rerun.log`. The initial bundled-browser run was stopped after four passing About checks to rebuild the corrected background-opacity rule. Final affected-file formatting/ESLint and `git diff --check` also passed.

The final affected run selected `tests/about-nebula.spec.ts` against the verified preview on port 4334 using `PLAYWRIGHT_EXTERNAL_SERVER=1` and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4334`; see `.playwright-mcp/nebula-about-final.log` and `.private/nebula-light-qa/results.json`. Production captures are generated by `node .private/nebula-light-qa/capture.mjs`: idle/hover/focus/expanded PNGs, full-speed journey recordings, and 0/25/50/75/100 percent views of both Home/About directions at all three viewport sizes. They remain ignored under `.private/nebula-light-qa/captures/`. No deployment was performed.

Final production states and forward/reverse transition samples were visually inspected. Captured Home/About round trips recorded 213 desktop, 192 mobile, and 181 narrow frames, with zero page errors and maximum draw calls of 42/30/30. The recordings are visual evidence, not isolated performance measurements. The temporary preview was stopped after verification.

## Sculpted About clouds - 2026-09-15

Rebuilt About around large cloud-sculpted music, book, and compass symbols. Each category expands independently. Covers rise through separate gaps with a foreground cloud layer and a reversible reveal mask; the symbols and labels now travel at the nebula's projected scale. Hover and keyboard focus illuminate source-derived cloud highlights with a cream-gold rim. Phone layouts reserve three rows and a caption strip; the 320px layout keeps category names while hiding secondary subtitles. All authored entries and the semantic no-JavaScript content remain unchanged.

The built-in image generator produced three transparent originals, retained in ignored `.private/about-clouds/originals/`. The exporter writes 24 registered 320px/640px WebPs in `public/media/site/about-clouds/` (approximately 1.13 MiB for both resolutions combined). Prompts and regeneration instructions are in [About clouds](docs/ABOUT-CLOUDS.md). No photography sources, generated gallery files, content records, or runtime secrets were changed.

Final static validation: `npm.cmd run format:check` and `npm.cmd run lint` passed; `npm.cmd run test:unit` passed **350/350**. `npm.cmd run check` and the final `npm.cmd run build` reported zero Astro/TypeScript diagnostics across 147 files. The build produced 23 pages, validated 149 photos / 447 responsive files, and passed the artifact/privacy scan across 45 text files. The existing >500 kB client-chunk warning remains. Node was 24.13.1, below the repository's declared 24.16 minimum.

`npm.cmd run photos:check` reproduced the pre-existing source archive membership mismatch; its generated-output check passed. No photo rebuild was attempted. Deep archive verification and physical-phone testing were not run because photography processing is unchanged and no physical-phone session is available. No deployment was performed.

Browser verification used the production preview on port 4322, `PLAYWRIGHT_EXTERNAL_SERVER=1`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4322`, and `.private/about-clouds-qa/playwright.config.ts` (installed Chrome, ANGLE D3D11, one worker; original assertions and device profiles retained). The initial mobile suite completed **86 passed / 4 intentional skips**. After the final camera-scale and stationary-fallback changes, the affected mobile About, refresh, and scene-journey files completed **23 passed / 1 intentional capture skip**, including all twelve directed journeys. The final full desktop suite completed **86 passed / 4 intentional skips**, with zero unexpected or flaky results. Across the full device passes, 172 scenarios passed and 8 were intentionally skipped; affected mobile scenarios were additionally rerun on the final build. The warm frame-time and draw-call gates passed on both profiles. Desktop JSON results are `.private/about-clouds-qa/results.json`; no assertions or thresholds were weakened.

The earlier bundled-browser About run passed **20/20**, including intermediate 96/256/384 ms reveal captures, before the final camera-scale/fallback refinements. Its responsive PNGs and inspection JPEGs are `.playwright-mcp/sculpted-*`; these are visual evidence, not physical-device performance measurements. Command logs are `.playwright-mcp/about-*.log`; final mobile JSON results are `.private/about-clouds-qa/mobile-final-results.json`.

Final production captures from `node .private/about-clouds-qa/capture.mjs` were inspected at 1440x900, 390x844, and 320x700: idle, hover, keyboard focus, all categories expanded, and 0/25/50/75/100 percent in both Home/About directions. The cream-gold backlight is visibly stronger while foreground shadows remain; cover bases are occluded by cloud folds. The nine items and category labels remain clear at 320px. Contact sheets and full-speed videos are in ignored `.private/about-clouds-qa/captures/`. Captured round trips recorded 204 / 222 / 237 flight frames, no page errors, and maxima of 42 / 30 / 30 WebGL draw calls. Chrome reported ANGLE Direct3D11 on the NVIDIA RTX 4070 Laptop GPU; phone sizes are emulation, not physical-phone evidence. The recordings are visual checks, not isolated performance measurements.

The verified local production preview remains available at `http://127.0.0.1:4322/#about`. Final formatting and diff-whitespace checks passed after this report was updated. Existing unrelated working-tree changes were preserved.

## About nebula cloud refresh - 2026-09-25

Music, Books, and Hobbies now use new cloud artwork generated with the background nebula as a visual reference. The note, open-book, and compass forms have billowing peach/ivory/lavender folds and transparent wisps. Six responsive WebPs in `public/media/site/about-nebula/` total 431,456 bytes; full-resolution originals remain ignored. Prompts and export instructions are in `docs/ABOUT-CLOUDS.md`. Previous artwork is retained but no longer requested.

Hover/focus brighten the source texture by up to 12 percent with a small saturation lift. Separate overlay/backlight graphics were removed. Two registered image layers retain foreground occlusion. Shared-clock drift adds independent slow movement, roll, and breathing while labels and hit areas remain still. Reduced motion and context loss freeze the drift.

Final-artwork validation:

- `npm.cmd run lint`: passed.
- `npm.cmd run test:unit`: 351 passed in 25 files, including alpha/resolution, drift bounds, and stationary fallback.
- `npm.cmd run check` passed on the earlier iteration; final `npm.cmd run build` repeated diagnostics (148 files, zero diagnostics), built 23 static routes, and passed generated-photography and artifact/privacy checks. The existing large-client-chunk warning remains.
- `npm.cmd run format:check`: fails on existing table formatting in `docs/TESTING.md`. Replacing this task's changed sentence with its original text still fails Prettier. Targeted formatting checks pass for changed code, tests, export script, and About documentation. `git diff --check` passed.
- `npm.cmd run photos:check`: generated outputs are current (149 images / 447 responsive files), but local archive membership differs from the manifest. Photography files were not changed.
- `PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4335 ABOUT_CLOUD_CAPTURE=1 npm.cmd test -- tests/about-nebula.spec.ts tests/ivory-universe.spec.ts`: 36 passed in 6.7 minutes; two opt-in quarter-progress capture tests skipped. Both desktop and mobile passed About controls, hover/focus, idle/reduced motion, 320/390/1440px layouts, all twelve directed journeys, interruptions/history, missing artwork, WebGL failure, and no-JavaScript navigation. Earlier interrupted runs were superseded.

Production preview: `http://127.0.0.1:4335/#about`. Final production evidence: `.playwright-mcp/about-final-idle.png`, `.playwright-mcp/about-final-hover.png`, and responsive `.playwright-mcp/sculpted-*` captures. Closed and fully expanded 320/390/1440px views were inspected; all nine items and labels remain readable. Browser emulation does not establish physical-phone or hardware frame-rate performance. The unrelated gallery/detail-page browser suite was not rerun for this focused About change.
