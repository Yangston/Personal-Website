# Interactive component guide

This guide applies under `src/components` and supplements the root guide.

- Default to Astro for static presentation. Use React only for necessary client state, dialogs, coordinated motion, or browser-only interaction.
- Keep island props small and serializable. Preserve deliberate hydration and useful server-rendered fallbacks.
- Give pointer interactions keyboard equivalents and visible focus.
- Dialogs/lightboxes need a name, Escape behavior, arrow controls when stepping media, initial focus, and focus restoration.
- Use buttons for actions and anchors for navigation. Keep routine status changes quiet.
- Respect reduced motion and remove travel delays or large transitions when requested.
- Clean up observers, listeners, timers, animations, and focus effects.
- Keep large dependencies behind dynamic imports; do not send full photography data to unrelated routes.
- Use transform/opacity for motion and reuse tokens from `src/styles/global.css`.
- Keep intrinsic image dimensions and responsive sources; never serve archival originals.

Add Playwright coverage for mobile/desktop behavior, keyboard flow, modal focus, reduced motion, and fallbacks. Add Vitest coverage for deterministic non-React logic.
