# Frontend

Use Astro for static composition and React only when client state is necessary. Keep props serializable and route-scoped, preserve semantic links and headings, and retain useful content without JavaScript.

## Photography flow

- `/photography` renders the travel atlas and country navigation.
- Country routes render a silhouette, sample photographs, and links to every configured city.
- City routes render a short introduction and every published photograph assigned to that city.
- The city lightbox supports keyboard activation, arrow navigation, Escape, visible focus, and focus restoration.

The portfolio deliberately has no 3D city viewer, provider key, scene endpoint, camera controls, or reconstruction selection state.

## Interaction requirements

- Every pointer action needs keyboard parity.
- Dialogs need an accessible name, Escape behavior, focus entry, and focus restoration.
- Motion must use transform/opacity where practical and respect `prefers-reduced-motion`.
- Pages must avoid horizontal overflow from 320px through desktop widths.
- Below-the-fold images need intrinsic dimensions and lazy loading.

Use existing tokens and global primitives before adding new CSS. Add Playwright coverage for route, layout, accessibility, or interaction changes.
