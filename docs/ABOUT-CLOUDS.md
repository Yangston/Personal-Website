# About nebula clouds

About uses three independently expandable cloud formations: musical notes, an open book, and a compass. Their billowing folds, transparent wisps, peach highlights, and lavender shadows match the background nebula. They reveal the existing authored Almanac entries; `cloud-layout.ts` reserves space for all nine items even when closed.

The artwork was generated with the built-in image generator using `public/media/site/celestial/cloudscape-v3/nebula-1537.webp` as the visual reference. The full-resolution originals stay ignored in `.private/about-nebula/originals/`. Six responsive WebPs are published in `public/media/site/about-nebula/` at 320px and 640px. Re-export without changing the generated alpha:

```powershell
node scripts/celestial/prepare-about-nebula.mjs .private/about-nebula/originals/songs.png .private/about-nebula/originals/books.png .private/about-nebula/originals/hobbies.png
```

Each cloud uses one source image behind the emerging items and the same registered image with a feathered lower mask in front. Hover and keyboard focus gently lift the image's existing internal light (up to 12 percent brightness and 6 percent saturation) with 180/300ms emphasis. There is no separate glow graphic, white overlay, or halo. The foreground never intercepts input.

`sampleCloudDrift` uses the shared universe clock for independent 22-30 second cycles, with at most 3px horizontal drift, 4px vertical drift, 1.2 degrees of roll, and 1.8 percent breathing. Labels, hit areas, and item positions remain stable. Hidden scenes stop updating; reduced motion and WebGL fallback use stationary clouds while retaining hover and focus illumination.

The shared clock also drives 650ms opening and 450ms closing. Items use the same quintic ease-in/out as camera journeys, gently accelerating and settling within their staggered reveal intervals. Reveal progress holds at its requested endpoint until the next toggle, so a fully open item never repeatedly re-enters its clipping mask. The foreground and a clipping mask conceal the initial item pose. Rapid toggles reverse at their current progress. Escape closes the groups and restores the originating control when focus was inside a revealed list. On phones, categories use three rows and captions use a reserved strip; at 320px, subtitles are hidden while category names remain.

The five local album and book covers load eagerly at low priority, and the controller starts decoding them before their first reveal. Missing images retain their titled fallback controls. `tests/unit/about-clouds.test.ts` checks convergence and reversal at several frame cadences; `tests/about-nebula.spec.ts` samples settled opening frames to catch repeated clipping or opacity changes.

## Generation prompts

All three images used this shared prompt with the nebula as a reference:

> Use case: style-transfer. Asset for an existing website. Input is the exact background nebula and is a STYLE/COLOR/TEXTURE reference. Re-form its vapor into ONE isolated cloud formation on a GENUINELY TRANSPARENT alpha background. Match the reference's luminous pastel peach, coral-pink, creamy ivory and pale lavender-blue, its natural billowing rounded cloud volumes with thin wisps and softly glowing fissures. Keep ALL shadows light pastel lavender, NO dark purple/gray/black. The subject must be made of volumetric fluffy CLOUDS, with irregular puffy edges and internal folds, not a flat stencil filled with texture, not a solid object, not stone or smoke. Loose recognizable silhouette with organic asymmetry. Soft diffuse light from within, no halo ring, no border, no rays, no stars, no text. Entire subject centered within the middle 80% of a square image, lots of transparent padding, transparent holes. Do not include the nebula background or vortex.

Subject additions:

- **Music:** Two connected musical eighth notes formed from fluffy nebula clouds: two softly rounded puffy cloud note heads, vertical columns of loose billowing clouds, and a cloud bank joining their tops.
- **Books:** An open book formed completely of fluffy nebula clouds: two broad wing-like banks of rolling vapor suggesting open pages with a soft central valley, a gently V-shaped lower contour. No physical paper.
- **Hobbies:** A simple four-point compass rose formed completely of fluffy nebula clouds: four tapered puffy cloud arms flowing from a broad cloud center, with the vertical arms a little longer than the horizontal arms. Soft billowing uneven tips, no enclosing circle.

The previous dark symbol assets and their export script are preserved in `public/media/site/about-clouds/` and `scripts/celestial/build-about-clouds.mjs`; the page no longer requests them.
