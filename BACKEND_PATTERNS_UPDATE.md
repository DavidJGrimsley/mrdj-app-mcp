# Three Backend Patterns - Implementation Summary

## Overview

Updated the MCP system to clearly distinguish between three distinct backend/API deployment patterns:

1. **No Backend** - Static export using external services
2. **Expo Router API Routes** - API routes on same domain with server output
3. **External API** - Standalone API on subdomain

## Updated Files

### 1. pleskDeployment.md
Added overview section clarifying the three deployment patterns:
- **Pattern 1:** Static Web Only (No Backend)
- **Pattern 2:** Expo Router API Routes → redirects to pleskApiRoutesDeploy.md
- **Pattern 3:** External API (Subdomain) → documented in this file

### 2. project-info-template.md
Enhanced deployment section with:
- **Backend/API Pattern** - Checkbox to choose ONE pattern
- **Expo Router API Routes section** - Specific fields for this pattern
- **External API section** - Specific fields for subdomain pattern
- Clear guidance on which pattern to use

### 3. Checklist Items (buildChecklistItems)
Updated two checklist items:
- **deployment** - Now asks for backend pattern choice
- **api-backend** - New dedicated item for backend architecture validation

### 4. Deployment Preparation Tool
**Renamed:** `prepare-plesk-api-deployment` → `prepare-plesk-deployment`

**Enhanced functionality:**
- **Detects backend pattern** from project context
- **Pattern-specific validation:**
  - No backend: Minimal checks
  - Expo API routes: Full server.js + dependencies validation
  - External API: Subdomain configuration checks
- **Pattern-specific workflows:**
  - Different deployment steps for each pattern
  - Only shows relevant code examples
  - Links to appropriate guide

**New return value:** `backendPattern` - Indicates detected pattern

## Backend Pattern Detection

The tool automatically detects the backend pattern based on project context:

```typescript
// Pattern detection logic
if (hasText(/no backend|static only|external service/i)) {
  backendPattern = "none";
} else if (hasText(/expo.*api.*route|\+api\.ts|server output/i)) {
  backendPattern = "expo-api-routes";
} else if (hasText(/external api|api subdomain/i)) {
  backendPattern = "external-api";
} else {
  backendPattern = "unknown"; // User needs to specify
}
```

## Pattern-Specific Guidance

### No Backend (Static Only)
**When to use:**
- All data comes from external services (Supabase, Firebase, etc.)
- No custom backend logic needed
- Simple, fast deployment

**Deployment:**
```bash
# Set in app.json
"expo.web.output": "static"

# Build and deploy
npx expo export -p web
# Upload dist/ to /httpdocs
```

### Expo Router API Routes
**When to use:**
- Need custom API endpoints
- API logic tightly coupled with app
- Want API on same domain (e.g., `app.com/api/...`)

**Deployment:**
```bash
# Set in app.json
"expo.web.output": "server"

# Build
npx expo export -p web
# Creates dist/client/ and dist/server/

# Deploy
# Upload server.js + dist/ to Plesk Application Root
# Configure Node.js app in Plesk
```

**Guide:** [pleskApiRoutesDeploy.md](d:\SoftwareDev\MCPs\mrdj-app-mcp\guides\pleskApiRoutesDeploy.md)

### External API (Subdomain)
**When to use:**
- API is separate concern from front-end
- Need different tech stack (Python, etc.)
- Want API on subdomain (e.g., `api.domain.com`)
- Reusing existing backend across multiple apps

**Deployment:**
- Front-end: Static export to main domain `/httpdocs`
- API: Separate deployment to subdomain `/server`

**Guide:** [pleskDeployment.md](d:\SoftwareDev\MCPs\mrdj-app-mcp\guides\pleskDeployment.md)

## Usage Examples

### New Project Setup
```
1. Choose backend pattern in project/info.md:
   - [ ] No Backend
   - [x] Expo Router API Routes  <-- Check ONE
   - [ ] External API

2. Fill in pattern-specific details

3. Run: ingest-project-context
   → Validates template completeness

4. Run: project-preflight  
   → Checks backend pattern is specified

5. Run: prepare-plesk-deployment
   → Gets pattern-specific deployment guide
```

### Tool Output by Pattern

**Unknown pattern:**
```
Backend Pattern: **unknown**

⚠️ Backend Pattern Not Specified

You must choose ONE of these backend patterns:
1. No Backend (Static Only) - Guide: pleskDeployment.md
2. Expo Router API Routes - Guide: pleskApiRoutesDeploy.md  
3. External API (Subdomain) - Guide: pleskDeployment.md
```

**No backend:**
```
Backend Pattern: **none**

Static-Only Deployment Workflow:
1. ✅ Set `expo.web.output = 'static'` in app.json
2. ✅ Run `npx expo export -p web`
3. ✅ Verify `dist/` folder exists with index.html
4. ✅ Upload contents of `dist/` to `/httpdocs` in Plesk
5. ✅ Test: `https://your-domain.com/`

**No server required** - just static file hosting.
```

**Expo API routes:**
```
Backend Pattern: **expo-api-routes**

Expo API Routes Deployment Workflow:
1. ✅ Set `expo.web.output = 'server'` in app.json
2. ✅ Create/verify server.js with Express `'*'` pattern
3. ✅ Run `npx expo export -p web`
[... full server.js example and troubleshooting ...]
```

**External API:**
```
Backend Pattern: **external-api**

External API Deployment Workflow:
**Front-end (main domain):**
1. ✅ Set `expo.web.output = 'static'` in app.json
2. ✅ Run `npx expo export -p web`
3. ✅ Upload `dist/` contents to `/httpdocs`

**API (subdomain, e.g., api.domain.com):**
1. ✅ Build API server
2. ✅ Upload API files to `/server` on subdomain
3. ✅ Configure Plesk Node.js app on subdomain
[...]
```

## Validation Checklist

The tool validates different items based on pattern:

| Checklist Item | No Backend | Expo API Routes | External API |
|----------------|------------|-----------------|--------------|
| Backend pattern specified | ✅ | ✅ | ✅ |
| web output = 'server' | ➖ N/A | ✅ | ➖ N/A |
| +api.ts files present | ➖ N/A | ✅ | ➖ N/A |
| server.js wildcard | ➖ N/A | ✅ | ➖ N/A |
| Express dependencies | ➖ N/A | ✅ | ➖ N/A |
| Build artifacts | ➖ N/A | ✅ | ➖ N/A |
| Subdomain configured | ➖ N/A | ➖ N/A | ✅ |
| Domain specified | ✅ | ✅ | ✅ |

## Benefits

1. **Clear Separation:** No more confusion between Expo API routes vs external APIs
2. **Pattern-Specific Guidance:** Only see relevant steps for your chosen pattern
3. **Early Validation:** Catch missing backend pattern specification early
4. **Reduced Errors:** Pattern detection prevents mixing incompatible configurations
5. **Better Documentation:** Project templates clearly separate the three patterns

## Migration Notes

If you have existing projects:
- **Static apps:** Update project/info.md to mark "No Backend"
- **With +api.ts files:** Mark "Expo Router API Routes"  
- **With api.domain.com:** Mark "External API"

Then run `ingest-project-context` to validate.

## Tool Renaming

- **Old:** `prepare-plesk-api-deployment`
- **New:** `prepare-plesk-deployment`

Renamed to reflect that it now handles all three patterns, not just API routes.
