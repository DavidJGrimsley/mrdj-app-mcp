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
