# Progressive Web App (PWA) Guide

This guide covers how to implement Progressive Web App (PWA) features in your Expo/React Native web app, based on the PokePages implementation.

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

1. **Web App Manifest** (`public/manifest.json`) — Defines app metadata
2. **Service Worker** (`public/service-worker.js`) — Handles caching and offline support
3. **Registration Code** — Registers the service worker at runtime

## Implementation Steps

### 1. Create the Web App Manifest

Create `public/manifest.json`:

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

Create `public/service-worker.js`:

```javascript
/* Basic Service Worker for caching core files and PWA icons. */
const CACHE_NAME = 'your-app-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/icons/pwa-192x192.png',
  '/images/icons/pwa-512x512.png',
  '/images/icons/favicon.ico',
  '/images/icons/apple-touch-icon.png',
  '/images/icons/favicon-32.png'
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
  // Don't intercept API requests
  const url = new URL(event.request.url);
  if (url.port === '3001' || (url.hostname === 'localhost' && url.port !== location.port)) {
    // Let API requests pass through without caching
    return;
  }
  
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request).then((response) => {
          // Optionally cache dynamic requests
          if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
      );
    })
  );
});
```

**Key concepts:**

- **`install` event**: Called when a new service worker is first discovered
  - Caches core assets
  - `skipWaiting()`: Forces the new service worker to activate immediately (auto-update!)
  
- **`activate` event**: Called when the service worker takes control
  - Deletes old caches (cleanup)
  - `clients.claim()`: Takes control of all pages immediately (auto-update!)
  
- **`fetch` event**: Intercepts all network requests
  - Returns cached version if available (cache-first strategy)
  - Falls back to network if not cached
  - Optionally caches successful responses for future use

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
        <link rel="manifest" href="/manifest.json" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/images/icons/favicon.ico" />
        <link rel="icon" href="/images/icons/favicon-32.png" sizes="32x32" />
        <link rel="icon" href="/images/icons/favicon-16.png" sizes="16x16" />
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
            navigator.serviceWorker.register('/service-worker.js').catch(function(err){
              console.warn('ServiceWorker registration failed:', err);
            });
          });
        }
      ` }} />
    </html>
  );
}
```

**Why register on `load` event?**
- Ensures your app's critical resources load first
- Service worker initializes after the page is interactive
- Prevents blocking the initial render

## Theme Color & Address Bar Styling

The **theme-color** meta tag is what makes the mobile browser's address bar match your app's branding. This is the subtle detail that makes your PWA feel polished and native-like.

### Implementation

```html
<!-- In your <head> -->
<meta name="theme-color" content="#582a5a" />
```

```json
// In manifest.json
{
  "theme_color": "#582a5a"
}
```

**Best practices:**
- Use the same color in both places (meta tag and manifest)
- Choose your primary brand color or header background color
- Use a hex color value (e.g., `#582a5a`)
- Avoid very light colors (low contrast with browser UI)
- Test on both iOS Safari and Android Chrome

**Result:** On mobile, the browser address bar and notification bar will adopt your theme color, creating a seamless, branded experience.

## Auto-Update Mechanism

PWAs can update automatically without user intervention. Here's how it works:

### The Update Lifecycle

1. **User visits your app**: Browser checks for a new `service-worker.js`
2. **New version detected**: Browser downloads the new service worker
3. **Installation**: New worker installs in the background
4. **Activation**: 
   - Without `skipWaiting()`: New worker waits until all tabs close
   - **With `skipWaiting()`**: New worker activates immediately
5. **Control transfer**: `clients.claim()` makes the new worker control all open pages

### Key Methods for Auto-Update

```javascript
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())  // 🚀 Skip waiting phase
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
        return null;
      })
    ))
  );
  self.clients.claim();  // 🚀 Take control immediately
});
```

**What triggers an update?**
- Changing **any byte** in `service-worker.js`
- Incrementing `CACHE_NAME` (recommended approach)
- Example: `'my-app-cache-v1'` → `'my-app-cache-v2'`

### Deployment Workflow

1. Build your app: `npx expo export:web` or `npm run build:web`
2. Increment the cache version in `public/service-worker.js`
3. Deploy the new build to your server
4. Next time users visit:
   - Browser detects the new service worker
   - New worker installs and activates immediately
   - Old cache is deleted
   - Users get the latest version without manual refresh

### Advanced: Prompting Users to Update

For more control, you can notify users when an update is available:

```javascript
// In your app code (not service worker)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').then((registration) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available!
          // Show a "Update Available" message/button
          if (confirm('New version available! Reload to update?')) {
            window.location.reload();
          }
        }
      });
    });
  });
}
```

**Note:** With `skipWaiting()`, the update happens automatically, so this prompt is optional. Use it if you want users to be aware of updates or if you need to preserve unsaved work.

## Testing Your PWA

### Local Testing

1. **Build for web:**
   ```bash
   npx expo export:web
   # or
   npm run build:web
   ```

2. **Serve the build:**
   ```bash
   npx serve web-build
   # or
   npx http-server web-build
   ```

3. **Test in Chrome:**
   - Open `http://localhost:5000` (or whatever port)
   - Open DevTools → Application → Service Workers
   - Verify your service worker is registered
   - Check Application → Manifest to validate your manifest.json

### Installation Testing

**Desktop (Chrome/Edge):**
- Look for the install icon in the address bar (⊕ or computer icon)
- Click to install
- App opens in a standalone window

**Mobile (iOS Safari):**
- Tap the Share button
- Select "Add to Home Screen"
- App icon appears on home screen

**Mobile (Android Chrome):**
- Tap the menu (⋮)
- Select "Install app" or "Add to Home screen"
- App icon appears in app drawer

### Cache Testing

1. **DevTools → Application → Cache Storage**
2. Verify your assets are cached
3. **DevTools → Network → Offline checkbox**
4. Reload the page — it should work offline!

### Update Testing

1. Change `CACHE_NAME` in `service-worker.js` (e.g., `v1` → `v2`)
2. Rebuild and redeploy
3. Refresh the app
4. **DevTools → Application → Service Workers**
5. You should see the new service worker activate
6. Check **Cache Storage** — old cache deleted, new cache created

## Troubleshooting

### Service Worker Not Registering

**Symptom:** No service worker in DevTools → Application → Service Workers

**Causes:**
- Service worker path is incorrect (must be in `public/` folder)
- App not served over HTTPS (required except for `localhost`)
- Service worker JS has syntax errors (check browser console)

**Fix:**
```javascript
// Check registration errors
navigator.serviceWorker.register('/service-worker.js')
  .then(reg => console.log('SW registered:', reg))
  .catch(err => console.error('SW registration failed:', err));
```

### App Not Installable

**Symptom:** No install prompt/icon appears

**Requirements for PWA installation:**
- Valid `manifest.json` linked in HTML
- At least 192x192 and 512x512 icons
- Service worker registered and active
- `display: "standalone"` or `"fullscreen"` in manifest
- Served over HTTPS (except localhost)
- Site engagement (Chrome requires user to have interacted with the site)

**Fix:**
- **DevTools → Application → Manifest**: Check for errors
- Verify `<link rel="manifest" href="/manifest.json" />` in HTML
- Confirm icons exist at the paths specified in manifest

### Updates Not Applying

**Symptom:** Old version keeps loading after deployment

**Causes:**
- `CACHE_NAME` not incremented
- Service worker file cached by browser
- Missing `skipWaiting()` or `clients.claim()`

**Fix:**
1. Increment `CACHE_NAME` in `service-worker.js`
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. DevTools → Application → Service Workers → Unregister (for testing)
4. Ensure your server sends proper cache headers for `service-worker.js`:
   ```
   Cache-Control: no-cache
   ```

### Offline Mode Not Working

**Symptom:** App fails to load offline

**Causes:**
- Core assets not in `CORE_ASSETS` array
- Assets cached with incorrect paths
- API requests not properly excluded from caching

**Fix:**
1. Verify all critical assets in `CORE_ASSETS`
2. Check paths match your build output (e.g., `/index.html` vs `index.html`)
3. Test: DevTools → Network → Offline checkbox → Reload

## Best Practices

### Security

- **HTTPS required** for production PWAs (except localhost)
- Validate all cached assets are from your origin
- Don't cache sensitive data in the service worker
- Use Content Security Policy (CSP) headers

### Performance

- **Minimize `CORE_ASSETS`**: Only cache critical files for instant startup
- Use **cache-first strategy** for static assets
- Use **network-first strategy** for dynamic content (API requests)
- Consider **Workbox** for advanced caching strategies

### User Experience

- Show a subtle message when updates are available
- Consider a loading state for the first install
- Test on real devices — mobile behavior differs from desktop
- Provide a way to clear cache (Settings → Clear Data)

### Icons & Assets

**Required sizes:**
- **192x192**: Minimum for PWA install
- **512x512**: Minimum for splash screen
- **Recommended**: All sizes from 72x72 to 512x512 for best compatibility

**Additional icons:**
- `favicon.ico` (32x32)
- `apple-touch-icon.png` (180x180) for iOS
- `favicon-16.png` and `favicon-32.png` for browser tabs
- `mask-icon.svg` (optional, for Safari pinned tabs)

**Tool recommendations:**
- Use an icon generator like [Smartutilify](https://smartutilify.com/) or [PWA Builder](https://www.pwabuilder.com/)
- Start with a high-res master icon (2048x2048+)
- Generate all sizes from the master

### Maintenance

**When you deploy:**
1. Increment `CACHE_NAME` in `service-worker.js`
2. Test the update flow before deploying
3. Monitor service worker registration errors in analytics

**Versioning strategy:**
```javascript
const CACHE_NAME = 'my-app-cache-v' + '1.2.3';  // Tie to app version
```

**Clear old caches:**
```javascript
// Automatically handled in the activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
});
```

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

Start simple and iterate. The PokePages implementation proves that a basic service worker can provide excellent PWA functionality without complexity.

## Additional Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev: PWA](https://web.dev/progressive-web-apps/)
- [Expo: PWA Support](https://docs.expo.dev/guides/progressive-web-apps/)
- [Workbox: Advanced Service Worker Library](https://developers.google.com/web/tools/workbox)
- [PWA Builder: Testing Tool](https://www.pwabuilder.com/)
