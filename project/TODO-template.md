# Project TODO

Generated from project/info.md + project/style.md.

## App Snapshot
- App type: web + mobile + desktop

## Milestones
- [x] M1 — Foundations: routing skeleton, design tokens, auth shell, environment config
- [ ] M2 — Data layer: Drizzle schemas, migrations, Supabase setup + RLS policies, seed data
- [x] M3 — Core features: implement feature backlog + core flows
- [ ] M4 — Backend APIs: Expo API routes + server-side data access + client integration
- [ ] M5 — Polish & release: performance, QA, deployment, analytics

## Design System & Theming (Early)
- [x] Translate project/style.md into global.css @layer theme tokens (Blaze Orange + Steel Azure)
- [x] Wire typography (Noto family + Cinzel Decorative) in global.css and layout
- [x] Implement updated color tokens from style.md
- [x] Define UI variants: buttons (primary/secondary/ghost), inputs (default/error/disabled), cards (default/soft/outlined)

## File Routing & Structure (M1)
- [x] Navigation pattern: **drawer + top tabs** (Drawer for main sections, TopTabs for Explore subsections)
- [x] Current app structure:
    app/
      _layout.tsx (root, providers)
      +html.tsx (web entry)
      (drawer)/ (drawer navigator)
        _layout.tsx (drawer with VerticalDrawerBar for desktop web)
        index.tsx (home)
        explore/
          _layout.tsx (TopTabs: Explore | Create)
          index.tsx (explore feed)
          create.tsx (create project)
        projects/ (placeholder)
        content/ (placeholder)
        interests/ (interests preferences)
        account/ (user settings)
      auth/ (sign-in, sign-up)
      profile/ (user profiles)
- [x] VerticalDrawerBar component with Reanimated hover animations (web-only)
- [x] TopTabs component with hover states and prefix-based active routing
- [x] Implement remaining feature sections (Projects, Content, Interests)
- [x] Rename Match section to Interests (route + labels)
- [x] Build auth guards for protected routes
- [x] Set up deep linking configuration

## Feature Backlog

### Navigation & UI (Current Priority)
- [x] VerticalDrawerBar with dynamic items prop
- [x] TopTabs component for section-level navigation
- [x] Reanimated 4 hover animations on VerticalDrawerBar
- [x] Implement Explore feed (content discovery)
- [x] Implement Create project wizard

### Interests System (Feed Personalization)
- [ ] Design Interests preferences UI (roles, skills, genres, availability, location)
- [ ] Implement preference storage (user profile/settings)
- [ ] Build Explore feed filtering algorithm based on Interests preferences
- [ ] Add Interests score/ranking system for content recommendations
- [ ] Create Interests analytics (show why content was recommended)

### Gamification & Creative Points
- [ ] Define Creative Points earn/spend rules (posting content, starting projects, collab milestones)
- [ ] Add levels + unlock perks (visibility boosts, badges, access tiers)
- [ ] Implement XP decay for inactivity (visibility tapering)
- [ ] Add peer reviews after collaborations with XP modifiers
- [ ] Add seasonal challenges with XP multipliers

### Content & Engagement Tracking
- [ ] Define Content Post as external link (YouTube/Twitch/X/etc.) with rich previews
- [ ] Track outbound link clicks + dwell time as baseline engagement signals
- [ ] Implement platform API integrations where available (YouTube/Twitch/X) for verified engagement
- [ ] Add fallback verification (creator-confirmed engagement + community signals)
- [ ] Add anti-gaming rules (rate limits, uniqueness checks, suspicious activity flags)

### Core Platform Features
- [x] Implement Workspace (project container with tasks, files, chat, collaborators)
- [x] Implement Project entity (creative initiative with goals, contributors, outputs)
- [x] Build Content Post feature (external link sharing with rich previews)
- [x] Implement Boost system (visibility powered by Creative Points)
- [x] Build Creative Points economy (earn/spend mechanics)
- [x] Implement Reputation Score system
- [x] Build Pay Split feature (revenue distribution)
- [x] Build project workspaces (tasks, milestones, versioning)
- [x] Implement media asset storage and review tools
- [x] Build real-time communication (chat, voice, video)
- [x] Implement content sharing with engagement tracking
- [x] Build engagement-based boosting
- [x] Create analytics dashboards
- [ ] Implement monetization (subscriptions, tips, sales, memberships)
- [ ] Add AI tools (content adaptation, moderation, insights)
- [ ] Build integrations (creative tools, cloud storage, code repos)
- [ ] Implement payment processing (Stripe, PayPal)
- [ ] Add GDPR/CCPA compliance features

### Ads & Monetization (Hybrid: David's + External)
- [ ] **David's Portfolio Ads Setup**
  - [ ] Copy reference implementation from MCP: `mcp_mrdj-app-mcp_copy-ads-code`
  - [ ] Create `/api/ads/sponsored-content` endpoint (self-hosted ads data)
  - [ ] Implement adsService.ts with offline-first caching (AsyncStorage on mobile, localStorage on web)
  - [ ] Configure 24-hour fetch interval with background sync
  - [ ] Add AdBanner component to Explore feed bottom and Projects list
  - [ ] Add AdBannerWithModal component for between-action placements
  - [ ] Implement AdModal with 5-minute frequency cap
  - [ ] Add AdInfoModal for transparency ("Why am I seeing this?")
  - [ ] Store privacy policy link in constants and wire to all ad components
  - [ ] Track anonymous engagement metrics (impressions, clicks) without PII
- [ ] **External Ad Networks Setup (AdMob + AdSense)**
  - [ ] Create AdMob account and generate app IDs for iOS/Android
  - [ ] Create ad units: Banner, Interstitial, Rewarded
  - [ ] Install react-native-google-mobile-ads package
  - [ ] Configure AdMob initialization in app layout
  - [ ] Add AdSense script to web build for display ads
  - [ ] Implement Banner ads in Explore feed and Projects list (alternating with David's banners)
  - [ ] Implement Interstitial ads between workspace navigation and after project milestones
  - [ ] Implement Rewarded ads offering Creative Points bonus (5-10 XP per watch)
  - [ ] Add GDPR consent flow using react-native-google-mobile-ads consent SDK
  - [ ] Implement age gate (13+ requirement) for COPPA compliance
  - [ ] Add test device IDs for development (prevent invalid traffic)
  - [ ] Configure ad frequency caps (max 1 interstitial per 3 minutes)
- [ ] **Hybrid Strategy Integration**
  - [ ] Create ad rotation logic (70% external, 30% David's for feed impressions)
  - [ ] Implement A/B testing framework to measure David's vs External performance
  - [ ] Track separate revenue metrics for David's vs External ads
  - [ ] Add fallback logic: if external ads fail to load, show David's ads
  - [ ] Monitor fill rates and adjust rotation percentages based on performance
  - [ ] Add user preference toggle: "Support with ads" vs "Go ad-free" (freemium upsell)
- [ ] **Privacy & Compliance**
  - [ ] Update privacy policy with dual ad network disclosure (David's + AdMob/AdSense)
  - [ ] Implement GDPR consent banner with granular choices (David's only, External only, Both, None)
  - [ ] Add CCPA opt-out mechanism (California users)
  - [ ] Create "Data We Collect" page explaining David's vs External tracking differences
  - [ ] Wire consent choices to ad service initialization (respect user preferences)
  - [ ] Add cookie consent for web AdSense integration
- [ ] **Analytics & Optimization**
  - [ ] Track ad impressions, clicks, and revenue by source (David's vs External)
  - [ ] Monitor user engagement correlation (do ads hurt retention or boost revenue?)
  - [ ] A/B test ad placements (feed bottom vs between sections)
  - [ ] Measure Creative Points boost effectiveness (does rewarded video drive engagement?)
  - [ ] Analyze frequency cap impact (user satisfaction vs revenue trade-off)
  - [ ] Create admin dashboard showing ad performance metrics
- [ ] Implement DMCA workflows and copyright scanning
- [ ] Build admin/moderation tools
- [ ] Create AI + human moderation pipeline
- [ ] Implement reporting and dispute resolution
- [ ] **Workspace**: A container for a project including tasks, files, chat, and collaborators
- [ ] **Project**: A creative initiative with defined goals, contributors, and outputs
- [ ] **Content Post**: A link-first post that shares external content with rich previews
- [ ] **Boost**: Algorithmic visibility increase powered by Creative Points and meaningful engagement
- [ ] **Creative Points (XP)**: Earned through collaboration and engagement; spent to post content and start projects
- [ ] **Reputation Score**: Trust metric derived from contributions and feedback
- [ ] **Pay Split**: Defined revenue distribution among collaborators
- [ ] Creator signs up → builds profile → joins or creates a project
- [ ] Project lead creates workspace → assigns roles and tasks
- [ ] Collaborators upload assets → review and approve versions
- [ ] Project milestones are published to the content feed
- [ ] Audience engages → boosts visibility → generates revenue
- [ ] Project workspaces with tasks, milestones, and versioning
- [ ] Media asset storage and review tools
- [x] Real-time communication (chat, voice, video)
- [ ] Content sharing with rich previews and engagement tracking
- [ ] Engagement-based boosting and gamification
- [x] Analytics dashboards for creators and teams
- [ ] Monetization: subscriptions, tips, digital sales, memberships
- [ ] AI tools for content adaptation, moderation, and insights
- [ ] Integrations with creative tools, cloud storage, and code repositories
- [ ] Payments via Stripe, PayPal, and global gateways
- [ ] GDPR and CCPA compliance
- [ ] DMCA workflows and copyright scanning
- [ ] Platform admins manage policies and enforcement
- [ ] Community and project admins set local rules
- [ ] AI + human moderation pipeline
- [ ] Reporting, appeals, and dispute resolution tools
- [ ] App name: Creatisphere
- [ ] One-line description: A unified creative operating system for collaboration, promotion, and monetization.
- [ ] App type: web + mobile + desktop
- [ ] Will users sign in? yes
- [ ] Auth method: email/password and OAuth (planned)
- [ ] User roles: creators, collaborators, project leads, fans/supporters, admins/moderators
- [ ] Will you store user data? yes
- [ ] Primary data entities: users, profiles, workspaces, projects, tasks, assets, posts, boosts, reputation scores, creative points, engagement events, pay splits, subscriptions, messages
- [ ] RLS or permissions model: role-based access with workspace/project scoped permissions
- [ ] Key user flows:
- [ ] Sign up → build profile → create/join project
- [ ] Create workspace → assign roles/tasks → collaborate on assets
- [ ] Publish milestones → community engagement → revenue generation
- [ ] Admin flows:
- [ ] Policy enforcement and moderation
- [ ] Dispute resolution and appeals
- [ ] Shared app state needed across screens? yes
- [ ] Examples: auth, user profile, matching filters, task queues
- [ ] Key routes/screens: onboarding, auth, profile, projects, workspace, tasks, assets, feed, analytics, settings
- [ ] Deep links or guarded routes: yes
- [ ] Navigation style: drawer + stack (with nested tabs in key areas)
- [ ] Offline support needed? no
- [ ] Sync/conflict strategy: n/a
- [ ] Brand colors: vibrant gradient-led palette (primary + accent with dark UI)
- [ ] Typography/fonts: modern sans-serif with strong readability
- [ ] Motion/animation notes: subtle ambient motion and celebratory effects
- [ ] Need SEO/meta tags or share previews? no
- [ ] Expected data volume or scale constraints: high user/content volume, real-time collaboration
- [ ] Perf hotspots: feed lists, media previews, chat/voice/video modules, analytics dashboards
- [ ] Target platforms: mobile + web + desktop
- [ ] Hosting/deployment approach: standard Expo + EAS for builds and web hosting
- [ ] Any compliance or security constraints: GDPR, CCPA, DMCA workflows, IP protection, moderation

## Core Flows
- [ ] Draft core user flows (onboarding → primary action → retention loop)

## Data & Schema (Drizzle + Supabase)
- [x] Define entities & relationships: Define entities (users, profiles, projects, tasks, posts, etc.)
- [x] Draft Drizzle schemas + Zod validators
- [ ] Create migrations and apply to Supabase
- [x] Configure RLS policies + roles
- [x] Add seed data or fixtures for development

## Backend APIs
- [ ] Define API surface (Expo Router `+api.ts` routes + payloads)
- [ ] Implement server services for core entities (projects, workspaces, posts, boosts)
- [ ] Add validation, auth guards, and error handling
- [ ] Add SSR-ready endpoints for dynamic pages (e.g., Projects)
- [ ] Integrate client API layer + typed responses

## Frontend Screens & Navigation
- [ ] Map primary routes/screens and navigation layout
- [ ] Build reusable components + states (loading/empty/error)
- [ ] Wire data fetching + state management (Zustand)
- [ ] Ensure dynamic pages render from API-fetched data (no bundled JSON)
- [ ] Decide SSR mode: avoid full RSC if it limits Drawer/TopTabs

## Integrations & Services
- [ ] Configure authentication provider (Supabase Auth / OAuth)
- [ ] Add file/media storage strategy
- [ ] Add payments or monetization flows (if required)

## DevOps & Deployment
- [ ] Define environment variables + secrets management
- [ ] Set up build pipeline (mobile builds + web server build)
- [ ] Configure self-hosted Node runtime for web + API routes on VPS + Plesk (no EAS Hosting)
- [ ] Configure hosting + domain + health checks

## QA & Release
- [ ] Add smoke tests for core flows
- [ ] Performance audit (lists, startup, animations)
- [ ] Pre-release checklist + analytics
