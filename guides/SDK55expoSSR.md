# Expo Router SSR (SDK 55) — Server Rendering (Alpha)

This guide summarizes the **SDK 55 alpha** server rendering flow described in Expo docs.

## Scope (SDK 55)
- Web-only SSR (no HTML SSR for iOS/Android)
- Server rendering is **alpha** in SDK 55+
- Uses Expo Router server rendering with request-time HTML

## Required configuration
`app.json`:

```json
{
  "expo": {
    "web": {
      "output": "server"
    },
    "plugins": [
      ["expo-router", { "unstable_useServerRendering": true }]
    ]
  }
}
```

## Development
- `npx expo start`

## Production build
- `npx expo export --platform web`

This produces `dist/client` + `dist/server`. HTML is rendered **per request** (no pre-generated HTML files).

## Dynamic routes
- With server rendering, **do not use `generateStaticParams`**. Dynamic routes render at request time.

## Data loaders
- Server rendering supports **data loaders** that run on the server per request and can feed `Head` tags.

## API routes + SSR
- API routes are independent of rendering mode.
- SSR is controlled by server output + server rendering mode.

## Hosting
Server rendering requires a runtime server:
- EAS Hosting
- Node/Express (`expo-server/adapter/express`)
- Workers / Edge / Bun adapters per Expo docs

## Comparison (SDK 54 vs SDK 55)

| Topic | SDK 54 (current) | SDK 55 (alpha) |
| --- | --- | --- |
| SSR switch | `web.output = "server"` | `web.output = "server"` + `unstable_useServerRendering` |
| Dynamic routes | Often rely on `generateStaticParams` | Render per request (no static params) |
| Data loaders | Not required / not used | Supported for SSR data |
| Status | Working, undocumented | Official docs, alpha |
