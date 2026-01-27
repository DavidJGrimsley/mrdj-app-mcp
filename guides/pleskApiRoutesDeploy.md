# Plesk API Routes Deployment (Expo Router + Server Output)

**Critical Guide for Deploying Expo Router Apps with API Routes to Plesk VPS**

## 🎯 The #1 Issue That Breaks Deployment

**Using Expo Router syntax in Express route handler**

In `server.js`, the catch-all route MUST use Express syntax:

```javascript
// ❌ WRONG - Expo Router syntax doesn't work in Express
app.all('/{*all}', createRequestHandler({ build: SERVER_BUILD_DIR }));

// ✅ CORRECT - Express wildcard syntax
app.all('*', createRequestHandler({ build: SERVER_BUILD_DIR }));
```

Also remove `extensions: ['html']` from express.static options - it can interfere with routing.

## Complete Working server.js

```javascript
#!/usr/bin/env node

const path = require('path');
const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const { createRequestHandler } = require('expo-server/adapter/express');

const CLIENT_BUILD_DIR = path.join(process.cwd(), 'dist/client');
const SERVER_BUILD_DIR = path.join(process.cwd(), 'dist/server');

const app = express();

app.use(compression());
app.disable('x-powered-by');
app.use(morgan('tiny'));

// Serve static files from client build
app.use(express.static(CLIENT_BUILD_DIR, { maxAge: '1h' }));

// Handle all remaining requests through Expo Router
app.all('*', createRequestHandler({
  build: SERVER_BUILD_DIR,
}));

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

## Prerequisites Checklist

- [ ] Expo Router with API routes (`+api.ts` files)
- [ ] `app.json` → `expo.web.output = "server"`
- [ ] Correct `server.js` with `'*'` route pattern
- [ ] Dependencies: `express`, `compression`, `morgan`, `expo-server`

## Step 1: Local Build

1. **Ensure web output is server:**
   - In `app.json`: set `expo.web.output = "server"`

2. **Build web export:**
   ```bash
   npx expo export -p web
   ```

3. **Confirm build artifacts exist:**
   - `dist/client/` folder (contains assets, NO index.html - this is normal for server mode!)
   - `dist/server/` folder (contains server bundles)

**IMPORTANT:** Server output mode does NOT generate `index.html`. All routing is handled by `server.js`.

## Step 2: Files to Upload to Plesk

Upload **these exact files** into the Application Root folder:
- `server.js`
- `package.json`
- `package-lock.json`
- `dist/` (entire folder with client/ and server/ subfolders)

Do **not** rely on older `server.js` or `package.json` in the home directory. Replace with current ones.

## Step 3: Plesk Node.js Settings

In Plesk → Domains → your domain → Node.js:

**Confirmed Working Settings:**
- **Node.js Version:** 23.11.1 (or latest available)
- **Package Manager:** npm
- **Document Root:** `/dist/client`
- **Application Root:** `/` (root of domain folder containing server.js and dist/)
- **Application Startup File:** `server.js`
- **Application Mode:** production
- **Custom Environment Variables:**
  - `NODE_ENV=production`

**IMPORTANT:** After initial setup:
1. Upload updated files (if you made changes)
2. Click **Restart App**

**Only run NPM install if:**
- First deployment
- Dependencies changed in package.json
- Plesk logs show "Cannot find module" errors

## Step 4: Testing

Test locally first:
```bash
# From project root
node server.js

# Then visit http://localhost:3000
# Both / and /api/content should work
```

If it works locally but not on Plesk, the issue is Plesk configuration, not your code.

Production test:
- `https://your-domain.com/` should load the app
- `https://your-domain.com/api/content` (or your endpoint) should return JSON

## Troubleshooting 404 Errors

If you see `404 Not Found` for `/` and `/api/content`:

**FIRST:** Check your `server.js` route pattern!
```javascript
// Must be this:
app.all('*', createRequestHandler({ build: SERVER_BUILD_DIR }));

// NOT this:
app.all('/{*all}', createRequestHandler({ build: SERVER_BUILD_DIR }));
```

**Other checks:**
1. Verify `dist/client/` folder exists (no index.html needed - server handles routing!)
2. Verify `dist/server/` folder exists with compiled bundles
3. Confirm Plesk Application Root points to folder containing `server.js` and `dist/`
4. Check Plesk **Logs** for startup errors (common: missing dependencies)
5. If logs show "Cannot find module", run **NPM install** in Plesk

## Folder Management

- The `source` folder is not needed unless your **Application Root** points to it. If you are not using it, you can delete it.
- System files like `.node-version`, `.php-version`, `.php.ini`, `.imunify_*` should be kept.
- Keep `dist/` in the Application Root with both `client/` and `server/` subfolders

## Mobile App Integration

Nothing here blocks mobile. When ready to build native apps:
1. Set Expo Router `origin` in app.json to your deployed URL
2. Native builds will reach your API routes at the production URL
3. Example: `"expo": { "origin": "https://your-domain.com" }`

## Deployment Workflow Summary

1. ✅ Set `expo.web.output = "server"` in app.json
2. ✅ Create/verify `server.js` with Express `'*'` pattern
3. ✅ Run `npx expo export -p web`
4. ✅ Upload `server.js`, `package.json`, `package-lock.json`, `dist/` to Plesk
5. ✅ Configure Plesk Node.js settings (one-time)
6. ✅ Run **NPM install** in Plesk (first time / when deps change)
7. ✅ Click **Restart App**
8. ✅ Test both routes and API endpoints

## Key Differences from Static Deployment

| Aspect | Static Export | Server Output (API Routes) |
|--------|---------------|----------------------------|
| app.json output | `"static"` or `"single"` | `"server"` |
| Build artifact | `dist/` with index.html | `dist/client/` + `dist/server/` (no index.html) |
| Routing | Client-side only | Server-side + client-side |
| API Routes | Not supported | ✅ Fully supported |
| Server Required | No (static files only) | Yes (Node.js/Express) |
| Plesk Setup | File Manager upload | Node.js app configuration |
