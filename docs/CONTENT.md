# Content

## Sources of truth

Astro content collections are defined in `src/content.config.ts`. `src/lib/content.ts` filters drafts and sorts public entries. Route files consume those helpers and render MDX through Astro's content API.

Content is hand-authored unless [Photography content](PHOTOGRAPHY.md) explicitly marks an artifact as generated. Do not add unvalidated fields to frontmatter.

## Site configuration

`src/config/site.ts` owns the public name, title, description, introduction, biography, email, resume path, social links, and primary navigation. `BaseLayout.astro` consumes it for navigation, footer content, and default metadata; the homepage consumes introduction, biography, contact, and resume values.

When changing site configuration:

- Keep navigation paths aligned with actual static routes.
- Use HTTPS for public social links and a stable public path for the resume.
- Verify default metadata and footer output as well as the homepage.
- Treat email addresses and public profile URLs as intentionally published personal data.

## Project collection

Project files live at `src/content/projects/<slug>.mdx`. The filename becomes the route ID under `/projects/<slug>`.

Required and defaulted fields:

| Field      | Contract                                                         |
| ---------- | ---------------------------------------------------------------- |
| `title`    | Display title                                                    |
| `year`     | Integer used for descending sort                                 |
| `status`   | Editorial project status                                         |
| `role`     | Contributor role description                                     |
| `summary`  | Card and metadata summary                                        |
| `stack`    | Array of technology labels                                       |
| `cover`    | Public `src`, positive `width`/`height`, non-empty `alt`         |
| `draft`    | Defaults to `true`; excluded in production                       |
| `featured` | Defaults to `false`; homepage selects up to three public entries |
| `links`    | Optional validated repository and live URLs                      |
| `demo`     | Discriminated `native`, `iframe`, `external`, or `none` record   |

MDX body content renders inside the project case-study article. Use semantic headings beginning at `##` because the route owns the page-level heading.

### Demo types

- `native`: reference an ID registered in `src/components/demos/registry.ts`. The launcher displays a clear fallback when an ID is absent, but published content should not rely on that error state.
- `iframe`: provide a valid URL and title. The launcher uses a restricted sandbox and supplies a direct-link fallback.
- `external`: render a direct external link without an embedded surface.
- `none`: render no launcher.

Native demos are React code and require interaction, accessibility, reduced-motion, and Playwright review.

### Project assets

Project covers currently live in `public/media/projects` and are manually managed. Record actual pixel dimensions, write scene-specific alt text, and optimize files before publishing. They do not use `npm run photos`. Files under `public` deploy even when the associated MDX is a draft, so draft status does not protect a private or unlicensed cover.

## Photography collection

Country files live at `src/content/photography/<country-slug>.mdx`. The filename becomes the country route and must match generated manifest `country` values.

| Field                | Contract                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| `name`               | Public country name shown in atlas labels and route metadata             |
| `isoCode`            | Exactly two characters                                                   |
| `coordinates`        | Country-level globe latitude and longitude                               |
| `dateRange`          | Coerced start and end dates                                              |
| `description`        | Route metadata and introduction                                          |
| `draft` / `featured` | Production visibility and homepage selection                             |
| `theme`              | Background, foreground, accent, rhythm, grain, and motion values         |
| `coverId`            | Image ID from the generated manifest                                     |
| `regions`            | Ordered editorial chapters with stable IDs, labels, and optional centers |

The MDX body renders as the country field note below the city directory. Atlas geometry joins through the stable numeric mapping in `src/lib/photography-atlas/data.ts`, not through display names. Region IDs must agree with archive folders and `src/config/photography.json`. Follow [Photography publishing](PHOTOGRAPHY.md) for sources and generation.

## Photography city configuration

City routes are hand-authored in `src/config/photography.json` and publish at `/photography/<country>/<city-id>`. Bounds, center, default camera, coverage policy, and `regionKey` remain editorial inputs. `pilotPhotoIds` are derived from the generated complete map catalog; do not hand-author them.

Every city must author `samplePhotoIds` with one or two unique manifest IDs. Each sample must exist and match the city's country, region, and map membership. These IDs drive the country silhouette callouts, so choose representative reviewed images rather than first-in-order records. Configuration loading and unit tests fail closed on duplicates, missing IDs, or cross-city samples.

## Draft and featured behavior

`getPhotography()` and `getProjects()` include drafts during development and exclude them when `import.meta.env.PROD` is true. Photography sorts by descending start date; projects sort by descending year. Homepage featured sections then filter those results and apply their own item limits.

Validate both development authoring and production output. A draft route working under `npm run dev` does not prove it exists in `npm run build`.

## Content checklist

- Validate frontmatter against the schema and a neighboring entry.
- Confirm the filename-derived slug and static route.
- Review publication and featured state in a production build.
- Verify cover paths, dimensions, and alt text.
- Confirm external URLs and demo registration.
- Keep headings semantic and copy useful without JavaScript.
- Run the checks in [Testing](TESTING.md).
