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

Add to your NGINX site config (typically `/etc/nginx/sites-available/davidjgrimsley.com`):

```nginx
location /mcp/mrdj-app-mcp/ {
    proxy_pass http://localhost:4000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # SSE support
    proxy_buffering off;
    proxy_read_timeout 86400;
}
```

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**5. Verify deployment**
```bash
# Health check
curl https://DavidJGrimsley.com/mcp/mrdj-app-mcp/health

# Should return: {"status":"ok","service":"mrdj-app-mcp","version":"0.1.0"}
```

### Using the HTTP endpoint in MCP clients

Configure your MCP client to connect to:
```
https://DavidJGrimsley.com/mcp/mrdj-app-mcp/mcp
```

The server provides open access (no authentication) so anyone can use the guides in their IDE or MCP-compatible tools.

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
