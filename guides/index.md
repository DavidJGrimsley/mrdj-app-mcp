# PokePages Practices Index

This index replaces the old general guide. Each topic now lives in its own focused doc.

These guides now reflect DJsPortfolio conventions (Expo Router + Uniwind, `manifest.webmanifest`, `sw.js`, and the sitemap/icon pipelines in `scripts/`).

- [architecture.md](architecture.md) — App layout, module boundaries, platform files, routing vs screens.
- [stateManagement.md](stateManagement.md) — Zustand patterns, store structure, selectors, persistence.
- [databaseArchitecture.md](databaseArchitecture.md) — Drizzle + Supabase schema, RLS, migrations, seed/fixtures.
- [styling.md](styling.md) — Uniwind setup, tokens/theming in CSS, responsive patterns, migration notes.
- [routing.md](routing.md) — Expo Router conventions, file-based routes, guards, linking.
- [animation.md](animation.md) — Reanimated/worklets guidance, transitions, thread separation.
- [performance.md](performance.md) — Startup, re-render control, lists, compiler, worklets, measurement.
- [icons.md](icons.md) — Asset checklist, icon naming, SmartUtilify copy scripts, PWA icon paths.
- [pwa.md](pwa.md) — Progressive Web App setup, manifest, service worker, auto-updates, theme-color.
- [buildScripts.md](buildScripts.md) — Local build/export scripts, sitemap generation, API server build.
- [SDK54expoSSR.md](SDK54expoSSR.md) — Expo Router SSR (SDK 54) server output guide.
- [SDK55expoSSR.md](SDK55expoSSR.md) — Expo Router SSR (SDK 55) server rendering alpha guide.
- [pleskDeployment.md](pleskDeployment.md) — How we deploy static web builds and the API on Plesk.
- [pleskApiRoutesDeploy.md](pleskApiRoutesDeploy.md) — **Expo Router API routes deployment to Plesk (server output mode).**
- [metaTags.md](metaTags.md) — SEO, Open Graph, Twitter Cards, dynamic meta tags.
- [offlineFirst.md](offlineFirst.md) — Offline-first architecture, sync strategies, conflict resolution.
- [typeCheckAndLint.md](typeCheckAndLint.md) — TypeScript setup, ESLint config, pre-commit hooks.
- [backendBestPractices.md](backendBestPractices.md) — API design, error handling, validation, security.
- [ads.md](ads.md) — Monetization strategies (no ads, sponsored content, ad networks), privacy compliance, offline-first ad caching.

If you add a new guide, link it here so this page stays the entry point for best practices.