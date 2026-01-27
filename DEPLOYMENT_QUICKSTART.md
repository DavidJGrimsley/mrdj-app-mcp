# Quick Start: Deploying Expo Router API Routes to Plesk

## 🎯 The One Thing You Must Get Right

**In `server.js`, use Express wildcard `'*'` NOT Expo Router `'/{*all}'`:**

```javascript
// ✅ CORRECT
app.all('*', createRequestHandler({ build: SERVER_BUILD_DIR }));

// ❌ WRONG - This breaks everything!
app.all('/{*all}', createRequestHandler({ build: SERVER_BUILD_DIR }));
```

## ⚡ Pre-Deployment Checklist (30 seconds)

Run this MCP tool to validate your project:
```
prepare-plesk-api-deployment
```

It checks:
- ✅ `app.json` has `expo.web.output = 'server'`
- ✅ `server.js` uses correct Express syntax
- ✅ Dependencies include: express, expo-server, compression, morgan
- ✅ Build will produce `dist/client/` and `dist/server/`
- ✅ Plesk settings are documented
- ✅ Domain is configured

## 🚀 Deployment Workflow

### 1. Local Build
```bash
npx expo export -p web
```

**Verify:**
- `dist/client/` exists (assets, NO index.html)
- `dist/server/` exists (server bundles)

### 2. Upload to Plesk
Upload these files to Application Root:
- `server.js`
- `package.json`
- `package-lock.json`
- `dist/` (entire folder)

### 3. Configure Plesk Node.js
**One-time setup:**
- Node.js Version: 23.11.1 (or latest)
- Document Root: `/dist/client`
- Application Root: `/`
- Startup File: `server.js`
- Environment: `NODE_ENV=production`

### 4. Install & Start
1. Click **NPM install** in Plesk
2. Click **Restart App**

### 5. Test
- Root: `https://your-domain.com/`
- API: `https://your-domain.com/api/[endpoint]`

## 🔧 Common Issues

### 404 on all routes?
1. Check `server.js` uses `app.all('*', ...)`
2. Verify `dist/client/` and `dist/server/` exist
3. Check Plesk logs

### "Cannot find module" errors?
1. Run **NPM install** in Plesk
2. Verify `package.json` was uploaded

### Static files not loading?
1. Document Root should be `/dist/client`
2. Application Root should be `/`

## 📚 Full Documentation

For detailed information, see:
- Complete guide: `guides/pleskApiRoutesDeploy.md`
- Tool: `prepare-plesk-api-deployment`
- Updated template: `project/project-info-template.md`

## 💡 Pro Tips

1. **Test locally first:**
   ```bash
   node server.js
   # Visit http://localhost:3000
   ```

2. **Use preflight checklist:**
   ```
   project-preflight
   ```
   Catches deployment issues in project docs.

3. **Validate project context:**
   ```
   ingest-project-context
   ```
   Ensures deployment sections are complete.

4. **After updates:**
   - Upload changed files
   - Click **Restart App** in Plesk
   - NO need to run NPM install unless dependencies changed

5. **Monitor logs:**
   - Plesk → Logs shows startup errors
   - Add console.log statements to server.js for debugging

## 🎓 Understanding Server vs Static Mode

| Aspect | Static | Server (API Routes) |
|--------|--------|---------------------|
| Output mode | `"static"` | `"server"` |
| Build result | `dist/` with index.html | `dist/client/` + `dist/server/` |
| Routing | Client-side only | Server-side + client |
| API routes | ❌ Not supported | ✅ Fully supported |
| Hosting | Static files | Node.js required |
| Plesk setup | File upload | Node.js app config |

## ✅ Success Checklist

Before going live:
- [ ] Local test passes (both `/` and `/api/...` work)
- [ ] `dist/client/` and `dist/server/` verified
- [ ] `server.js` uses `app.all('*', ...)`
- [ ] Plesk settings match guide
- [ ] NPM install completed successfully
- [ ] App restarted in Plesk
- [ ] Production URLs tested
- [ ] Logs show no errors
