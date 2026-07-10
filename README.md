# stoneyang.ca

Stone Yang's static-first creative portfolio, built with Astro 6, TypeScript, Tailwind CSS 4, React, and Motion.

## Local development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run check
npm run build
npm test
```

Draft photography and project entries are visible in local development and excluded from production builds.

## Publishing content

Photography collections live in `src/content/photography` and projects live in `src/content/projects`. Both are typed content collections; an invalid entry fails the build with a schema error.

1. Upload final images and videos to the project's public Vercel Blob store using the Vercel dashboard or CLI.
2. Copy each immutable public URL into the entry frontmatter. Include the original pixel width, height, and useful alternative text.
3. Choose an existing photography `presentation` and a layout role for every media item.
4. Run the site locally and review desktop, mobile, keyboard, and reduced-motion behavior.
5. Set `draft: false` when the entry is ready to publish.

The website never receives a Blob write token and has no upload interface. Media remains publicly readable and content changes remain version-controlled.

## Creative extensions

- Native project demos are explicitly registered in `src/components/demos/registry.ts`.
- Exceptional collection visuals are explicitly registered in `src/components/gallery/registry.ts`.
- Collection colors and motion character are data-driven CSS variables, not dynamically generated Tailwind class names.

This keeps unusual visual work possible without allowing content files to import arbitrary runtime code.

## Deployment

Vercel detects Astro automatically. The Vercel adapter enables Web Analytics and the image service. The existing `/static/pdf/Resume.pdf` URL permanently redirects to `/resume.pdf`.
