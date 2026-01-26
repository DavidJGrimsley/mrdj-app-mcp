# mrdj-app-mcp
This is running on my VPS and can be used in any client like VS Code at [davidjgrimsley.com/public-facing/mcp/mrdj-app-mcp/mcp](https://davidjgrimsley.com/public-facing/mcp/mrdj-app-mcp/mcp). There is a more in-depth info page at [davidjgrimsley.com/mcp/mrdj-app-mcp](https://davidjgrimsley.com/mcp/mrdj-app-mcp).

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
- Styling: UniWind setup, tokens/theming in CSS, responsive/theming approaches (this MCP originally supported NativeWind).
- Routing: Expo Router conventions, file-based routes, guards, deep linking.
- Animation: Reanimated 4 guidance (worklets, transitions, thread separation).
- Performance & SEO: startup, rerender control, list tuning, compiler hints, metadata.
- Build scripts: local build/export scripts, sitemap generation, API build.
- Deployment: Plesk deployment notes for static web and API, plus reverse-proxy fit.

## Docs lookup tools
This MCP includes lightweight tools for quick docs lookups during chat/code review:
- `smart-help` auto-selects relevant guides + docs sources and searches them (recommended)
- `list-docs` lists known docs sources by id
- `search-docs` searches those docs by id + query (no URL copy/paste)
- `fetch-web-doc` fetches/searches an arbitrary docs URL (fallback)

## Project audit / conversion tools

## Project context (business + style)
Store high-level project intent and styling tokens in the top-level project/ folder:
- project/info.md (business goals, audience, outcomes, app type)
- project/style.md (fonts, color codes, spacing, component tone)

The generate-project-instructions tool reads these files (falls back to project/info.txt and project/style.txt if needed) and merges them with the guides into .github/copilot-instructions.md.

The generate-project-todo tool builds project/TODO.md from project/info.md + project/style.md. It extracts:
- **Features, flows, and entities** from project/info.md
- **Style tokens** (colors, fonts, spacing) from project/style.md
- **Navigation pattern** (tabs, drawer, stack, or hybrid) inferred from project description
- **Proposed file structure** (src/app/ layout with _layout.tsx files, feature groups, auth, etc.)

This helps you kickstart development with a holistic plan that includes design system work + routing skeleton from day one.

### Project intake + full build prompts
- `ingest-project-context` converts project/info.txt + project/style.txt into markdown and deletes the .txt files by default.
- Prompt `project-intake` runs ingestion, generates project/TODO.md, then regenerates copilot instructions.
- Prompt `full-app-build` summarizes context, asks clarifying questions once, then auto-starts tasks after answers (references project/TODO.md when present).

### `convert-styling` (Uniwind)
Scans a target project for styling usage and checks it against the local Uniwind styling guide (`guides/styling.md`).

It can also apply a small set of **safe, mechanical** migration steps (dry-run by default):
- Removes `nativewind/babel` from `babel.config.*` (best-effort)
- Best-effort updates `metro.config.*` from NativeWind → Uniwind naming
- Normalizes `global.css` to Tailwind 4 + Uniwind imports (`@import 'tailwindcss';` and `@import 'uniwind';`)
- Deletes `nativewind.d.ts` (when `apply=true`)

It will also *report* (but not auto-convert) items that usually require manual edits:
- `StyleSheet.create()` usage
- Runtime NativeWind APIs (`ThemeProvider`, `cssInterop`, `styled`, etc.)
- Non-trivial Tailwind/NativeWind config migration

#### In-memory mode ("Add file to chat")
Some MCP clients (including VS Code) can attach files into chat context, but the MCP server process may not have filesystem access to your repo (especially when using a remote HTTP/SSE server).

To support that workflow, `convert-styling` also accepts an in-memory `files` array:
- `files`: `[{ path, content }]` (path is just a label; workspace-relative is ideal)
- `basePath`: optional label (e.g. repo name)

When `files` is provided:
- `projectRoot` is ignored
- `apply=true` returns an edit bundle (it does not write to disk)

This is best for converting a handful of files you’ve attached to chat. It is not practical for whole-repo migrations due to message size limits.

## How to use tools
These are MCP tools exposed by this server. In an MCP-enabled chat client (VS Code Copilot Chat, etc.), you typically don’t “run commands” directly — you ask the assistant to call the tool with specific inputs.

Note: your MCP client chooses when to invoke tools automatically. If you want “automatic mode” every time, use `smart-help` as the single entrypoint.

### Common workflows

**0) Automatic mode (recommended)**
- Ask the assistant to run `smart-help` with your question.
- Ex: “Run smart-help with question: ‘How should we structure Expo Router layouts for auth gating?’”
- It will:
  - pick the relevant guide(s) in `guides/`
  - query the most relevant live docs sources
  - return guide excerpts + doc snippets

**1) Find the right docs id**
- Ask the assistant to run `list-docs`.
- Pick the `docId` you want (e.g. `uniwind`, `nativewind`, `expo-router`).

**2) Search those docs without pasting URLs**
- Ask the assistant to run `search-docs` with:
  - `docId`: one of the ids from `list-docs`
  - `query`: a keyword/phrase to search for
  - Optional: `maxMatchesPerUrl` (default 5) and `maxUrls` (default: all registered for that doc)

**3) Fallback for an unregistered doc page**
- Ask the assistant to run `fetch-web-doc` with:
  - `url`: any public `https://...` docs URL
  - Optional: `query` and `maxMatches`

### Example prompts (copy/paste)

- “Run `smart-help` with `question=How do I migrate cssInterop from NativeWind to Uniwind?`”
- “Run `smart-help` with `question=What is the right Expo Router layout for auth gating?`”
- “Run `list-docs` and show me the available `docId`s.”
- “Run `search-docs` with `docId=uniwind` and `query=ThemeProvider`.”
- “Run `search-docs` with `docId=nativewind` and `query=cssInterop` (maxUrls=2).”
- “Run `fetch-web-doc` for `https://docs.uniwind.dev/migration-from-nativewind` and search for `rem` (maxMatches=5).”
- “Run `convert-styling` (dry-run) with `projectRoot=/absolute/path/to/my-app`.”
- “Run `convert-styling` with `projectRoot=/absolute/path/to/my-app` and `apply=true`.”

### Choosing what project gets scanned
`convert-styling` defaults to scanning:
- `MCP_PROJECT_ROOT` if set, else
- the server process working directory

To set a default root when starting the server:
- `node build/index.js --project-root /absolute/path/to/my-app`
- `pm2 start build/index.js --name mrdj-app-mcp -- --http-port 4000 --project-root /absolute/path/to/my-app`

### Guide resources vs tools
This server also exposes the Markdown guides in `guides/` as MCP **resources**.

- Use the tool `list-guides` to see what guides are available.
- Then open/read a guide via your client’s “readResource” flow (varies by client).

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

## Run as HTTP/SSE server (for remote access)

The server supports HTTP transport with Server-Sent Events (SSE) for remote MCP access.

### Local testing
```bash
npm run build
npm run start:http  # Starts on port 4000
# Test: curl http://localhost:4000/health
```

### VPS deployment (e.g., `/home/deployer/mrdj-app-mcp`)

**1. Copy files to VPS**
```bash
# From your local machine
scp -r build/ guides/ package*.json deployer@DavidJGrimsley.com:/home/deployer/mrdj-app-mcp/
```

**2. Install dependencies on VPS**
```bash
ssh deployer@DavidJGrimsley.com
cd /home/deployer/mrdj-app-mcp
npm ci --production
```

**3. Start with PM2**
```bash
pm2 start build/index.js --name mrdj-app-mcp -- --http-port 4000
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

**4. Configure NGINX reverse proxy**

Add to your NGINX site config (typically `/etc/nginx/sites-available/yourdomain.com`):

```nginx
# MCP endpoint (Streamable HTTP + SSE)
location /public-facing/mcp/mrdj-app-mcp/mcp {
    proxy_pass http://localhost:4000/mcp;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # SSE support - critical for MCP
    proxy_buffering off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;

    # CORS headers
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS' always;
    add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;
}

# SSE message POST endpoint (required for legacy SSE transport)
location /public-facing/mcp/mrdj-app-mcp/messages {
    proxy_pass http://localhost:4000/mcp/messages;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Don't buffer - SSE transport needs raw stream
    proxy_buffering off;
    
    add_header Access-Control-Allow-Origin * always;
}

# Health check endpoint
location /public-facing/mcp/mrdj-app-mcp/health {
    proxy_pass http://localhost:4000/health;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}
```

> **Important**: The `/messages` endpoint is critical! MCP clients using SSE transport will POST messages to this path. Without it, you'll see "Cannot POST /mcp/messages" errors.

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**5. Verify deployment**
```bash
# Health check
curl https://yourdomain.com/public-facing/mcp/mrdj-app-mcp/health

# Should return: {"status":"ok","service":"mrdj-app-mcp","version":"0.1.0"}
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Cannot POST /mcp/messages" | Missing `/messages` nginx location | Add the messages endpoint proxy (see nginx config above) |
| "Session not found" | Session ID mismatch | Ensure nginx passes query params to `/mcp/messages` |
| "stream is not readable" | Body parser consuming stream | Server skips JSON parsing for `/messages` routes automatically |
| Connection drops after ~60s | Proxy timeout | Set `proxy_read_timeout 86400s` in nginx; server sends heartbeats every 30s |

### Using the HTTP endpoint in MCP clients

Configure your MCP client to connect to:
```
https://yourdomain.com/public-facing/mcp/mrdj-app-mcp/mcp
```

**VS Code example** (in `.vscode/mcp.json` or user settings):
```json
{
  "servers": {
    "mrdj-app-mcp": {
      "type": "sse",
      "url": "https://yourdomain.com/public-facing/mcp/mrdj-app-mcp/mcp"
    }
  }
}
```

The server provides open access (no authentication) so anyone can use the guides in their IDE or MCP-compatible tools.

## Project layout
- `src/index.ts` — MCP server implementation
- `src/convertStyling.ts` — best-effort styling audit + Uniwind migration tool
- `build/index.js` — compiled output
- `guides/` — domain guides exposed as MCP resources

## Contributing
- Open an issue or PR with a clear summary of the change you’re proposing.
- Keep guides concise, actionable, and source-linked when possible.
- Run `npm run build` before pushing to ensure the TypeScript build stays green.
- Be respectful in discussions; this project exists to share learnings.

### Shout-outs
Thanks to the folks whose teaching and tooling inspired this: @saimon24, @Galaxies-dev, @EvanBacon, @kacperkapusciak, @betomoedano, @expo, @kadikraman.
