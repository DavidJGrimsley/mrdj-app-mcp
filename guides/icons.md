# Icons & Assets Guide

This guide documents how to manage web + PWA icons and app assets for any web/mobile app. It uses the PokePages icon pipeline as a reference implementation, but the guidance here is framework-agnostic and safe for any app.

> **Reference-only scripts**: The scripts shown in this guide are for downstream app projects. They are **not intended to be executed inside the mrdj-app-mcp repo**.

## Table of Contents
- [Asset checklist](#asset-checklist)
- [SmartUtilify icon output layout](#smartutilify-icon-output-layout)
- [Icon copy rules](#icon-copy-rules)
- [PowerShell script (Windows-first)](#powershell-script-windows-first)
- [Node script (cross-platform alternative)](#node-script-cross-platform-alternative)
- [Required web references](#required-web-references)
- [Manifest icon paths](#manifest-icon-paths)
- [Verify checklist](#verify-checklist)
- [Related docs](#related-docs)

## Asset checklist

Use this checklist for the full set of app + web assets. Filenames matter for automation and for web references.

### General branding assets
- **brand-logo.png** — 1024×1024 — PNG — Master logo
- **brand-logo-square.png** — 1024×1024 — PNG — Square logo
- **brand-logo-horizontal.png** — 1600×600 — PNG/SVG — Horizontal logo
- **app-icon-master.png** — 2048×2048 — PNG — Source for all app icons

### Mobile app icons
- **icon.png** — 1024×1024 — PNG — Main Expo app icon
- **ios-appstore.png** — 1024×1024 — PNG — App Store listing
- **android-playstore.png** — 512×512 — PNG — Play Store listing

### Splash screens
- **splash.png** — 720×1280 or 1242×2436 — PNG — Main splash image
- **splash-background.png** — 2048×2048 — PNG — Resize‑safe background

### Web favicons & PWA icons
- **favicon.ico** — 48×48 — ICO — Browser tab icon
- **favicon-32x32.png** — 32×32 — PNG — Browser tab icon
- **favicon-16x16.png** — 16×16 — PNG — Small browser tab icon
- **apple-touch-icon.png** — 180×180 — PNG — iOS home screen icon
- **mask-icon.svg** — SVG — Safari pinned tab icon
- **pwa-72x72.png** … **pwa-512x512.png** — PNG — PWA install icons

### Social media previews
- **home-preview.png** — 1200×630 — PNG/JPG — OG & Twitter card
- **twitter-preview.png** — 1200×600 — PNG/JPG — Twitter-specific preview
- **share-square.png** — 1080×1080 — PNG — Instagram post
- **share-story.png** — 1080×1920 — PNG — Instagram story

### PWA files
- **manifest.webmanifest** — PWA settings
- **sw.js** — Offline support

## DJsPortfolio paths & naming

- The portfolio site uses `/public/icons` and mirrors assets under `/public/images/icons` so both `/icons` and `/images/icons` resolve correctly.
- The manifest file is `public/manifest.webmanifest` and the service worker is `public/sw.js` (see [pwa.md](pwa.md)).

## SmartUtilify icon output layout

Expected SmartUtilify output folders (relative to project root):

```
smartutilifyIconDownload/
  web/
    apple-touch-icon.png
    favicon.ico
    favicon-16x16.png
    favicon-32x32.png
    mask-icon.svg
    ...
  pwa/
    pwa-72x72.png
    pwa-96x96.png
    pwa-128x128.png
    pwa-144x144.png
    pwa-152x152.png
    pwa-192x192.png
    pwa-256x256.png
    pwa-384x384.png
    pwa-512x512.png
```

## Icon copy rules

Copy rules used by the reference pipeline:

- `smartutilifyIconDownload/pwa/*` → `public/icons/`
- `smartutilifyIconDownload/web/*` → `public/icons/`
- `assets/icons/*` → `public/icons/`
- `public/icons/*` → `icons`
- `public/icons/favicon.ico` → `favicon.ico`

> Why the extra `icons` folder?
> Some web builds expose `icons/` at `/images/icons`. Keep the mirror so both `/icons` and `/images/icons` can be served without surprises.

## PowerShell script (Windows-first)

Use this script in **downstream app projects** (not inside this MCP repo). It copies SmartUtilify output into the expected locations.

File: `scripts/copy-pwa-icons.ps1`

```
# Reference-only helper script for downstream app projects.
# Not intended to be executed inside the mrdj-app-mcp repo itself.

param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$smartRoot = Join-Path $ProjectRoot "smartutilifyIconDownload"
$webSource = Join-Path $smartRoot "web"
$pwaSource = Join-Path $smartRoot "pwa"
$assetsIcons = Join-Path $ProjectRoot "assets/icons"
$publicIcons = Join-Path $ProjectRoot "public/icons"
$iconsRoot = Join-Path $ProjectRoot "icons"
$faviconTarget = Join-Path $ProjectRoot "favicon.ico"

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Copy-Dir([string]$Source, [string]$Destination) {
  if (Test-Path $Source) {
    Copy-Item (Join-Path $Source "*") -Destination $Destination -Recurse -Force
  } else {
    Write-Warning "Source missing: $Source"
  }
}

Ensure-Dir $publicIcons
Ensure-Dir $iconsRoot

# Copy icon sources into public/icons
Copy-Dir $assetsIcons $publicIcons
Copy-Dir $webSource $publicIcons
Copy-Dir $pwaSource $publicIcons

# Mirror public/icons -> icons (used by some web roots)
Copy-Dir $publicIcons $iconsRoot

# Copy favicon.ico to project root
$faviconSource = Join-Path $publicIcons "favicon.ico"
if (Test-Path $faviconSource) {
  Copy-Item $faviconSource -Destination $faviconTarget -Force
} else {
  Write-Warning "favicon.ico not found in $publicIcons"
}

Write-Host "Icon copy complete."
```

## Node script (cross-platform alternative)

File: `scripts/copy-pwa-icons.mjs`

```
// Reference-only helper script for downstream app projects.
// Not intended to be executed inside the mrdj-app-mcp repo itself.

import { promises as fs } from "fs";
import path from "path";

const projectRoot = path.resolve(process.argv[2] || path.join(import.meta.dirname, ".."));
const smartRoot = path.join(projectRoot, "smartutilifyIconDownload");
const webSource = path.join(smartRoot, "web");
const pwaSource = path.join(smartRoot, "pwa");
const assetsIcons = path.join(projectRoot, "assets", "icons");
const publicIcons = path.join(projectRoot, "public", "icons");
const iconsRoot = path.join(projectRoot, "icons");
const faviconTarget = path.join(projectRoot, "favicon.ico");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyDir(source, destination) {
  try {
    await fs.cp(source, destination, { recursive: true, force: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.warn(`Source missing: ${source}`);
      return;
    }
    throw error;
  }
}

await ensureDir(publicIcons);
await ensureDir(iconsRoot);

// Copy icon sources into public/icons
await copyDir(assetsIcons, publicIcons);
await copyDir(webSource, publicIcons);
await copyDir(pwaSource, publicIcons);

// Mirror public/icons -> icons (used by some web roots)
await copyDir(publicIcons, iconsRoot);

// Copy favicon.ico to project root
const faviconSource = path.join(publicIcons, "favicon.ico");
try {
  await fs.copyFile(faviconSource, faviconTarget);
} catch (error) {
  if (error?.code === "ENOENT") {
    console.warn(`favicon.ico not found in ${publicIcons}`);
  } else {
    throw error;
  }
}

console.log("Icon copy complete.");
```

### One‑liner (npm)

Run from your **downstream app project** root:

```
npm run copy:pwa-icons
```

> This repo includes the npm script as a reference. It is not meant to be executed inside mrdj-app-mcp.

## Required web references

These filenames must match **exactly**:

- `favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png`
- `mask-icon.svg`

Your HTML head must reference these filenames as‑is. Example:

```
<link rel="manifest" href="/manifest.json" />
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="icon" href="/images/icons/favicon.ico" />
<link rel="icon" href="/images/icons/favicon-32x32.png" sizes="32x32" />
<link rel="icon" href="/images/icons/favicon-16x16.png" sizes="16x16" />
<link rel="apple-touch-icon" href="/images/icons/apple-touch-icon.png" />
<link rel="mask-icon" href="/images/icons/mask-icon.svg" color="#582a5a" />
```

## Manifest icon paths

Your `manifest.json` **must** point to `/images/icons/pwa-*.png`:

```
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
```

If your app serves icons from a different web root, adjust your server or build to map `/images/icons` to the copied `icons` folder.

## Verify checklist

- Icons exist in the `icons` folder
- Hard refresh the browser (Ctrl+Shift+R / Cmd+Shift+R)
- If using a service worker, bump your cache name and verify the new cache contains updated icons

## Related docs

- Expo app icon & splash guide: https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/
- PWA guide: [pwa.md](pwa.md)
