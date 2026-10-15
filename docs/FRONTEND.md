# Frontend

Use Astro for static composition and React only when client state is necessary. Keep props serializable and route-scoped, preserve semantic links and headings, and retain useful content without JavaScript.

## Composition and visual ownership

- Use the universe ivory, charcoal, pearl, lavender, and warm red accents for the shared environment. Use `--font-universe-display` (Bodoni Moda) for the four main scenes, immersive navigation, and previews; keep detail-page display styling scoped to its existing token. Preserve photography colors; do not tint or saturate gallery images to match the theme.
- Change celestial anchors, artwork, or responsive camera framing through `scene-manifest.ts`. The initial markup and runtime use its same projection function; avoid independent CSS positions that cause an enhancement-time layout replacement.
- `UniverseWorld.astro` owns the first-paint DOM artwork and canvas. Three.js draws the corresponding textured cloud/planet planes after readiness, along with the Earth and spatial stars. Both artwork paths use the same manifest, projection, and bounded drift sampler. Hide the DOM artwork only after the GPU replacement frame exists; keep one visible representation and one live Earth.
- The same scene objects must remain coherent through all directed camera journeys. Changing scene should move through the world without swapping backdrops or detouring through Home.
- Preserve the authored desktop composition: a calm left copy area, two-line Home title, upper-right nebula, central constellations, cropped lower-right Earth, and foreground clouds. Home destinations use object silhouettes rather than floating labels; project labels contain readable titles and compact metadata. Home keeps a quiet location footer and résumé link without a scroll instruction or additional work/travel buttons.
- Use the manifest's 40 desktop and 29 mobile loaded planes across at least eight depth bands, with the visible draw budget enforced separately. Mobile framing is an authored portrait composition, not a scaled desktop crop. Use the supplied local celestial artwork and its smaller variants, cache repeated sources, and preserve explicit color-space handling and layout-read caching.
- Keep NASA day, night-light, and cloud imagery separate from the geographic mask. Warm grading and the moving cloud shell must not move country picking, highlights, or labels relative to the Earth. Do not apply Earth grading to gallery photographs.

## Universe navigation

- `/` contains Home, About, Projects, and Travel in reading order. Enhanced navigation uses real `/#home`, `/#about`, `/#projects`, and `/#travel` links in a fixed `100svh` viewport.
- The coordinator owns scene changes, immediate hash/history updates, loading, heading focus, panels, and atlas activation. Do not add an independent scene-transition listener or animation clock.
- Direct hashes initialize at their final pose. Normal flights settle at rest; interrupted flights continue from the current pose and velocity. Reduced motion removes travel delays and ambient movement.
- Scene-camera journeys take 1.4–1.9 seconds, with quintic ease-in/ease-out timing that starts and finishes with zero acceleration. Interrupted journeys preserve their incoming velocity. Destination copy enters after 38% of the journey. Keep this timing separate from the decorative opening reveal. Home navigation uses the celestial objects and shared menu; the extra work/travel buttons are intentionally absent, while the résumé link remains.
- Changing motion preference in a settled scene preserves globe orientation and keyboard focus. Enabling reduced motion during a flight settles that flight immediately; it must not restart navigation when the scene is already at rest.
- The initial Home cloud reveal lasts 1600 ms and parts diagonally toward the top right and bottom left. It runs once per tab after decoding its two images; slow or missing images release the veil after 1500 ms without consuming the opening. It never waits for WebGL or blocks input. Direct non-Home hashes, quiet detail visits, same-document returns, and reduced motion skip it; input or navigation dismisses an in-progress reveal. Keep this decorative entrance separate from scene-camera navigation.
- Inactive sections remain hidden, `inert`, and `aria-hidden`. Restore the normal-flow document if enhancement fails.
- `/#travel` dynamically loads the atlas and activates its input/frame subscriptions only while needed. Preserve the Earth bridge for geographic projection, drag rotation, country focus, and fallback rendering.
- `/projects` and `/photography` remain compatibility redirects. Keep all project, country, and city detail URLs real and linkable.

## Scene previews

Each constellation serializes a `hoverMotion` profile with its geometry: trace, wave, or cards. WebGL and the SVG fallback use the same profile. Touch info buttons are positioned against projected label bounds on resize, font readiness, and scene settlement; they do not add per-frame layout reads.

- Project constellation titles are complete and readable immediately. Hover or keyboard focus opens a nonmodal side preview with authored title, summary, year, status, and stack. The anchor always opens the case study directly. Touch uses a separate info button and dismissible bottom preview. Preview focus stays with the visitor; Escape dismisses it.
- About uses the authored introduction and `src/config/almanac.ts` hobbies, songs, and books. Empty categories render no invented placeholders, and all entries remain in the static document.
- Country selection calls the atlas preview callback. The panel contains real archive links; city links remain native route navigation.
- Country previews use `ScenePanel.astro` and the shared panel controller. Only one country preview may be open. Desktop panels remain alongside the scene; narrow screens use native modal bottom sheets with bounded scrolling.
- Preserve accessible names, expanded state, heading focus on opening, Escape/Close, and focus restoration. Scene travel closes the old panel without restoring stale focus.

## Detail pages

Use `BaseLayout` with `cosmicScene="universe"`, `worldMode="quiet"`, and `returnScene="projects"` or `returnScene="travel"`. This preserves the world across Astro navigation, suspends expensive animation during reading, and keeps direct detail visits lightweight. Internal return links should use the destination hash and allow client navigation.

Case studies retain authored content, responsive covers, registered demos, iframe sandboxing, and external fallbacks. Country pages place their introduction before the silhouette and city directory. City pages retain every published photograph and intrinsic image dimensions; lazy-load below-the-fold media.

Gallery images are native full-size links without JavaScript and open a lightbox after enhancement. Keep arrow navigation, Escape, focus restoration, and full-width mobile image presentation with at least 44px controls. Page-specific listeners initialize on `astro:page-load`, release on `astro:before-swap`, and clear references to departed DOM nodes so a client-navigation revisit works.

## Accessibility and performance

Every pointer interaction needs keyboard parity and visible focus. Avoid horizontal overflow from 320px through desktop widths. The enhanced index may contain bounded scrolling panels, but its outer document stays fixed; detail pages scroll normally.

Use transform/opacity for movement where practical. Subscribe to the shared world clock rather than introducing additional render loops. Pause hidden-page and quiet-page rendering and inactive atlas work. Test both reduced motion and failed WebGL paths, and distinguish scheduled frame targets from measured hardware performance.

Retain the two-million/one-million desktop/mobile pixel caps, 30 fps ambient and 60 fps active scheduling, and 44/32 draw-call acceptance budgets. Adapt raster density and particle detail without exchanging the authored cloud layers. Transparent planes must test depth without writing it and maintain physical back-to-front ordering; inspect clouds crossing the Earth during every direction of travel.

Use existing tokens and primitives before adding CSS. Add focused Playwright coverage for route, layout, accessibility, or interaction changes; see [Testing](TESTING.md).

## About nebula and cloud pillars

The nebula retains its shared deep-world projection. Home uses its original lighting; About compresses the small stellar hotspot and applies a shared display-space contrast grade to its shader, HTML folds, and fallback image. About framing centers the authored visible-eye UV `(0.465, 0.435)` with a continuous viewport-dependent scale. The introduction is compact and centered above it. Foreground haze fades according to resolved depth relative to the threefold-deeper nebula, not the original plate positions; the distant panorama and approach journey remain intact.

`nebula-regions.ts` defines Music in an upper-left fold, Books in an upper-right fold, and Hobbies in the lower fold. Six irregular, feathered SVG masks sample the nebula image at exactly the same projected size and UV origin as the background. Closed folds have 8% opacity; active folds progressively occlude emerging items. Broken ridge masks shape a moving core and weaker spill behind the foreground, with 180/300 ms hover and keyboard emphasis. The shared clock also drives three bounded peripheral curls on 18/24/30-second cycles. The eye and interactive crops remain stationary, preserving source alignment. Initial inline markup and runtime placement use the same geometry helper.

`AboutClouds.astro` owns semantic controls, covers, and vector hobby icons. Category strokes mask textured luminous openings with recessed edges beneath the foreground wisps. Each expanded category displays its authored label below the opening; collapse, Escape, and departure hide the label. `about-clouds.ts` samples reversible emergence and curved resting arrangements from the existing clock. All groups may stay open; one item caption can be pinned. Mobile uses one quiet item caption below the nebula. At widths up to 360px, the hobby arc gains 14px of vertical clearance below category labels. Focus takes precedence over sticky touch hover. Escape restores focus when needed and closes the groups; scene departure resets them. Reduced motion and unavailable WebGL reveal immediately and retain stationary illumination. The static Almanac remains readable without JavaScript.

The world loads 40 desktop / 29 mobile planes. Tight geometric frustum culling retains every visible cloud instead of re-ranking and evicting layers as the camera moves; total WebGL draw-call budgets remain 44 / 32. Responsive texture replacements commit together while the previous decoded artwork stays visible, and a failed replacement retains its usable prior texture. HTML masks add no WebGL passes. Six approach planes (four on mobile) remain in the shared camera journey. No new raster assets or dependencies are required.

## Distant Projects sky

Projects sits at six times its authored depth, compared with About's threefold depth: `createCompositionFrame().projectToWorld` scales authored constellation vertices about the responsive Home eye, and scales the destination camera by the same transform. GPU object transforms, selection bounds, native Home regions, and first-paint/fallback SVGs share it. Resize updates transforms without replacing constellation geometry. Transit-only cloud veils fade in smoothly as the camera approaches their depth, then fade before the near plane; they never appear as a simultaneous replacement set over Home.

The native `project-sky.svg` supplies a feathered mauve/charcoal pocket shaped around the three constellations behind the gold stars. Nine structural cloud plates reuse existing artwork at successive approach depths: three veil Home and six appear only during the journey. The original three retain their nearer positions, so the longer flight passes them faster. They partially veil Home, pass the camera during entry, and fade before near-camera billboards fill the frame. Other clouds recede in Projects; the About nebula fades out there. Decorative planets fade during the first part of the approach so near-camera billboards cannot obscure the destination. Project previews and detail URLs are unchanged. Star glints and dust use the existing shared clock and adaptive draw ranges; no new renderer pass or dependency is required.

During live WebGL flights, hidden fallback SVG and cloud markup do not receive per-frame projection writes, including in audit mode. Explicit audit seeking and actual fallback rendering still synchronize the DOM scene.

## Travel globe interaction

Home and Travel rotate at 3 degrees per second through hover, keyboard focus, dragging, and open country previews. Drag deltas combine with automatic longitude; there is no idle restart delay. Home rotation belongs to the renderer, and Travel rotation belongs to the atlas on the same frame clock. Controlled country/route transitions retain ownership of their poses. Reduced motion, hidden pages, and quiet detail pages suspend ambient rotation.

Country emphasis uses precomputed fill/outline GPU masks, fading in over 180 ms
and out over 140 ms. Hover never redraws or uploads the base Earth texture.
Shared topology boundaries and visited-country outlines are separate surface
layers, so photographic shading cannot erase them. All masks use the same
longitude offset as the Earth imagery and are disposed with the renderer.

`data-atlas-overlays-ready` gates labels, leaders, and city markers as one unit.
Positions are computed before arrival reveals them; departure hides them and
makes their navigation inert synchronously. Geographic anchors fade just inside
the camera-facing horizon and hide immediately when occluded or outside the
viewport. Hidden geographic links remain keyboard-reachable while Travel is
active: focusing one first turns its country into view.

## Home bodies and Earth transition continuity

Decorative bodies use small, subdued billboards distributed across cloud depths, with distinct portrait placements. They remain outside the semantic destination controls. Their alpha artwork blends in transparent depth order and never writes opaque depth; adaptive decoration changes attenuate opacity continuously instead of toggling bodies at a hard cutoff.

The marble background planet and the two near cloud banks retain rendering-budget priority so they cannot blink out when another cloud enters the viewport. `resolveWorldPlane` accepts an optional Travel weight: the near banks move outward along their authored `travelExit` vectors while retaining opacity, then leave the frustum. Home and Travel first paint, live WebGL, context-loss fallback, and deterministic audit projection use the same displacement. Keep the world-plane and draw-call budgets unchanged.
