# Expo Router SSR (SDK 54) — Server Output Guide

This guide covers the **SDK 54** implementation currently working in Creatisphere. It assumes **server output** and a custom Node server using `expo-server`.

## Scope (SDK 54)
- Web-only SSR (no HTML SSR for iOS/Android)
- Server output + Express server adapter
- `<Head />` for per-route meta tags

## Requirements
- `app.json`:
  - `expo.web.output = "server"`
- Dependencies:
  - `expo-server`, `express`, `compression`, `morgan`
- Server entry: `server.js` using `expo-server/adapter/express`

## Local SSR build + test
1) Build:
- `npx expo export -p web`

2) Run server:
- `node server.js`

3) Validate SSR HTML:
- Request a route directly and check `<head>` in the HTML response.

## Express v5 wildcard caveat
If Express is v5 and `app.all('*', ...)` fails with path-to-regexp errors, use middleware without a path:

- `app.use(createRequestHandler({ build: SERVER_BUILD_DIR }))`

## Dynamic routes (SDK 54 behavior)
- In practice, **pre-rendering via `generateStaticParams`** is a reliable way to ensure route params resolve in SSR HTML.
- This guide reflects the working pattern used in Creatisphere.

## Why meta tags can be generic
SSR only sees data **available at render time**. If data is loaded in `useEffect()`, SSR output will fall back to defaults.

### Working pattern used in Creatisphere
- Resolve route params synchronously
- Use dummy data fallback to drive `Head` tags at render time
- Validate output with raw HTML inspection

## API routes + SSR
API routes are independent of SSR and do not enable SSR by themselves. SSR requires `web.output = "server"` and a server runtime.

## Deployment
Use [pleskApiRoutesDeploy.md](pleskApiRoutesDeploy.md) for Node/Express deployment. The steps apply even if you are not using API routes.
