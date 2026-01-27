# Plesk API Routes Deployment - Implementation Summary

## Overview
This document summarizes the comprehensive updates made to the mrdj-app-mcp system to support Expo Router API routes deployment to Plesk VPS.

## Changes Made

### 1. New Deployment Guide
**File:** `guides/pleskApiRoutesDeploy.md`

Created a detailed, authoritative guide for deploying Expo Router apps with API routes (server output mode) to Plesk. Key sections include:
- **Critical Issue** highlighting the #1 deployment blocker (Express wildcard syntax)
- Complete working `server.js` example
- Step-by-step deployment checklist
- Plesk Node.js configuration settings
- Comprehensive troubleshooting section
- Comparison table: static vs server output modes

### 2. Updated Project Info Template
**File:** `project/project-info-template.md`

Added comprehensive deployment sections:
- **Platform & Hosting** - Target platform and hosting service
- **Web Configuration** - Build commands and output modes
- **API Routes** - Backend framework, endpoints, authentication
- **Database & Storage** - Connection details and migrations
- **Environment & Dependencies** - Node version, env vars, external services
- **Deployment Notes** - Special steps and monitoring

### 3. Enhanced Preflight Checklist
**File:** `src/tools.ts` - `buildChecklistItems()` function

Added two new checklist items:
- **deployment** - Enhanced to detect API routes and server output mode
- **api-routes** - New dedicated item for API routes validation
  - Detects `+api.ts` files
  - Validates `expo.web.output = 'server'` configuration
  - Checks for correct `server.js` Express wildcard pattern

### 4. Updated `ingest-project-context` Tool
**File:** `src/tools.ts`

Enhanced to handle both `.txt` and `.md` files:
- **Priority:** Checks for `.md` files first, then falls back to `.txt`
- **Validation:** New `validateTemplate` parameter (default: true)
- **Template Validation:** Validates against project templates
- **Reports:**
  - Missing sections
  - Incomplete sections (placeholders/TODOs)
  - Validation status for both info and style files

### 5. New Deployment Preparation Tool
**Tool Name:** `prepare-plesk-api-deployment`
**File:** `src/tools.ts`

Comprehensive deployment preparation assistant that:
- **Analyzes** project context for deployment readiness
- **Validates** all critical configuration items:
  - `app.json` web output mode
  - `server.js` syntax correctness
  - Required dependencies
  - Build artifact structure
  - Plesk configuration
- **Provides** step-by-step deployment workflow
- **Includes** complete code examples (server.js, package.json)
- **Lists** common issues and solutions

### 6. New Helper Functions
**File:** `src/tools.ts`

Added three utility functions:
- `validateProjectInfo()` - Validates project info markdown against template
- `validateProjectStyle()` - Validates project style markdown against template
- `buildPleskApiDeploymentChecklist()` - Generates deployment readiness checklist

### 7. Guide Registry Updates
**File:** `src/index.ts`

Added new guide to the registry:
```typescript
{
  id: "plesk-api-routes-deploy",
  title: "Plesk API Routes Deploy",
  fileName: "pleskApiRoutesDeploy.md",
  description: "Critical guide for deploying Expo Router apps with API routes (server output) to Plesk VPS."
}
```

Also added missing guides (icons, pwa, backend-best-practices) to ensure complete coverage.

### 8. Guide Index Update
**File:** `guides/index.md`

Added links to:
- `pleskApiRoutesDeploy.md` - Expo Router API routes deployment
- `metaTags.md` - SEO and meta tags
- `offlineFirst.md` - Offline-first architecture
- `typeCheckAndLint.md` - TypeScript and ESLint
- `backendBestPractices.md` - API design and security

## Usage Examples

### For Users Starting New Projects

1. **Fill out project templates:**
   ```
   project/info.md  (use the updated template with deployment sections)
   project/style.md
   ```

2. **Run ingest-project-context:**
   ```typescript
   // Validates templates and reports missing/incomplete sections
   mcp-tool: ingest-project-context
   ```

3. **Run preflight checklist:**
   ```typescript
   // Checks all requirements including deployment configuration
   mcp-tool: project-preflight
   ```

4. **Prepare for deployment:**
   ```typescript
   // Gets comprehensive deployment checklist and guide
   mcp-tool: prepare-plesk-api-deployment
   ```

### For Expo Router API Routes Projects

When deploying an Expo app with API routes:

1. Ensure `app.json` has:
   ```json
   {
     "expo": {
       "web": {
         "output": "server"
       }
     }
   }
   ```

2. Create `server.js` with **correct Express wildcard**:
   ```javascript
   // ✅ CORRECT
   app.all('*', createRequestHandler({ build: SERVER_BUILD_DIR }));
   
   // ❌ WRONG - This breaks routing!
   app.all('/{*all}', createRequestHandler({ build: SERVER_BUILD_DIR }));
   ```

3. Run the deployment prep tool:
   ```typescript
   mcp-tool: prepare-plesk-api-deployment
   ```

4. Follow the generated checklist and workflow.

## Key Benefits

1. **Prevents Common Mistakes:**
   - Automatically detects missing `expo.web.output = 'server'`
   - Validates Express wildcard syntax in server.js
   - Ensures all dependencies are listed

2. **Template Validation:**
   - Catches incomplete project documentation early
   - Ensures deployment sections are filled out
   - Reduces back-and-forth during deployment

3. **Comprehensive Guidance:**
   - Step-by-step deployment workflow
   - Complete code examples
   - Troubleshooting for common issues

4. **Flexible File Formats:**
   - Supports both .txt and .md formats
   - Prioritizes .md for better structure
   - Converts .txt to .md automatically

5. **Integrated Workflow:**
   - Preflight checklist includes deployment validation
   - Project instructions include deployment context
   - TODO generation considers deployment tasks

## Testing Recommendations

Before deploying to production:
1. Run `prepare-plesk-api-deployment` locally
2. Verify all checklist items are ✅
3. Test `server.js` locally: `node server.js`
4. Build: `npx expo export -p web`
5. Verify `dist/client/` and `dist/server/` exist
6. Upload to Plesk staging environment first
7. Test all routes and API endpoints
8. Review Plesk logs for errors
9. Deploy to production

## Future Enhancements

Potential additions:
- Automated server.js generation based on project config
- Deployment script generator for automated uploads
- Environment variable validation
- Database migration checklist
- Health check endpoint generator
- CI/CD pipeline templates for Plesk deployment

## Documentation References

- Full deployment guide: `guides/pleskApiRoutesDeploy.md`
- General Plesk deployment: `guides/pleskDeployment.md`
- Project template: `project/project-info-template.md`
- Tool implementation: `src/tools.ts` (lines 1690-2350)

## Conclusion

These updates provide a complete, validated workflow for deploying Expo Router apps with API routes to Plesk VPS. The system now catches configuration errors early, validates project documentation completeness, and provides comprehensive deployment guidance—significantly reducing deployment failures and support requests.
