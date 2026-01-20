# Progressive Web App (PWA) Guide

This guide covers how to implement Progressive Web App (PWA) features in your Expo/React Native web app, based on the DJsPortfolio implementation.

## Table of Contents
- [What is a PWA?](#what-is-a-pwa)
- [Core Components](#core-components)
- [Implementation Steps](#implementation-steps)
- [Theme Color & Address Bar Styling](#theme-color--address-bar-styling)
- [Auto-Update Mechanism](#auto-update-mechanism)
- [Testing Your PWA](#testing-your-pwa)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## What is a PWA?

A Progressive Web App combines the best of web and native apps. Key features:
- **Installable**: Users can add your app to their home screen
- **Offline-capable**: Works without internet via service workers
- **App-like experience**: Runs in standalone mode without browser UI
- **Auto-updates**: New versions deploy automatically
- **Fast**: Cached resources load instantly

## Core Components

A PWA requires three essential pieces:

1. **Web App Manifest** (`public/manifest.webmanifest`) — Defines app metadata
2. **Service Worker** (`public/sw.js`) — Handles caching and offline support
3. **Registration Code** — Registers the service worker at runtime

## Implementation Steps

### 1. Create the Web App Manifest

Create `public/manifest.webmanifest`:

```json
{
  "name": "Your App Name",
  "short_name": "Short Name",
  "description": "Your app description",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#582a5a",
  "icons": [
    { "src": "/images/icons/pwa-72x72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/images/icons/pwa-96x96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/images/icons/pwa-128x128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/images/icons/pwa-144x144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/images/icons/pwa-152x152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/images/icons/pwa-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/images/icons/pwa-256x256.png", "sizes": "256x256", "type": "image/png" },
    { "src": "/images/icons/pwa-384x384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/images/icons/pwa-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Key properties:**
- `name`: Full app name (appears during install)
- `short_name`: Name shown under the app icon (12 chars or less recommended)
- `start_url`: URL to open when launching the app
- `display: "standalone"`: Runs without browser UI (like a native app)
- `background_color`: Splash screen background
- `theme_color`: **Critical for address bar styling** (see below)
- `icons`: Array of icon sizes (192x192 and 512x512 are required minimum)

### 2. Create the Service Worker

Create `public/sw.js`:

```javascript
/* Basic Service Worker for caching core files and PWA icons. */
const CACHE_NAME = 'your-app-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/images/icons/pwa-192x192.png',
  '/images/icons/pwa-512x512.png',
  '/images/icons/favicon.ico',
  '/images/icons/apple-touch-icon.png',
  '/images/icons/favicon-32x32.png',
  '/images/icons/favicon-16x16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Example: Skip caching for API requests (customize port for your setup)
  if (url.port === '3001' || (url.hostname === 'localhost' && url.port !== location.port)) {
    return;
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request).then((response) => {
          const isSameOrigin = event.request.url.startsWith(self.location.origin);
          if (response && response.status === 200 && isSameOrigin) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
      );
    })
  );
});
```

**Important**: Update `CACHE_NAME` (e.g., increment version) whenever you deploy changes. This triggers the update flow.

### 3. Register the Service Worker in Expo Router

For **Expo Router**, add to your `app/+html.tsx`:

```tsx
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        <title>Your App Name</title>

        {/* PWA: Manifest and icons */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/images/icons/favicon.ico" />
        <link rel="icon" href="/images/icons/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" href="/images/icons/favicon-16x16.png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/images/icons/apple-touch-icon.png" />
        <link rel="mask-icon" href="/images/icons/mask-icon.svg" color="#582a5a" />

        {/* IMPORTANT: Theme color for address bar styling */}
        <meta name="theme-color" content="#582a5a" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>

      {/* Service Worker Registration */}
      <script dangerouslySetInnerHTML={{ __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js').catch(function(err){
              console.warn('ServiceWorker registration failed:', err);
            });
          });
        }
      ` }} />
    </html>
  );
}
```

### 4. Static Hosting Notes (DJsPortfolio)

- Keep `manifest.webmanifest`, `sw.js`, `robots.txt`, and `sitemap.xml` in `public/` so they deploy to the web root.
- If using static hosting redirects, include `public/_redirects` in the deploy output.

## Theme Color & Address Bar Styling

The **theme-color** meta tag is what makes the mobile browser's address bar match your app's branding.

```html
<meta name="theme-color" content="#582a5a" />
```

```json
{
  "theme_color": "#582a5a"
}
```

## Auto-Update Mechanism

PWAs can update automatically without user intervention.

```javascript
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});
```

**Update trigger:** change any byte of `sw.js` or bump the cache name.

## Testing Your PWA

1. **Build for web:**
   ```bash
   npx expo export:web
   ```
2. **Serve locally:**
   ```bash
   npx serve dist
   ```
3. **Verify in DevTools:** Application → Manifest / Service Workers
4. **Offline test:** Check “Offline” in Network tab and reload

## Troubleshooting

### Service Worker Not Registering

**Causes:**
- Service worker path is incorrect (must be in `public/` folder)
- App not served over HTTPS (required except for `localhost`)
- Syntax errors in `sw.js`

```javascript
navigator.serviceWorker.register('/sw.js')
  .then(reg => console.log('SW registered:', reg))
  .catch(err => console.error('SW registration failed:', err));
```

### App Not Installable

**Requirements:**
- Valid `manifest.webmanifest` linked in HTML
- At least 192x192 and 512x512 icons
- Service worker registered and active
- `display: "standalone"` in manifest
- Served over HTTPS (except localhost)

## Best Practices

- Keep manifest and service worker filenames stable (`manifest.webmanifest`, `sw.js`).
- Bump `CACHE_NAME` on each deployment to force updates.
- Make sure icons exist under `/images/icons/` and match the manifest.
- Cache only same-origin requests to avoid CORS surprises.

## Summary

A well-implemented PWA provides:
- ✅ **Instant loading** from cache
- ✅ **Offline functionality** for cached pages
- ✅ **Native app feel** with standalone mode
- ✅ **Automatic updates** via `skipWaiting()` and `clients.claim()`
- ✅ **Branded experience** with theme-color for address bar
- ✅ **Home screen installation** on mobile and desktop

The key to a great PWA is keeping it simple:
1. Minimal manifest with proper theme-color
2. Service worker with cache-first strategy
3. Auto-update mechanism with skipWaiting()
4. Proper icons and meta tags

Start simple and iterate. The DJsPortfolio implementation proves that a basic service worker can provide excellent PWA functionality without complexity.

## Additional Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev: PWA](https://web.dev/progressive-web-apps/)
- [Expo: PWA Support](https://docs.expo.dev/guides/progressive-web-apps/)
- [Workbox: Advanced Service Worker Library](https://developers.google.com/web/tools/workbox)
- [PWA Builder: Testing Tool](https://www.pwabuilder.com/)
