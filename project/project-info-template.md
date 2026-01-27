# Project Information Template

## App Name
- [Your App Name Here]

## Overview
- Brief description of the app/website and its purpose.
- What problem does it solve? Who is it for?

## Unique Value Proposition
- What makes this project different from competitors?
- Key features or philosophies that set it apart.

## User Types
- List and describe all user types (e.g., Candidate, Employer, Admin, etc.)

## Core Principles
- List the guiding principles or rules for the platform (e.g., interview limits, communication policies, feedback requirements, etc.)

## Key Terms & Entities
- Define all important terms and entities (e.g., Candidate, Employer, Company, Job, Task, etc.)

## User Flows
- Describe the main user journeys (e.g., how a candidate gets matched, how an employer posts a job, etc.)

## Features
- List and briefly describe all major features (e.g., auto-apply, profile-based matching, company verification, etc.)

## Integration & Compliance
- Any integrations (e.g., LinkedIn, ATS) or compliance requirements (e.g., verification, feedback, etc.)

## Admin & Moderation
- How are admins assigned? What are their powers and responsibilities?

## Deployment

### Platform & Hosting
- **Target Platform:** [Web / Mobile / Both / Desktop]
- **Hosting Service:** [Plesk / Vercel / Netlify / EAS / Other]
- **Domain:** [your-domain.com]

### Backend/API Pattern (choose one)
- **[ ] No Backend** - Static export only, all data from external services (Firebase, Supabase, etc.)
- **[ ] Expo Router API Routes** - API routes on same domain using server output mode
- **[ ] External API** - Standalone API on subdomain (e.g., api.domain.com)

### Web Configuration (if applicable)
- **Web Output Mode:** [static / server (required for Expo API routes)]
- **Build Command:** [npx expo export -p web / custom]
- **Deployment Folder:** [dist / build / out]

### Expo Router API Routes (if using this pattern)
- **Server Output Mode:** [✅ expo.web.output = "server" in app.json]
- **Server File:** [server.js with Express wildcard '*' pattern]
- **API Endpoints:**
  - `/api/endpoint1` - Description
  - `/api/endpoint2` - Description
- **Dependencies:** [express, expo-server, compression, morgan]
- **Deployment Guide:** See pleskApiRoutesDeploy.md

### External API (if using this pattern)
- **API Subdomain:** [api.your-domain.com]
- **Backend Framework:** [Express / Fastify / Flask / FastAPI / Other]
- **API Server File:** [api-server.js / app.py / etc.]
- **Build Process:** [Custom build scripts / Docker / etc.]
- **API Endpoints:**
  - `https://api.domain.com/endpoint1` - Description
  - `https://api.domain.com/endpoint2` - Description
- **Deployment Location:** [/server on subdomain / /home/deployer/[repo] / etc.]
- **Deployment Guide:** See pleskDeployment.md

### Database & Storage
- **Database:** [Supabase / PostgreSQL / MySQL / MongoDB / None]
- **Connection:** [Details or env vars needed]
- **Migrations:** [How schema is managed]
- **File Storage:** [S3 / Cloudinary / Supabase Storage / None]

### API Authentication & Security (if using any backend)
- **Authentication Method:** [JWT / Session / API Key / OAuth / None]
- **Authorization:** [Role-based / Permission-based / Public]
- **CORS Configuration:** [Allowed origins]
- **Rate Limiting:** [If applicable]

### Environment & Dependencies
- **Node.js Version:** [18.x / 20.x / 22.x / latest]
- **Required Environment Variables:**
  - `VAR_NAME` - Description
  - `VAR_NAME_2` - Description
- **External Services:** [List any third-party APIs or services]
- **Rate Limiting:** [If applicable]

### Deployment Notes
- **Special Steps:** [Any unique deployment requirements]
- **Post-Deployment:** [Tasks to run after deployment]
- **Monitoring:** [Health check endpoints, logging setup]

## Additional Notes
- Any other relevant information, edge cases, or future plans.

---

*Expand each section as needed for your specific project. This template is designed to be comprehensive and adaptable for most app/platform projects.*
