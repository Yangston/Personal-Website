# Documentation

| Task                             | Read                            |
| -------------------------------- | ------------------------------- |
| Understand repository boundaries | [Architecture](ARCHITECTURE.md) |
| Run the site locally             | [Development](DEVELOPMENT.md)   |
| Change routes or components      | [Frontend](FRONTEND.md)         |
| Publish or rebuild gallery media | [Photography](PHOTOGRAPHY.md)   |
| Select validation                | [Testing](TESTING.md)           |
| Deploy the portfolio             | [Deployment](DEPLOYMENT.md)     |

The site has one ivory space environment with Home, About, Projects, and Travel destinations at `/`. A shared scene manifest determines initial and live composition; a persistent world carries clouds, the marble planet, the Earth, and stars through direct camera journeys. With JavaScript, real hashes select scenes in a fixed viewport. Without JavaScript, the content remains a semantic document in reading order.

Project case studies at `/projects/[slug]`, country archives at `/photography/[country]`, and city galleries at `/photography/[country]/[city]` are scrollable reading pages with the same quiet environment. The legacy `/projects` and `/photography` index URLs redirect to `/#projects` and `/#travel`. A single navigation coordinator connects scene previews, the shared Earth atlas, history, and focus.

Use Node 24.16.0 or a later Node 24 release and install the lockfile with `npm ci`. Current visual acceptance status belongs in [design-qa.md](../design-qa.md); configured budgets and previous screenshots are not evidence that the current revision has passed.

Sightline is a separate repository and deployment. Camera localization, pose reconstruction, provider viewers, scene payloads, and their research evidence must not be added back to this portfolio.
