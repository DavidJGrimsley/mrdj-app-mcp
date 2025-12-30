# mrdj-app-mcp

Model Context Protocol (MCP) server that surfaces my Expo/React Native web and mobile guidance (PokePages) as structured resources. Built to run locally or behind a reverse proxy (e.g., Plesk) so AI tools can query the same docs I use.

## Tech stack
- TypeScript + Node.js (ES modules)
- @modelcontextprotocol/sdk 1.25.x
- Lightweight build via `tsc`; single entrypoint `build/index.js`
- File-based content under `guides/` packaged as MCP resources
- Plesk-friendly: no native deps, static build output; can also be hosted on any Node-capable platform or container

## What this MCP covers and assumes you are using(guided by the docs)
- Architecture patterns: Expo app layout, module boundaries, routing vs screens.
- State management: Zustand store patterns, selectors, persistence.
- Data: Drizzle ORM + Supabase schema guidance, RLS, migrations, seed/fixtures.
- Styling: NativeWind setup, design tokens, responsive/theming approaches.
- Routing: Expo Router conventions, file-based routes, guards, deep linking.
- Animation: Reanimated 4 guidance (worklets, transitions, thread separation).
- Performance & SEO: startup, rerender control, list tuning, compiler hints, metadata.
- Build scripts: local build/export scripts, sitemap generation, API build.
- Deployment: Plesk deployment notes for static web and API, plus reverse-proxy fit.

## Why it fits Plesk (and beyond)
- Single Node process with no extra services; easy to run under Plesk’s Node support or as a proxied app.
- Pure JS output (`build/`); no binaries, so it migrates cleanly to other hosts (Docker, bare VM, serverless HTTP wrapper).
- Config-light: just set the command to `node build/index.js` (or `npm start`) and add a reverse proxy/path if serving over HTTP.

## Run locally (stdio MCP)
1. Install Node.js 18+.
2. Clone and install:
	- `git clone https://github.com/DavidJGrimsley/mrdj-app-mcp.git`
	- `cd mrdj-app-mcp && npm install`
3. Build: `npm run build`
4. Start the MCP server (stdio): `npm start`
5. Point your MCP-compatible client at the server per the official guide: https://modelcontextprotocol.io/docs/getting-started/intro

> Hosting over HTTP behind a URL (e.g., `DavidJGrimsley.com/mcp/mrdj-app-mcp`) will be documented after we add the HTTP transport wrapper and reverse proxy steps.

## Project layout
- `src/index.ts` — MCP server implementation
- `build/index.js` — compiled output
- `guides/` — domain guides exposed as MCP resources

## Contributing
- Open an issue or PR with a clear summary of the change you’re proposing.
- Keep guides concise, actionable, and source-linked when possible.
- Run `npm run build` before pushing to ensure the TypeScript build stays green.
- Be respectful in discussions; this project exists to share learnings.

### Shout-outs
Thanks to the folks whose teaching and tooling inspired this: @saimon24, @Galaxies-dev, @EvanBacon, @kacperkapusciak, @betomoedano, @expo, @kadikraman.
