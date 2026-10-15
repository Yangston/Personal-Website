# Testing

## Validation matrix

| Change                   | Required checks                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Documentation only       | `npm run format:check`                                                                      |
| Astro/TypeScript/content | Format check, lint, `npm run check`, `npm run build`                                        |
| Gallery publisher        | Above plus unit tests, source-aware photo check, and deep check when processor rules change |
| Route/layout/interaction | Above plus mobile and desktop Playwright coverage                                           |

For the universe redesign, run the complete required sequence:

```bash
npm run photos:check
npm run format:check
npm run lint
npm run test:unit
npm run check
npm run build
npm test
```

The build includes the source-independent generated-photography check and production artifact/privacy scan. `npm test` runs Playwright, not Vitest. Do not run rewriting formatters, photography rebuilds, or snapshot updates during read-only validation.

## Browser coverage

| Test file                              | Contract                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/ivory-universe.spec.ts`         | All twelve directed journeys, interruption, history, persistent world, and visual acceptance captures                                           |
| `tests/celestial-interactions.spec.ts` | Native silhouette links, touch/modifier/focus behavior, unique decorative bodies, localized glow, shooting stars, and active-effect performance |
| `tests/celestial-reveal.spec.ts`       | Diagonal Home reveal, once-per-tab behavior, direct-hash/reduced-motion skips, input dismissal, and startup independence                        |
| `tests/universe-refresh.spec.ts`       | Initial markup versus renderer readiness, refresh, direct hashes, and no-JavaScript startup                                                     |
| `tests/scene-panels.spec.ts`           | Direct project links, hover/focus previews, touch info controls, dismissal, and native fallbacks                                                |
| `tests/detail-pages.spec.ts`           | Ivory details, overflow, client-navigation lightbox revisits, persistent backdrop, and no-JavaScript image links                                |
| `tests/universe-runtime.spec.ts`       | Current runtime/atlas diagnostics, ownership, fallback, rendering budget, and lifecycle                                                         |
| `tests/portfolio.spec.ts`              | Existing route/content, photography completeness, keyboard, and privacy regressions                                                             |

The current celestial composition retains the ivory journey capture flow. Do not restore obsolete Home layout swaps, sequential title typing, or directional timing merely to satisfy an old selector or assertion. The opening cloud veil is a decorative entrance over the final Home pose, not an initial camera flight.

Each directed journey must keep one world and one live Earth, settle on the latest requested destination, and focus the correct heading. Check direct hashes, Back/Forward, rapid reselection, loading delays, missing artwork, failed WebGL, no JavaScript, and reduced motion. The fixed universe must stay at `scrollY = 0`; inactive sections are inert. Detail pages must scroll and restore the originating scene on return. Visiting a gallery through client navigation must retain lightbox controls and focus restoration.

For the reveal, use a fresh tab to verify both cloud banks depart toward the top right and bottom left over 1600 ms. Confirm reloads and scene/detail returns do not replay it, direct non-Home hashes and reduced motion skip it, and pointer or keyboard input dismisses it without losing the intended action. Delay or block WebGL startup to prove the HTML scene and reveal do not depend on renderer readiness. No-JavaScript content must remain unobscured.

Also delay the curtain images themselves: the session must remain unconsumed until their decode completes, and a delay longer than 1500 ms must release the veil. For WebGL failure and native context loss, navigate through every destination and resize across the mobile breakpoint; the fallback must update its pose, depth stacking, scene opacity, and label geometry without drawing to the lost context.

Compare the first-paint DOM scene with the ready GPU scene at the same viewport and pose: celestial silhouettes and labels must remain aligned, with one visible Earth and no duplicate artwork. Inspect foreground cloud occlusion during travel, texture-load failures, context loss, and desktop/mobile resizing while images load. Verify NASA surface/cloud maps remain aligned with geographic picking and active-country highlights.

Unit coverage belongs to deterministic logic: manifest projection and responsive framing, camera interpolation and cancellation, scene/hash parsing, atlas geometry, constellation layout, Almanac filtering, and the photography pipeline. `tests/unit/celestial-artwork.test.ts` additionally covers bounded shared-clock drift, the 40/29 loaded-plane selection, stale image-load completion, translucent depth ordering, and Earth texture/atlas longitude alignment.

## Running and capturing

The `npm test` launcher owns a separate Astro process on port 4333, fails when that process exits, and waits up to three minutes for a cold compile. Do not start another server on that port while the launcher owns it. Use the normal development server for manual review.

After a successful build, test production output in PowerShell:

```powershell
$env:PLAYWRIGHT_USE_PREVIEW = "1"
npm test
Remove-Item Env:PLAYWRIGHT_USE_PREVIEW
```

Generate full-speed videos and deterministic flight captures in separate passes:

```powershell
$env:PLAYWRIGHT_USE_PREVIEW = "1"
$env:IVORY_CAPTURE = "1"
npm test -- tests/ivory-universe.spec.ts --grep "travels all twelve"
$env:IVORY_STILL_FRAMES = "1"
npm test -- tests/ivory-universe.spec.ts --grep "captures exact"
Remove-Item Env:IVORY_STILL_FRAMES
Remove-Item Env:IVORY_CAPTURE
Remove-Item Env:PLAYWRIGHT_USE_PREVIEW
```

To reuse an already verified preview instead of starting another server, set `PLAYWRIGHT_EXTERNAL_SERVER=1` and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4334`. The launcher leaves that external server running. Never rebuild its output while a browser run is consuming it.

Inspect settled Home, About, Projects, and Travel at `1440x900`, `390x844`, and `320x700`, plus project/country/city reading pages. Compare Home against the supplied reference at the same viewport, checking its left copy area, two-line title, layered clouds, nebula, constellation, large cropped Earth, and object-sized navigation regions without floating destination labels. Review full-speed journeys in both directions and sampled 0/25/50/75/100 frames. Use `?universeAudit=1` for deterministic seeking, frame logs, and context-loss checks. Captures and browser artifacts stay ignored; record findings and evidence paths in [design-qa.md](../design-qa.md).

## Performance evidence and handoff

Report warmed production timings separately from cold development compilation. Record browser, viewport, device scale, GPU/renderer identity, frame intervals, long tasks, and draw calls with each performance result. Check actual draw calls against the 44 desktop/32 mobile acceptance budgets, and confirm the loaded 40/29 artwork plate set spans at least eight depth bands; the visible count may be lower because of camera culling or adaptive decoration reduction. The five desktop/two mobile secondary bodies use separate, unique artwork billboards, with the ringed planet retained first during adaptive decoration reduction. The two-million/one-million pixel budgets and 30 fps ambient/60 fps active cadence are targets, not proof of measured performance.

Software rendering such as SwiftShader can validate navigation, captures, ownership, and draw-call budgets. Its frame-time and long-task measurements must be labeled separately and must not be presented as hardware GPU results. Run hardware-accelerated desktop and mobile measurements before claiming the 60 fps target has been achieved.

Investigate Travel timeouts with the server exit/log state, renderer readiness, atlas activation, and browser errors. Do not merely increase limits. Report pre-existing failures separately, name all skipped checks and why, and leave unverified visual/hardware acceptance explicitly pending.

## Celestial object controls and idle effects

Home uses three real hash links clipped to shared projected geometry: the Earth tangent silhouette, the approved nebula alpha contour, and the constellation hull. Check centers and edges, transparent corners, overlaps, viewport clipping, native modifier clicks, and first-tap touch activation. Text, menus, and panels must win hit testing. Leaving Home immediately makes its regions inert; Travel dragging and project selection retain their existing handlers. Keyboard focus must keep its glow after pointer departure and show a contour outline.

`tests/unit/celestial-interactions.test.ts` covers region projection, distinct alpha artwork, effect timing, two-patch illumination, bounded deformation, and shooting-star admission during flights. `tests/celestial-interactions.spec.ts` covers browser semantics, fallback controls, pinned/reduced motion, quiet detail-page suspension, and active-hover performance. With `IVORY_CAPTURE=1`, it also records idle, hover, focus, localized fold movement, and shooting-star frames. Use the existing renderer audit clock; do not introduce separate animation timers for captures.

## About nebula regression coverage

`tests/unit/about-nebula.test.ts` checks visible-eye centering, control clearance, resolver parity, and approach layers. `tests/unit/nebula-regions.test.ts` checks mask-edge alpha, source UV placement, and isolated About lighting/drift. `tests/unit/about-clouds.test.ts` covers reversible emergence, mobile spacing, reduced motion, unique entries, and local assets. `tests/about-nebula.spec.ts` checks independent toggles, all nine revealed items, keyboard captions, Escape, missing artwork, rapid reversal, departure reset, and context loss.

The About controls use cloud artwork generated from the background nebula reference with persistent category names, independent reveals, and foreground occlusion. Verify whole-cloud hover and focus illumination, bounded idle drift, stable labels, and stationary reduced-motion/context-loss states. `tests/unit/about-clouds.test.ts` covers reversible movement, responsive region clearance, and transparent alpha across both asset resolutions. `tests/unit/nebula-regions.test.ts` checks identical first-paint/runtime placement. Background curl and shared-clock lighting remain covered by `tests/unit/nebula-light.test.ts`.

Inspect closed, hovered, keyboard-focused, individually expanded, and fully expanded clouds at 1440x900, 390x844, and 320x700. At 320px, short category names remain visible while subtitles are hidden. Covers and names must not intersect, and all nine items must remain reachable. The front layer must visibly occlude emerging images without intercepting clicks. Reduced-motion and context-loss states must retain static lighting and immediate controls. Set `ABOUT_CLOUD_CAPTURE=1` when running `tests/about-nebula.spec.ts` to save responsive stills and intermediate reveal frames under `.playwright-mcp/`. See [About clouds](ABOUT-CLOUDS.md) for asset provenance and export instructions.

Review both Home/About journey directions at full speed and 0/25/50/75/100 percent. All twelve directed scene journeys remain regression coverage. Hardware frame-rate claims require hardware measurements; software-rendered captures establish behavior and composition only.

## Projects depth regression coverage

`tests/unit/project-depth.test.ts` verifies sixfold Home depth, unchanged Home and Projects framing, serialized first-paint parity, the sky behind the stars, successive foreground planes, and decorative planet fading. `tests/project-depth.spec.ts` exercises the keyboard journey, forward/reverse draw-call budgets, geometry identity, narrow previews, and responsive Home stars after context loss. Existing constellation, refresh, runtime, no-JavaScript, reduced-motion, history, and all-direction journey tests remain regression coverage.

Capture Home and Projects at 1440x900, 390x844, and 320x700. Inspect Home occlusion, star/line contrast, mobile label clearance, and both flight directions at 0/25/50/75/100 percent. Record real-time journeys separately from audit seeking; software-rendered recordings do not establish physical-device frame-rate performance.

## Home layering regression coverage

`tests/unit/home-layers.test.ts` traverses 101 Home-to-Travel camera samples at desktop and narrow widths. It verifies stable planet retention, full-opacity foreground exits, small decorative bodies, non-writing transparent depth, smooth adaptive fading, and standalone resolver parity. `tests/home-layers.spec.ts` exercises real keyboard entry and return, body placement restoration, sampled forward/reverse opacity and draw-call limits, and non-interactive decoration. Set `HOME_LAYER_CAPTURE=1` to record that journey and its endpoint screenshots.

`tests/unit/cloud-continuity.test.ts` also checks 401 Home-to-Travel samples at desktop and narrow widths for in-view cloud eviction, stable physical depth ordering, and uninterrupted artwork during delayed or failed responsive texture replacements. Cloud loading and quality adjustments must not blank the composition or exchange visible cloud layers during a journey.

## Travel globe polish

`tests/travel-globe.spec.ts` covers continuous auto-spin through hover/focus/dragging/previews,
back-side labels and city markers, immediate departure hiding, interrupted
arrivals, history, and drag momentum on mobile and desktop. The hover profile
records synchronous country-change duration and the base texture version;
country changes must leave the version unchanged and take less than 50 ms.
`tests/unit/atlas-motion.test.ts` checks frame-rate-independent spin,
immediate resumption after controlled suspension, interrupted fades, and both projection horizons.

Inspect border and highlight alignment on the photographic globe, especially
Hong Kong, Taiwan, the antimeridian, and countries near the horizon. The new
surface masks are runtime resources, not generated photography assets.

Set `TRAVEL_CAPTURE=1` when running `tests/travel-globe.spec.ts` to save the optional highlighted-globe and 320px canvas-fallback screenshots in the test output directory. These diagnostic captures are disabled during normal behavior checks; all interaction assertions and timeouts remain active.

## Portfolio refinement

`tests/navigation.spec.ts` covers shared active states, contact links, mobile menu names, outside/Escape/focus dismissal, and scene-heading focus. `tests/content-polish.spec.ts` checks raster social previews, project section links, and next-project navigation. `tests/polish.spec.ts` covers 320px homepage hit targets, static links without JavaScript, About caption clearance, responsive city-card images, and 404 recovery.

Inspect Home copy and object navigation over the actual moving artwork at 390px and 320px; the extra work/travel buttons must remain absent. When capturing a full city gallery, scroll through every lazy-loaded image and await decoding before accepting the screenshot. A full-page screenshot alone does not trigger every off-screen image load.
