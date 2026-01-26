import { z } from "zod";
import path from "node:path";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConvertStylingInputSchema, runConvertStylingTool } from "./convertStyling.js";
import { loadGuide, toFileUri } from "./guideUtils.js";

export type PortfolioTool = {
  name: string;
  title: string;
  description: string;
  schema: Record<string, unknown>;
};

type GuideSpec = {
  id: string;
  title: string;
  fileName: string;
  description: string;
};

type DocsEntry = {
  id: string;
  title: string;
  urls: string[];
};

type ProjectContext = {
  infoText?: string;
  styleText?: string;
  infoSource?: string;
  styleSource?: string;
  generalVibe?: string;
  appType?: string;
};

type ChecklistItem = {
  id: string;
  title: string;
  question: string;
  guideIds: string[];
  status: "answered" | "missing";
  evidence?: string;
  answerHint?: string;
};

export const PORTFOLIO_TOOLS: PortfolioTool[] = [
  {
    name: "ingest-project-context",
    title: "Ingest Project Context",
    description: "Convert project/info.txt + project/style.txt into markdown in /project and optionally delete the .txt files.",
    schema: {
      projectRoot: "string (optional absolute path; default MCP_PROJECT_ROOT or cwd)",
      infoPath: "string (optional; default project/info.txt)",
      stylePath: "string (optional; default project/style.txt)",
      writeFile: "boolean (optional; default true)",
      deleteTxt: "boolean (optional; default true)"
    }
  },
  {
    name: "project-preflight",
    title: "Project Preflight Checklist",
    description:
      "Generate a checklist/quiz from guides + project context. Ensures project/info aligns with required build decisions before instructions are generated.",
    schema: {
      projectRoot: "string (optional absolute path; default MCP_PROJECT_ROOT or cwd)",
      includeTemplate: "boolean (optional; default true)"
    }
  },
  {
    name: "list-guides",
    title: "List Copilot Guides",
    description: "Return the available copilot guides as resource links",
    schema: {}
  },
  {
    name: "read-guide",
    title: "Read Copilot Guide",
    description: "Return the full content of a copilot guide by id",
    schema: {
      id: "string (required; guide id from list-guides)"
    }
  },
  {
    name: "generate-project-instructions",
    title: "Generate Project Instructions",
    description:
      "Generate .github/copilot-instructions.md from local copilot guides and project context in /project (writes file by default).",
    schema: {
      guideIds: "string[] (optional; default all guides)",
      projectRoot: "string (optional absolute path; default MCP_PROJECT_ROOT or cwd)",
      outputPath: "string (optional; default .github/copilot-instructions.md)",
      writeFile: "boolean (optional; default true)"
    }
  },
  {
    name: "generate-project-todo",
    title: "Generate Project TODO",
    description: "Generate project/TODO.md from project/info.md + project/style.md (writes file by default).",
    schema: {
      projectRoot: "string (optional absolute path; default MCP_PROJECT_ROOT or cwd)",
      outputPath: "string (optional; default project/TODO.md)",
      writeFile: "boolean (optional; default true)"
    }
  },
  {
    name: "list-docs",
    title: "List Package Docs",
    description: "List known docs sources by id (used by search-docs)",
    schema: {}
  },
  {
    name: "search-docs",
    title: "Search Package Docs",
    description: "Search known docs sources by id without providing URLs",
    schema: {
      docId: "string",
      query: "string",
      maxMatchesPerUrl: "number (optional)",
      maxUrls: "number (optional)"
    }
  },
  {
    name: "fetch-web-doc",
    title: "Fetch / Search Web Docs",
    description: "Fetch a public documentation URL and optionally search it for a query",
    schema: {
      url: "string (URL)",
      query: "string (optional)",
      maxMatches: "number (optional)"
    }
  },
  {
    name: "smart-help",
    title: "Smart Help (Guides + Live Docs)",
    description: "Auto-select relevant PokePages guides and query live docs sources",
    schema: {
      question: "string",
      preferGuides: "boolean (optional)",
      preferDocs: "boolean (optional)",
      guideIds: "string[] (optional)",
      docIds: "string[] (optional)",
      docQuery: "string (optional)",
      maxDocIds: "number (optional)",
      maxUrlsPerDoc: "number (optional)",
      maxMatchesPerUrl: "number (optional)",
      guideExcerptChars: "number (optional)"
    }
  },
  {
    name: "convert-styling",
    title: "Convert Styling (Uniwind)",
    description: "Scan a project for styling usage and (optionally) apply best-effort Uniwind migration steps (dry-run by default).",
    schema: {
      projectRoot: "string (optional absolute path)",
      files: "{ path: string, content: string }[] (optional; in-memory mode)",
      basePath: "string (optional; label used for reporting in in-memory mode)",
      apply: "boolean (optional; default false)",
      maxFiles: "number (optional)",
      includeExtensions: "string[] (optional)",
      excludeDirNames: "string[] (optional)",
      mode: "'uniwind-migration' (optional)"
    }
  },
  {
    name: "update-app-naming",
    title: "Update App Naming",
    description: "Update app name across package.json, app.json, public/manifest.webmanifest, and bundle identifiers based on display name.",
    schema: {
      projectRoot: "string (optional absolute path; default MCP_PROJECT_ROOT or cwd)",
      displayName: "string (required; human-readable app name, e.g., 'My App')",
      companyDomain: "string (optional; for bundle ID, e.g., 'com.yourcompany'; default 'com.example')",
      apply: "boolean (optional; default true)"
    }
  },
  {
    name: "update-readme",
    title: "Update README",
    description: "Generate or revise README.md based on project info and style context.",
    schema: {
      projectRoot: "string (optional absolute path; default MCP_PROJECT_ROOT or cwd)",
      apply: "boolean (optional; default true)"
    }
  }
];

const docsRegistry: DocsEntry[] = [
  {
    id: "uniwind",
    title: "Uniwind",
    urls: [
      "https://docs.uniwind.dev/",
      "https://docs.uniwind.dev/quickstart",
      "https://docs.uniwind.dev/migration-from-nativewind",
      "https://docs.uniwind.dev/class-names",
      "https://docs.uniwind.dev/theming/basics",
      "https://docs.uniwind.dev/faq"
    ]
  },
  {
    id: "nativewind",
    title: "NativeWind",
    urls: ["https://www.nativewind.dev/"]
  },
  {
    id: "tailwindcss",
    title: "Tailwind CSS",
    urls: ["https://tailwindcss.com/docs"]
  },
  {
    id: "expo",
    title: "Expo",
    urls: ["https://docs.expo.dev/"]
  },
  {
    id: "expo-router",
    title: "Expo Router",
    urls: [
      "https://docs.expo.dev/router/introduction/",
      "https://github.com/expo/expo/tree/main/packages/expo-router"
    ]
  },
  {
    id: "react-native",
    title: "React Native",
    urls: ["https://reactnative.dev/docs/getting-started"]
  },
  {
    id: "reanimated",
    title: "React Native Reanimated",
    urls: ["https://docs.swmansion.com/react-native-reanimated/"]
  },
  {
    id: "gesture-handler",
    title: "React Native Gesture Handler",
    urls: ["https://docs.swmansion.com/react-native-gesture-handler/"]
  },
  {
    id: "safe-area-context",
    title: "react-native-safe-area-context",
    urls: ["https://github.com/th3rdwave/react-native-safe-area-context"]
  },
  {
    id: "zustand",
    title: "Zustand",
    urls: ["https://docs.pmnd.rs/zustand/getting-started/introduction", "https://github.com/pmndrs/zustand"]
  },
  {
    id: "supabase",
    title: "Supabase",
    urls: ["https://supabase.com/docs"]
  },
  {
    id: "drizzle",
    title: "Drizzle ORM",
    urls: ["https://orm.drizzle.team/docs/overview", "https://github.com/drizzle-team/drizzle-orm"]
  },
  {
    id: "zod",
    title: "Zod",
    urls: ["https://zod.dev/"]
  },
  {
    id: "clsx",
    title: "clsx",
    urls: ["https://github.com/lukeed/clsx"]
  },
  {
    id: "tailwind-merge",
    title: "tailwind-merge",
    urls: ["https://github.com/dcastil/tailwind-merge"]
  },
  {
    id: "express",
    title: "Express",
    urls: ["https://expressjs.com/"]
  },
  {
    id: "cors",
    title: "cors (Express middleware)",
    urls: ["https://github.com/expressjs/cors"]
  },
  {
    id: "mcp",
    title: "Model Context Protocol",
    urls: ["https://modelcontextprotocol.io/docs/getting-started/intro", "https://github.com/modelcontextprotocol"]
  }
];

const docsMap = new Map(docsRegistry.map((d) => [d.id, d]));

const PAGE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const pageCache = new Map<string, { at: number; ok: boolean; status: number; text: string }>();

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "get",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "like",
  "make",
  "me",
  "my",
  "not",
  "of",
  "on",
  "or",
  "our",
  "please",
  "should",
  "so",
  "that",
  "the",
  "their",
  "then",
  "this",
  "to",
  "use",
  "using",
  "we",
  "what",
  "when",
  "where",
  "why",
  "with",
  "you",
  "your"
]);

function htmlToText(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, "");

  const withLineBreaks = withoutStyles
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr)>/gi, "\n")
    .replace(/<(p|div|h1|h2|h3|h4|h5|h6|tr)[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "");

  return withLineBreaks
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findQuerySnippets(text: string, query: string, maxMatches: number): string[] {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return [];

  const snippets: string[] = [];
  let startIndex = 0;

  while (snippets.length < maxMatches) {
    const foundIndex = haystack.indexOf(needle, startIndex);
    if (foundIndex === -1) break;

    const contextBefore = 160;
    const contextAfter = 240;
    const from = Math.max(0, foundIndex - contextBefore);
    const to = Math.min(text.length, foundIndex + needle.length + contextAfter);
    const snippet = text.slice(from, to).replace(/\n+/g, " ").trim();
    snippets.push(`${from > 0 ? "…" : ""}${snippet}${to < text.length ? "…" : ""}`);

    startIndex = foundIndex + needle.length;
  }

  return snippets;
}

async function fetchPageText(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; text: string }> {
  const cached = pageCache.get(url);
  const now = Date.now();
  if (cached && now - cached.at < PAGE_CACHE_TTL_MS) {
    return { ok: cached.ok, status: cached.status, text: cached.text };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "mrdj-app-mcp/0.1.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    const html = await res.text();
    const result = { ok: res.ok, status: res.status, text: htmlToText(html) };
    pageCache.set(url, { at: Date.now(), ...result });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueKeepOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function pickGuideIds(question: string): string[] {
  const guideIds: string[] = [];

  if (/(uniwind|nativewind|tailwind|class(name)?|css\b|stylesheet|theme|theming|tokens)/i.test(question)) {
    guideIds.push("styling");
  }
  if (/(expo router|expo-router|router|routing|deep link|deeplink|linking|layout\b|screen\b|segment)/i.test(question)) {
    guideIds.push("routing");
  }
  if (/(zustand|store\b|selector|persist|persistence)/i.test(question)) {
    guideIds.push("state-management");
  }
  if (/(drizzle|supabase|database|db\b|rls\b|migration|migrations|schema)/i.test(question)) {
    guideIds.push("database-architecture");
  }
  if (/(reanimated|animation|worklet|gesture|transition)/i.test(question)) {
    guideIds.push("animation");
  }
  if (/(performance|perf\b|startup|rerender|re-render|list\b|flatlist|seo|metadata|meta tags)/i.test(question)) {
    guideIds.push("performance");
    if (/meta\s*tags|og\b|open\s*graph|twitter card/i.test(question)) guideIds.push("meta-tags");
  }
  if (/(offline|sync|conflict|netinfo)/i.test(question)) {
    guideIds.push("offline-first");
  }
  if (/(plesk|nginx|pm2|deploy|deployment|reverse proxy|sse)/i.test(question)) {
    guideIds.push("plesk-deployment");
  }
  if (/(build\b|export\b|sitemap|ci\b)/i.test(question)) {
    guideIds.push("build-scripts");
  }

  if (guideIds.length === 0) guideIds.push("index");

  return uniqueKeepOrder(guideIds).slice(0, 3);
}

function pickDocIds(question: string): string[] {
  const q = question.toLowerCase();
  const docIds: string[] = [];

  if (q.includes("uniwind")) docIds.push("uniwind");
  if (q.includes("nativewind")) docIds.push("nativewind");
  if (q.includes("tailwind")) docIds.push("tailwindcss");
  if (q.includes("expo router") || q.includes("expo-router") || q.includes("router")) docIds.push("expo-router");
  if (q.includes("expo")) docIds.push("expo");
  if (q.includes("react native") || q.includes("react-native")) docIds.push("react-native");
  if (q.includes("reanimated")) docIds.push("reanimated");
  if (q.includes("gesture")) docIds.push("gesture-handler");
  if (q.includes("safe area") || q.includes("safe-area")) docIds.push("safe-area-context");
  if (q.includes("zustand")) docIds.push("zustand");
  if (q.includes("supabase")) docIds.push("supabase");
  if (q.includes("drizzle")) docIds.push("drizzle");
  if (q.includes("zod")) docIds.push("zod");
  if (q.includes("clsx")) docIds.push("clsx");
  if (q.includes("tailwind-merge") || q.includes("twmerge")) docIds.push("tailwind-merge");

  if (q.includes("mcp") || q.includes("model context protocol")) docIds.push("mcp");

  return uniqueKeepOrder(docIds);
}

function extractDocQuery(question: string): string {
  const backticked = question.match(/`([^`]{2,60})`/);
  if (backticked?.[1]) return backticked[1];

  const pascalOrCamel =
    question.match(/\b[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*\b/) ??
    question.match(/\b[a-z][a-z0-9]+[A-Z][A-Za-z0-9]*\b/);
  if (pascalOrCamel?.[0]) return pascalOrCamel[0];

  const kebab = question.match(/\b[a-z0-9]+(?:-[a-z0-9]+){1,}\b/i);
  if (kebab?.[0]) return kebab[0];

  const tokens = question
    .toLowerCase()
    .split(/[^a-z0-9-]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));

  return tokens[0] ?? "";
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

function resolveProjectRoot(inputRoot?: string): string {
  if (inputRoot && inputRoot.trim()) return path.resolve(inputRoot);
  return process.env.MCP_PROJECT_ROOT ? path.resolve(process.env.MCP_PROJECT_ROOT) : process.cwd();
}

function resolveOutputPath(projectRoot: string, outputPath?: string): string {
  if (!outputPath || !outputPath.trim()) {
    return path.join(projectRoot, ".github", "copilot-instructions.md");
  }
  return path.isAbsolute(outputPath) ? outputPath : path.join(projectRoot, outputPath);
}

function resolveTodoPath(projectRoot: string, outputPath?: string): string {
  if (!outputPath || !outputPath.trim()) {
    return path.join(projectRoot, "project", "TODO.md");
  }
  return path.isAbsolute(outputPath) ? outputPath : path.join(projectRoot, outputPath);
}

function ensurePathInsideRoot(projectRoot: string, filePath: string): void {
  const relative = path.relative(projectRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Output path must be inside project root: ${projectRoot}`);
  }
}

function extractBulletLines(text?: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const items = lines
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, "").trim())
    .filter((line) => line.length > 0);
  return uniqueKeepOrder(items);
}

function extractCommaSeparatedList(text?: string): string[] {
  if (!text) return [];
  return uniqueKeepOrder(
    text
      .split(/[;,]/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  );
}

function extractStyleTokens(styleText?: string): string[] {
  if (!styleText) return [];
  const lines = styleText.split(/\r?\n/).map((line) => line.trim());
  const tokenLines = lines
    .filter((line) => /--[a-z0-9-]+\s*:\s*#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})/i.test(line))
    .map((line) => line.replace(/;+\s*$/, ""));
  const hexLines = lines
    .filter((line) => /#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})/i.test(line))
    .filter((line) => !tokenLines.includes(line));
  return uniqueKeepOrder([...tokenLines, ...hexLines]);
}

type PaletteMap = Record<string, string>;

function normalizeHex(hex: string): string | null {
  const cleaned = hex.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cleaned)) return null;
  const normalized = cleaned.length === 3 ? cleaned.split("").map((c) => c + c).join("") : cleaned;
  return `#${normalized.toUpperCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = normalized.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

function mixRgb(base: { r: number; g: number; b: number }, target: { r: number; g: number; b: number }, ratio: number) {
  const clampRatio = Math.min(1, Math.max(0, ratio));
  return {
    r: base.r * (1 - clampRatio) + target.r * clampRatio,
    g: base.g * (1 - clampRatio) + target.g * clampRatio,
    b: base.b * (1 - clampRatio) + target.b * clampRatio
  };
}

function generatePaletteFromHex(baseHex: string): PaletteMap {
  const baseRgb = hexToRgb(baseHex);
  if (!baseRgb) return {};

  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  const stops: Record<string, { target: typeof white; ratio: number }> = {
    50: { target: white, ratio: 0.92 },
    100: { target: white, ratio: 0.85 },
    200: { target: white, ratio: 0.7 },
    300: { target: white, ratio: 0.55 },
    400: { target: white, ratio: 0.35 },
    500: { target: baseRgb, ratio: 0 },
    600: { target: black, ratio: 0.12 },
    700: { target: black, ratio: 0.24 },
    800: { target: black, ratio: 0.36 },
    900: { target: black, ratio: 0.5 },
    950: { target: black, ratio: 0.6 }
  };

  const palette: PaletteMap = {};
  for (const [stop, config] of Object.entries(stops)) {
    const mixed = config.ratio === 0 ? baseRgb : mixRgb(baseRgb, config.target, config.ratio);
    palette[stop] = rgbToHex(mixed);
  }

  return palette;
}

function formatPaletteLines(palette: PaletteMap, indent: string, prefix: string): string[] {
  const order = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
  const safePrefix = prefix.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "primary";
  const lines: string[] = [];
  lines.push(`${indent}- Palette:`);
  for (const key of order) {
    if (palette[key]) lines.push(`${indent}  - ${key}: ${palette[key]}`);
  }
  lines.push(`${indent}- CSS variables (prefix: ${safePrefix}):`);
  for (const key of order) {
    if (palette[key]) lines.push(`${indent}  - --color-${safePrefix}-${key}: ${palette[key]};`);
  }
  return lines;
}

function enhanceStyleTextWithPalettes(styleText: string): string {
  const lines = styleText.split(/\r?\n/);
  const headingMatches: { index: number; title: string }[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^#{1,6}\s+(.*)$/);
    if (match) headingMatches.push({ index: i, title: match[1].trim() });
  }

  if (headingMatches.length === 0) {
    headingMatches.push({ index: 0, title: "Project Style" });
  }

  const sections: Array<{ start: number; end: number; title: string }> = [];
  for (let i = 0; i < headingMatches.length; i += 1) {
    const start = headingMatches[i].index + 1;
    const end = headingMatches[i + 1]?.index ?? lines.length;
    sections.push({ start, end, title: headingMatches[i].title });
  }

  const shadeRegex = /(palette\b|\b50\s*:\s*#|--color-[a-z0-9-]*50)/i;
  const hexRegex = /#([0-9a-f]{3}|[0-9a-f]{6})/i;
  let changed = false;

  for (const section of sections) {
    const slice = lines.slice(section.start, section.end);
    if (!slice.length) continue;

    const paletteExists = slice.some((line) => shadeRegex.test(line));
    if (paletteExists) continue;

    let hexValue: string | null = null;
    let hexLineIndex = -1;
    for (let i = 0; i < slice.length; i += 1) {
      const found = slice[i].match(hexRegex);
      if (found) {
        hexValue = found[0];
        hexLineIndex = section.start + i;
        break;
      }
    }

    if (!hexValue || hexLineIndex === -1) continue;

    const palette = generatePaletteFromHex(hexValue);
    if (Object.keys(palette).length === 0) continue;

    const indent = (lines[hexLineIndex].match(/^(\s*)/)?.[1] ?? "");
    const prefix = /secondary/i.test(section.title)
      ? "secondary"
      : /tertiary|neutral/i.test(section.title)
        ? "neutral"
        : "primary";

    const block = formatPaletteLines(palette, indent, prefix);
    lines.splice(hexLineIndex + 1, 0, ...block);
    changed = true;
  }

  return changed ? lines.join("\n") : styleText;
}

function inferAppType(text: string): string {
  const lower = text.toLowerCase();
  const hasWeb = /(\bweb\b|website|web app|browser|pwa)/i.test(lower);
  const hasMobile = /(mobile|ios|android|expo|react native|\bapp\b)/i.test(lower);
  const hasDesktop = /(desktop|electron|macos|windows)/i.test(lower);

  const tags: string[] = [];
  if (hasWeb) tags.push("web");
  if (hasMobile) tags.push("mobile");
  if (hasDesktop) tags.push("desktop");

  if (tags.length === 0) return "unspecified";
  if (tags.length === 1 && tags[0] === "mobile") return "mobile app";
  return tags.join(" + ");
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    const text = await readFile(filePath, "utf8");
    return text.trim();
  } catch {
    return undefined;
  }
}

async function readProjectContext(projectRoot: string): Promise<ProjectContext> {
  const projectDir = path.join(projectRoot, "project");

  const infoMd = path.join(projectDir, "info.md");
  const infoTxt = path.join(projectDir, "info.txt");
  const styleMd = path.join(projectDir, "style.md");
  const styleTxt = path.join(projectDir, "style.txt");

  const infoMdText = await readOptionalFile(infoMd);
  const infoTxtText = await readOptionalFile(infoTxt);
  const styleMdText = await readOptionalFile(styleMd);
  const styleTxtText = await readOptionalFile(styleTxt);

  const infoText = infoMdText ?? infoTxtText;
  const styleText = styleMdText ?? styleTxtText;

  const generalVibe = styleText ? extractSection(styleText, "general vibe") : undefined;

  const combined = [infoText, styleText].filter(Boolean).join("\n\n");
  const appType = combined ? inferAppType(combined) : "unspecified";

  return {
    infoText,
    styleText,
    infoSource: infoMdText ? "project/info.md" : infoTxtText ? "project/info.txt" : undefined,
    styleSource: styleMdText ? "project/style.md" : styleTxtText ? "project/style.txt" : undefined,
    generalVibe,
    appType
  };
}

function extractSection(text: string, heading: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const headingRegex = new RegExp(`^\s*(#{1,6}\s*)?${escapeRegExp(heading)}\s*:?\s*$`, "i");
  let start = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (headingRegex.test(lines[i])) {
      start = i + 1;
      break;
    }
  }

  if (start === -1) return undefined;

  const sectionLines: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*#{1,6}\s+/.test(line)) break;
    if (headingRegex.test(line)) continue;
    sectionLines.push(line);
  }

  const cleaned = sectionLines.join("\n").trim();
  return cleaned.length ? cleaned : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildChecklistTemplate(): string {
  return [
    "# Project Info (Checklist-Aligned)",
    "",
    "## Summary",
    "- App name:",
    "- One-line description:",
    "- App type: web | mobile | both | desktop",
    "",
    "## Users & Auth",
    "- Will users sign in? (yes/no)",
    "- Auth method (email/pass, magic link, SSO, OAuth, etc.):",
    "- User roles (e.g. admin, employer, candidate):",
    "",
    "## Data & Storage",
    "- Will you store user data? (yes/no)",
    "- Primary data entities (tables/collections):",
    "- RLS or permissions model:",
    "",
    "## Core Flows",
    "- Key user flows (bullets):",
    "- Admin flows (if any):",
    "",
    "## State & App Logic",
    "- Shared app state needed across screens? (yes/no)",
    "- Examples (auth, profile, filters, tasks, etc.):",
    "",
    "## Routing & Navigation",
    "- Key routes/screens (bullets):",
    "- Deep links or guarded routes (yes/no):",
    "- Navigation style (stack | drawer | tabs | vertical tabs | custom):",
    "",
    "## Offline & Sync",
    "- Offline support needed? (yes/no)",
    "- Sync/conflict strategy (if yes):",
    "",
    "## Styling & UX",
    "- Brand colors:",
    "- Typography/fonts:",
    "- Motion/animation notes:",
    "",
    "## Performance & Scale",
    "- Expected data volume or scale constraints:",
    "- Perf hotspots (lists, media, charts, etc.):",
    "",
    "## Deployment",
    "- Target platforms:",
    "- Hosting/deployment approach:",
    "",
    "## Compliance / Security",
    "- Any compliance or security constraints:",
    ""
  ].join("\n");
}

function buildChecklistItems(context: ProjectContext): ChecklistItem[] {
  const combined = [context.infoText, context.styleText].filter(Boolean).join("\n\n");
  const lower = combined.toLowerCase();
  const hasText = (pattern: RegExp) => pattern.test(lower);

  const items: ChecklistItem[] = [
    {
      id: "app-type",
      title: "App type",
      question: "Is this web, mobile, both, or desktop?",
      guideIds: ["routing"],
      status: context.appType && context.appType !== "unspecified" ? "answered" : "missing",
      evidence: context.appType && context.appType !== "unspecified" ? context.appType : undefined,
      answerHint: "Choose web, mobile, both, or desktop."
    },
    {
      id: "auth",
      title: "Users & auth",
      question: "Will users sign in? If yes, what auth method/roles?",
      guideIds: ["architecture", "database-architecture"],
      status: hasText(/\b(auth|login|sign\s*up|sign\s*in|account|user(s)?|roles?)\b/i) ? "answered" : "missing",
      answerHint: "Example: Email/password with roles (admin/employer/candidate)."
    },
    {
      id: "data-storage",
      title: "Data & storage",
      question: "Will you store user data? What are the core entities?",
      guideIds: ["database-architecture"],
      status: hasText(/\b(database|db|table|tables|schema|supabase|drizzle|storage)\b/i) ? "answered" : "missing",
      answerHint: "List tables/entities and any RLS rules."
    },
    {
      id: "state-management",
      title: "Shared app state",
      question: "Will data need to be shared across multiple screens (auth/profile/filters)?",
      guideIds: ["state-management"],
      status: hasText(/\b(state|store|zustand|global state|shared state)\b/i) ? "answered" : "missing",
      answerHint: "If yes, we’ll use a store (e.g., Zustand) for shared state."
    },
    {
      id: "routing",
      title: "Routing & navigation",
      question: "What are the main routes/screens, any guarded routes, and your navigation style?",
      guideIds: ["routing"],
      status: hasText(/\b(route|routing|screen|navigation|layout|deep link|deeplink)\b/i) ? "answered" : "missing",
      answerHint: "List key screens and choose: stack | drawer | tabs | vertical tabs | custom."
    },
    {
      id: "offline",
      title: "Offline & sync",
      question: "Do you need offline access or sync behavior?",
      guideIds: ["offline-first"],
      status: hasText(/\boffline|sync|conflict\b/i) ? "answered" : "missing",
      answerHint: "If yes, mention storage + conflict rules."
    },
    {
      id: "styling",
      title: "Styling & branding",
      question: "Do you have color, font, and visual style guidance?",
      guideIds: ["styling"],
      status: hasText(/\b(color|colors|font|typography|brand|theme|styling)\b/i) ? "answered" : "missing",
      answerHint: "Provide primary/secondary colors, fonts, and vibe."
    },
    {
      id: "animation",
      title: "Animation & motion",
      question: "Any motion/animation requirements?",
      guideIds: ["animation"],
      status: hasText(/\banimation|motion|transition|reanimated\b/i) ? "answered" : "missing",
      answerHint: "Mention any specific animated flows or micro-interactions."
    },
    {
      id: "performance",
      title: "Performance constraints",
      question: "Any performance constraints or large lists/media?",
      guideIds: ["performance"],
      status: hasText(/\bperformance|perf|list|flatlist|feed|scale|large data\b/i) ? "answered" : "missing",
      answerHint: "Note big lists, media, or scale concerns."
    },
    {
      id: "meta",
      title: "SEO & meta",
      question: "Need SEO/meta tags or share previews?",
      guideIds: ["meta-tags"],
      status: hasText(/\bseo|meta|open graph|og\b|twitter card\b/i) ? "answered" : "missing",
      answerHint: "If web is involved, list SEO needs or social previews."
    },
    {
      id: "deployment",
      title: "Deployment & hosting",
      question: "Where will it be hosted/deployed?",
      guideIds: ["plesk-deployment", "build-scripts"],
      status: hasText(/\bdeploy|deployment|hosting|plesk|nginx|pm2|build\b|ci\b|cdn\b/i) ? "answered" : "missing",
      answerHint: "Plesk/NGINX, Vercel, EAS, etc."
    }
  ];

  return items;
}

function extractSingleLineField(text: string | undefined, label: string): string | undefined {
  if (!text) return undefined;
  const regex = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:?\\s*(.+)$`, "im");
  const match = text.match(regex);
  if (!match?.[1]) return undefined;
  return match[1].trim();
}

function inferAppNavigation(infoText: string): {
  pattern: "tabs" | "drawer" | "stack" | "hybrid" | "unknown";
  description: string;
  structure: string[];
} {
  const lower = infoText.toLowerCase();
  
  // Look for explicit mentions
  if (lower.includes("drawer") || lower.includes("side menu") || lower.includes("side navigation")) {
    return {
      pattern: "drawer",
      description: "Drawer navigation with nested tabs (common for feature-rich apps)",
      structure: [
        "app/",
        "  _layout.tsx (root, providers)",
        "  +html.tsx (web entry)",
        "  (drawer)/ (drawer navigator)",
        "    _layout.tsx (drawer setup)",
        "    (tabs)/ (tab bar)",
        "      _layout.tsx (tab navigator)",
        "      index.tsx (home tab)",
        "      [other-tabs].tsx",
        "    [feature-groups]/"
      ]
    };
  }
  
  if (lower.includes("tab") || lower.includes("bottom nav") || lower.includes("bottom tabs")) {
    return {
      pattern: "tabs",
      description: "Tab-based navigation (ideal for simple, focused apps)",
      structure: [
        "app/",
        "  _layout.tsx (root, providers)",
        "  +html.tsx (web entry)",
        "  (tabs)/ (tab navigator)",
        "    _layout.tsx (tab bar setup)",
        "    index.tsx (primary tab)",
        "    [secondary].tsx (additional tabs)",
        "  auth/ (outside tabs, for login/signup)"
      ]
    };
  }

  if (lower.includes("stack") || lower.includes("flow") || lower.includes("sequential")) {
    return {
      pattern: "stack",
      description: "Stack-based navigation (good for onboarding or linear flows)",
      structure: [
        "app/",
        "  _layout.tsx (root, providers)",
        "  +html.tsx (web entry)",
        "  index.tsx (entry point)",
        "  (onboarding)/ (flow group)",
        "    _layout.tsx (stack navigator)",
        "    step1.tsx",
        "    step2.tsx",
        "  main/ (main app group)",
        "    _layout.tsx (main stack)",
        "    index.tsx (home)"
      ]
    };
  }

  // Infer from flow descriptions
  if (lower.includes("marketplace") || lower.includes("multi-user") || lower.includes("roles") || lower.includes("complex")) {
    return {
      pattern: "hybrid",
      description: "Hybrid: drawer + tabs + nested stacks (feature-rich multi-role apps)",
      structure: [
        "app/",
        "  _layout.tsx (root, providers)",
        "  (drawer)/ (drawer, if needed for many features)",
        "    _layout.tsx (drawer navigator)",
        "    (tabs)/ (if applicable)",
        "      _layout.tsx (tab bar)",
        "      [tab-features].tsx",
        "    [feature-domains]/ (organized by domain)",
        "      index.tsx",
        "      [detail-route].tsx"
      ]
    };
  }

  // Default: tabs are common and safe
  return {
    pattern: "unknown",
    description: "Infer from project specifics; default to tabs if in doubt",
    structure: [
      "app/",
      "  _layout.tsx (root, providers, auth guards)",
      "  (tabs)/ OR (drawer)/ (choose based on feature count)",
      "    _layout.tsx (navigator setup)",
      "    index.tsx (primary screen)",
      "    [features]/"
    ]
  };
}

function buildScreenStructure(
  flows: string[],
  features: string[],
  navigationPattern: "tabs" | "drawer" | "stack" | "hybrid" | "unknown"
): {
  primaryScreens: string[];
  featureGroups: string[];
  supportScreens: string[];
} {
  const screens = [...flows, ...features].map((s) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 30)
  );

  const primary = screens.slice(0, navigationPattern === "tabs" ? 3 : 2).filter(Boolean);
  const groups = navigationPattern === "drawer" || navigationPattern === "hybrid" ? screens.slice(3, 6) : [];
  const support = ["profile", "settings", "about", "help", "legal"];

  return {
    primaryScreens: uniqueKeepOrder(primary),
    featureGroups: uniqueKeepOrder(groups),
    supportScreens: uniqueKeepOrder(support.filter((s) => !screens.includes(s)))
  };
}

function reformatProjectInfo(rawText: string): string {
  const lines: string[] = [];
  lines.push("# Project Information\n");

  // Try to extract app name
  const appNameMatch = rawText.match(/(?:app name|name|title):\s*(.+)/i);
  lines.push("## App Name");
  lines.push(`- ${appNameMatch ? appNameMatch[1].trim() : "[Specify app name]"}\n`);

  // Try to extract overview/description
  lines.push("## Overview");
  const overviewMatch = rawText.match(/(?:overview|description|about):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (overviewMatch) {
    lines.push(`- ${overviewMatch[1].trim()}\n`);
  } else {
    lines.push("- [Brief description of the app/website and its purpose]");
    lines.push("- [What problem does it solve? Who is it for?]\n");
  }

  // Unique Value Proposition
  lines.push("## Unique Value Proposition");
  const uvpMatch = rawText.match(/(?:unique value|uvp|differentiat|competitive advantage):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (uvpMatch) {
    lines.push(`- ${uvpMatch[1].trim()}\n`);
  } else {
    lines.push("- [What makes this project different from competitors?]");
    lines.push("- [Key features or philosophies that set it apart]\n");
  }

  // User Types
  lines.push("## User Types");
  const userTypesMatch = rawText.match(/(?:user types|users|roles):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (userTypesMatch) {
    const types = userTypesMatch[1].trim().split(/\n|,/).filter(Boolean);
    types.forEach(type => lines.push(`- ${type.trim()}`));
    lines.push("");
  } else {
    lines.push("- [List and describe all user types (e.g., Candidate, Employer, Admin, etc.)]\n");
  }

  // Core Principles
  lines.push("## Core Principles");
  const principlesMatch = rawText.match(/(?:principles|rules|guidelines|policies):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (principlesMatch) {
    const principles = principlesMatch[1].trim().split(/\n(?=[-•*])|(?<=\.)\s+(?=[A-Z])/);
    principles.forEach(principle => {
      const cleaned = principle.trim().replace(/^[-•*]\s*/, "");
      if (cleaned) lines.push(`- ${cleaned}`);
    });
    lines.push("");
  } else {
    lines.push("- [List the guiding principles or rules for the platform]\n");
  }

  // Key Terms & Entities
  lines.push("## Key Terms & Entities");
  const entitiesMatch = rawText.match(/(?:entities|terms|key terms|definitions):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (entitiesMatch) {
    const entities = entitiesMatch[1].trim().split(/\n(?=[-•*])/);
    entities.forEach(entity => {
      const cleaned = entity.trim().replace(/^[-•*]\s*/, "");
      if (cleaned) lines.push(`- ${cleaned}`);
    });
    lines.push("");
  } else {
    lines.push("- [Define all important terms and entities (e.g., Candidate, Employer, Company, Job, etc.)]\n");
  }

  // User Flows
  lines.push("## User Flows");
  const flowsMatch = rawText.match(/(?:user flows|flows|journeys|user journeys):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (flowsMatch) {
    const flows = flowsMatch[1].trim().split(/\n(?=[-•*])/);
    flows.forEach(flow => {
      const cleaned = flow.trim().replace(/^[-•*]\s*/, "");
      if (cleaned) lines.push(`- ${cleaned}`);
    });
    lines.push("");
  } else {
    lines.push("- [Describe the main user journeys (e.g., how a candidate gets matched, how an employer posts a job)]\n");
  }

  // Features
  lines.push("## Features");
  const featuresMatch = rawText.match(/(?:features|functionality):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (featuresMatch) {
    const features = featuresMatch[1].trim().split(/\n(?=[-•*])/);
    features.forEach(feature => {
      const cleaned = feature.trim().replace(/^[-•*]\s*/, "");
      if (cleaned) lines.push(`- ${cleaned}`);
    });
    lines.push("");
  } else {
    lines.push("- [List and briefly describe all major features]\n");
  }

  // Integration & Compliance
  lines.push("## Integration & Compliance");
  const integrationMatch = rawText.match(/(?:integration|compliance|verification):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (integrationMatch) {
    lines.push(`- ${integrationMatch[1].trim()}\n`);
  } else {
    lines.push("- [Any integrations (e.g., LinkedIn, ATS) or compliance requirements]\n");
  }

  // Admin & Moderation
  lines.push("## Admin & Moderation");
  const adminMatch = rawText.match(/(?:admin|moderation|administration):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (adminMatch) {
    lines.push(`- ${adminMatch[1].trim()}\n`);
  } else {
    lines.push("- [How are admins assigned? What are their powers and responsibilities?]\n");
  }

  // Additional Notes
  lines.push("## Additional Notes");
  const notesMatch = rawText.match(/(?:notes|additional|misc|other):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (notesMatch) {
    lines.push(`- ${notesMatch[1].trim()}\n`);
  } else {
    lines.push("- [Any other relevant information, edge cases, or future plans]\n");
  }

  lines.push("---");
  lines.push("*Expand each section as needed for your specific project.*");

  return lines.join("\n");
}

function reformatProjectStyle(rawText: string): string {
  const lines: string[] = [];
  lines.push("# Style Guide\n");

  // Fonts
  lines.push("## Fonts");
  const fontMatch = rawText.match(/(?:fonts?|typography):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (fontMatch) {
    const fonts = fontMatch[1].trim().split(/\n/).filter(Boolean);
    fonts.forEach(font => {
      const cleaned = font.trim().replace(/^[-•*]\s*/, "");
      if (cleaned) lines.push(`- ${cleaned}`);
    });
    lines.push("");
  } else {
    lines.push("- Primary font(s): [e.g., Nunito Sans, Nunito]");
    lines.push("- Display font: [e.g., Modak]");
    lines.push("- Font usage guidelines: [Where and how to use each font]\n");
  }

  // Colors - enhanced with palette generation
  lines.push("## Colors");
  
  // Try to find color definitions
  const colorSection = rawText.match(/(?:colors?|palette):\s*(.+?)(?=\n\n(?=[A-Z])|$)/is);
  if (colorSection) {
    const colorText = colorSection[1];
    const primaryMatch = colorText.match(/(?:primary|main).*?(?:#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i);
    const secondaryMatch = colorText.match(/(?:secondary|accent).*?(?:#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i);
    const tertiaryMatch = colorText.match(/(?:tertiary|neutral|grey|gray).*?(?:#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i);

    if (primaryMatch) {
      const hexMatch = primaryMatch[0].match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/);
      if (hexMatch) {
        const hex = hexMatch[0];
        const palette = generatePaletteFromHex(hex);
        lines.push("### Primary Color");
        lines.push(`- Hex: ${hex}`);
        lines.push("- Palette:");
        formatPaletteLines(palette, "  ", "").forEach(line => lines.push(line));
        lines.push("");
      }
    }

    if (secondaryMatch) {
      const hexMatch = secondaryMatch[0].match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/);
      if (hexMatch) {
        const hex = hexMatch[0];
        const palette = generatePaletteFromHex(hex);
        lines.push("### Secondary Color");
        lines.push(`- Hex: ${hex}`);
        lines.push("- Palette:");
        formatPaletteLines(palette, "  ", "").forEach(line => lines.push(line));
        lines.push("");
      }
    }

    if (tertiaryMatch) {
      const hexMatch = tertiaryMatch[0].match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/);
      if (hexMatch) {
        const hex = hexMatch[0];
        lines.push("### Tertiary/Neutral Colors");
        lines.push(`- Hex: ${hex}`);
        lines.push("- Usage: [backgrounds, borders, etc.]\n");
      }
    }
  }

  if (!colorSection) {
    lines.push("### Primary Color");
    lines.push("- Name: [e.g., Twitter Blue]");
    lines.push("- Hex: [e.g., #0F78C3]");
    lines.push("- Palette: (auto-generated from Hex)\n");
  }

  // Spacing & Layout
  lines.push("## Spacing & Layout");
  const spacingMatch = rawText.match(/(?:spacing|layout|grid):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (spacingMatch) {
    lines.push(`- ${spacingMatch[1].trim()}\n`);
  } else {
    lines.push("- [Guidelines for margins, padding, and grid usage]\n");
  }

  // Components
  lines.push("## Components");
  const componentsMatch = rawText.match(/(?:components|ui elements):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (componentsMatch) {
    lines.push(`- ${componentsMatch[1].trim()}\n`);
  } else {
    lines.push("- Buttons: [Primary, secondary, disabled, etc.]");
    lines.push("- Inputs: [Text fields, dropdowns, etc.]");
    lines.push("- Cards, modals, alerts, etc.\n");
  }

  // Animations & Interactions
  lines.push("## Animations & Interactions");
  const animationsMatch = rawText.match(/(?:animations?|interactions?|vibe):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (animationsMatch) {
    lines.push(`- ${animationsMatch[1].trim()}\n`);
  } else {
    lines.push("- General vibe: [e.g., playful, exciting]");
    lines.push("- Animation guidelines: [e.g., transitions, hover effects, loading states]\n");
  }

  // Accessibility
  lines.push("## Accessibility");
  const a11yMatch = rawText.match(/(?:accessibility|a11y):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (a11yMatch) {
    lines.push(`- ${a11yMatch[1].trim()}\n`);
  } else {
    lines.push("- Color contrast requirements");
    lines.push("- Font size and readability");
    lines.push("- Keyboard navigation\n");
  }

  // General Vibe
  lines.push("## General Vibe");
  const vibeMatch = rawText.match(/(?:general vibe|overall feel|aesthetic):\s*(.+?)(?=\n\n|\n#|$)/is);
  if (vibeMatch) {
    lines.push(`- ${vibeMatch[1].trim()}\n`);
  } else {
    lines.push("- [Describe the overall look and feel: playful, professional, minimal, etc.]\n");
  }

  lines.push("---");
  lines.push("*Expand each section as needed.*");

  return lines.join("\n");
}

function buildProjectTodo(context: ProjectContext): {
  markdown: string;
  derived: {
    featureCount: number;
    flowCount: number;
    entityCount: number;
    routeCount: number;
  };
} {
  const infoText = context.infoText ?? "";
  const styleText = context.styleText ?? "";

  const appName =
    extractSingleLineField(infoText, "App Name") ??
    extractSingleLineField(infoText, "App name") ??
    extractSingleLineField(infoText, "Name");

  const featuresSection =
    extractSection(infoText, "Features") ??
    extractSection(infoText, "Core Features") ??
    extractSection(infoText, "Feature Set");
  const flowsSection = extractSection(infoText, "User Flows") ?? extractSection(infoText, "Core Flows");
  const entitiesSection =
    extractSection(infoText, "Key Terms & Entities") ??
    extractSection(infoText, "Data & Storage") ??
    extractSection(infoText, "Entities");
  const routesSection =
    extractSection(infoText, "Routing & Navigation") ??
    extractSection(infoText, "Routes") ??
    extractSection(infoText, "Screens");

  const features = extractBulletLines(featuresSection).length
    ? extractBulletLines(featuresSection)
    : extractBulletLines(infoText);
  const flows = extractBulletLines(flowsSection);
  const entityBullets = extractBulletLines(entitiesSection);
  const entityInline = extractSingleLineField(infoText, "Primary data entities") ??
    extractSingleLineField(infoText, "Primary entities") ??
    extractSingleLineField(infoText, "Entities");
  const entities = uniqueKeepOrder([
    ...entityBullets,
    ...extractCommaSeparatedList(entityInline)
  ]);
  const routes = extractBulletLines(routesSection);
  const styleTokens = extractStyleTokens(styleText);

  const featureLines = features.length
    ? features.map((feature) => `- [ ] ${feature}`)
    : ["- [ ] Define MVP feature set from project info and stakeholders"]; 

  const flowLines = flows.length
    ? flows.map((flow) => `- [ ] ${flow}`)
    : ["- [ ] Draft core user flows (onboarding → primary action → retention loop)"];

  const entityHint = entities.length ? entities.join(", ") : "Define entities (users, profiles, projects, tasks, posts, etc.)";
  const routeLines = routes.length
    ? routes.map((route) => `- [ ] ${route}`)
    : ["- [ ] Map primary routes/screens and navigation layout"]; 

  // Infer navigation pattern and structure
  const navInference = inferAppNavigation(infoText);
  const screenStructure = buildScreenStructure(flows, features, navInference.pattern);

  const lines: string[] = [];
  lines.push("# Project TODO");
  lines.push("");
  lines.push(
    `Generated from ${context.infoSource ?? "project/info.md"}${context.styleSource ? ` + ${context.styleSource}` : ""}.`
  );
  lines.push("");
  lines.push("## App Snapshot");
  lines.push(`- App type: ${context.appType ?? "unspecified"}`);
  if (appName) lines.push(`- App name: ${appName}`);
  if (context.generalVibe) lines.push(`- General vibe: ${context.generalVibe}`);
  lines.push("");
  lines.push("## Milestones");
  lines.push("- [ ] M1 — Foundations: routing skeleton, design tokens, auth shell, environment config");
  lines.push("- [ ] M2 — Data layer: Drizzle schemas, migrations, Supabase setup + RLS policies, seed data");
  lines.push("- [ ] M3 — Core features: implement feature backlog + core flows");
  lines.push("- [ ] M4 — Backend APIs: define endpoints, implement services, integrate client");
  lines.push("- [ ] M5 — Polish & release: performance, QA, deployment, analytics");
  lines.push("");
  lines.push("## Design System & Theming (Early)");
  lines.push("- [ ] Translate project/style.md into src/global.css @layer theme tokens (light + dark)");
  lines.push("- [ ] Wire typography (primary + display fonts) in global.css and layout");
  if (styleTokens.length) {
    const previewTokens = styleTokens.slice(0, 10).join(" | ");
    const moreCount = styleTokens.length > 10 ? ` (+${styleTokens.length - 10} more)` : "";
    lines.push(`- [ ] Implement color tokens from style.md: ${previewTokens}${moreCount}`);
  } else {
    lines.push("- [ ] Extract color palette + spacing scale from project/style.md and create tokens");
  }
  lines.push("- [ ] Map button/input/card variants to tokens (primary/secondary/ghost)");
  lines.push("");
  lines.push("## File Routing & Structure (M1)");
  lines.push(`- [ ] Inferred pattern: **${navInference.pattern}** — ${navInference.description}`);
  lines.push(`- [ ] Proposed app structure:`);
  navInference.structure.forEach((line) => lines.push(`    ${line}`));
  if (screenStructure.primaryScreens.length) {
    lines.push(`- [ ] Primary screens: ${screenStructure.primaryScreens.join(", ")}`);
  }
  if (screenStructure.featureGroups.length) {
    lines.push(`- [ ] Feature groups (if drawer/hybrid): ${screenStructure.featureGroups.join(", ")}`);
  }
  if (screenStructure.supportScreens.length) {
    lines.push(`- [ ] Support screens: ${screenStructure.supportScreens.join(", ")}`);
  }
  lines.push("- [ ] Create all _layout.tsx files for navigators (root, drawer/tabs, feature groups)");
  lines.push("- [ ] Set up auth guards + deep linking (if multi-platform)");
  lines.push("");
  lines.push("## Feature Backlog");
  lines.push(...featureLines);
  lines.push("");
  lines.push("## Core Flows");
  lines.push(...flowLines);
  lines.push("");
  lines.push("## Data & Schema (Drizzle + Supabase)");
  lines.push(`- [ ] Define entities & relationships: ${entityHint}`);
  lines.push("- [ ] Draft Drizzle schemas + Zod validators");
  lines.push("- [ ] Create migrations and apply to Supabase");
  lines.push("- [ ] Configure RLS policies + roles");
  lines.push("- [ ] Add seed data or fixtures for development");
  lines.push("");
  lines.push("## Backend APIs");
  lines.push("- [ ] Define API surface (REST endpoints + payloads)");
  lines.push("- [ ] Implement services for core entities");
  lines.push("- [ ] Add validation, auth guards, and error handling");
  lines.push("- [ ] Integrate client API layer + typed responses");
  lines.push("");
  lines.push("## Frontend Screens & Navigation");
  lines.push(...routeLines);
  lines.push("- [ ] Build reusable components + states (loading/empty/error)");
  lines.push("- [ ] Wire data fetching + state management (Zustand)");
  lines.push("");
  lines.push("## Integrations & Services");
  lines.push("- [ ] Configure authentication provider (Supabase Auth / OAuth)");
  lines.push("- [ ] Add file/media storage strategy");
  lines.push("- [ ] Add payments or monetization flows (if required)");
  lines.push("");
  lines.push("## DevOps & Deployment");
  lines.push("- [ ] Define environment variables + secrets management");
  lines.push("- [ ] Set up build pipeline (EAS + web export)");
  lines.push("- [ ] Configure hosting + domain + health checks");
  lines.push("");
  lines.push("## QA & Release");
  lines.push("- [ ] Add smoke tests for core flows");
  lines.push("- [ ] Performance audit (lists, startup, animations)");
  lines.push("- [ ] Pre-release checklist + analytics");
  lines.push("");

  return {
    markdown: `${lines.join("\n").trimEnd()}\n`,
    derived: {
      featureCount: features.length,
      flowCount: flows.length,
      entityCount: entities.length,
      routeCount: routes.length
    }
  };
}

function buildProposedDefaults(context: ProjectContext, items: ChecklistItem[]): Record<string, string> {
  const defaults: Record<string, string> = {};
  const combined = [context.infoText, context.styleText].filter(Boolean).join("\n\n");
  const lower = combined.toLowerCase();

  // Analyze project context to suggest reasonable defaults
  const isMarketplace = lower.includes("marketplace") || lower.includes("matching") || lower.includes("candidates") || lower.includes("employers");
  const isMobile = context.appType === "mobile" || context.appType === "both";
  const isWeb = context.appType === "web" || context.appType === "both";

  for (const item of items) {
    if (item.status !== "missing") continue;

    switch (item.id) {
      case "state-management":
        defaults["state-management"] = "yes: global state needed for auth, user profile, matching filters, and task queues (Zustand recommended)";
        break;
      case "offline":
        defaults["offline"] = "no: real-time matching and task queue updates require active connection";
        break;
      case "meta":
        defaults["meta"] = isWeb ? "yes: job listings and employer profiles should be shareable with OG tags" : "no: mobile app only";
        break;
      case "deployment":
        const platforms = [];
        if (isMobile) platforms.push("iOS App Store + Android Play Store (EAS Build)");
        if (isWeb) platforms.push("Web deployment (Vercel or Plesk)");
        const approach = isMarketplace ? "Supabase for data, Expo Router for mobile/web" : "Standard approach";
        defaults["deployment"] = `targets: ${platforms.join(" + ") || "mobile + web"}; approach: ${approach}`;
        break;
      case "styling":
        defaults["styling"] = "Modern, clean UI with primary action colors and role-based color coding (candidates vs employers)";
        break;
      case "animation":
        defaults["animation"] = "Subtle micro-interactions for task transitions, progress indicators, and notifications";
        break;
      case "performance":
        defaults["performance"] = isMarketplace ? "high-priority: efficiently handle job matching across large candidate pools and task queues" : "standard constraints";
        break;
    }
  }

  return defaults;
}

async function buildProjectInstructions(params: {
  guideIds: string[];
  guidesDir: string;
  guideMap: Map<string, GuideSpec>;
  projectContext?: ProjectContext;
}): Promise<{
  markdown: string;
  sources: { id: string; title: string; uri: string }[];
  missingGuideIds: string[];
}> {
  const sources: { id: string; title: string; uri: string }[] = [];
  const missingGuideIds: string[] = [];
  const sections: string[] = [];

  for (const guideId of params.guideIds) {
    const guide = params.guideMap.get(guideId);
    if (!guide) {
      missingGuideIds.push(guideId);
      continue;
    }
    const { uri, text } = await loadGuide(params.guidesDir, guide.fileName);
    sources.push({ id: guide.id, title: guide.title, uri });
    sections.push(`### ${guide.title}\n\n${text.trim()}\n`);
  }

  const headerLines = [
    "# Copilot Instructions",
    "",
    "Generated from local MCP copilot guides.",
    "",
    "## Source Guides",
    ...sources.map((s) => `- ${s.title} (${s.id}) -> ${s.uri}`),
    "",
    "## Instructions",
    ""
  ];

  const context = params.projectContext;
  if (context && (context.infoText || context.styleText)) {
    const contextLines = [
      "## Project Context",
      "",
      `- App type: ${context.appType ?? "unspecified"}`,
      context.generalVibe ? `- General vibe: ${context.generalVibe}` : "",
      "",
      context.infoText ? "### Project Info\n\n" + context.infoText.trim() : "",
      context.styleText ? "### Project Style\n\n" + context.styleText.trim() : ""
    ].filter((line) => line !== "");

    headerLines.splice(4, 0, ...contextLines, "");
  }

  const templateLines = ["## Project Info Template (Checklist-Aligned)", "", buildChecklistTemplate(), ""];
  const instructionsIndex = headerLines.indexOf("## Instructions");
  if (instructionsIndex !== -1) {
    headerLines.splice(instructionsIndex, 0, ...templateLines);
  } else {
    headerLines.push(...templateLines);
  }

  return {
    markdown: `${headerLines.join("\n")}${sections.join("\n")}`.trimEnd() + "\n",
    sources,
    missingGuideIds
  };
}

export function registerTools(params: {
  server: McpServer;
  guides: GuideSpec[];
  guideMap: Map<string, GuideSpec>;
  guidesDir: string;
}): void {
  const { server, guides, guideMap, guidesDir } = params;

  server.registerTool(
    "ingest-project-context",
    {
      title: "Ingest Project Context",
      description: "Convert project/info.txt + project/style.txt into markdown in /project and optionally delete the .txt files.",
      inputSchema: z.object({
        projectRoot: z.string().optional().describe("Absolute path to project root (default MCP_PROJECT_ROOT or cwd)"),
        infoPath: z.string().optional().describe("Path to project info.txt (default project/info.txt)"),
        stylePath: z.string().optional().describe("Path to project style.txt (default project/style.txt)"),
        writeFile: z.boolean().optional().describe("Write the output files (default true)"),
        deleteTxt: z.boolean().optional().describe("Delete source .txt files after conversion (default true)")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          projectRoot: z.string().optional(),
          infoPath: z.string().optional(),
          stylePath: z.string().optional(),
          writeFile: z.boolean().optional(),
          deleteTxt: z.boolean().optional()
        })
        .parse(input);

      const projectRoot = resolveProjectRoot(parsed.projectRoot);
      const infoTxtPath = path.isAbsolute(parsed.infoPath ?? "")
        ? (parsed.infoPath as string)
        : path.join(projectRoot, parsed.infoPath ?? path.join("project", "info.txt"));
      const styleTxtPath = path.isAbsolute(parsed.stylePath ?? "")
        ? (parsed.stylePath as string)
        : path.join(projectRoot, parsed.stylePath ?? path.join("project", "style.txt"));

      const infoTxt = await readOptionalFile(infoTxtPath);
      const styleTxt = await readOptionalFile(styleTxtPath);

      if (!infoTxt && !styleTxt) {
        return {
          content: [
            {
              type: "text",
              text: "No project info/style .txt files found. Expected project/info.txt and/or project/style.txt."
            }
          ]
        };
      }

      const infoMdPath = path.join(projectRoot, "project", "info.md");
      const styleMdPath = path.join(projectRoot, "project", "style.md");

      const infoMarkdown = infoTxt ? reformatProjectInfo(infoTxt) : undefined;
      const styleMarkdown = styleTxt ? reformatProjectStyle(styleTxt) : undefined;

      const shouldWrite = parsed.writeFile ?? true;
      const shouldDelete = parsed.deleteTxt ?? true;

      if (shouldWrite) {
        await mkdir(path.join(projectRoot, "project"), { recursive: true });
        if (infoMarkdown) await writeFile(infoMdPath, infoMarkdown, "utf8");
        if (styleMarkdown) await writeFile(styleMdPath, styleMarkdown, "utf8");
      }

      if (shouldDelete) {
        if (infoTxt) {
          try {
            await unlink(infoTxtPath);
          } catch {
            // ignore delete errors
          }
        }
        if (styleTxt) {
          try {
            await unlink(styleTxtPath);
          } catch {
            // ignore delete errors
          }
        }
      }

      const resultLines = [
        "Project context ingestion complete.",
        `Info source: ${infoTxt ? infoTxtPath : "(none)"}`,
        `Style source: ${styleTxt ? styleTxtPath : "(none)"}`,
        shouldWrite ? `Wrote: ${[infoMarkdown ? infoMdPath : null, styleMarkdown ? styleMdPath : null].filter(Boolean).join(", ")}` : "Write skipped (writeFile=false).",
        shouldDelete ? "Deleted source .txt files." : "Source .txt files retained."
      ];

      return {
        content: [
          {
            type: "text",
            text: resultLines.join("\n")
          }
        ]
      };
    }
  );

  server.registerTool(
    "list-guides",
    {
      title: "List Copilot Guides",
      description: "Return the available copilot guides as resource links",
      inputSchema: {}
    },
    async () => {
      const listText = guides
        .map((guide) => {
          return `- ${guide.id}: ${guide.title} (${guide.description}) [file: ${guide.fileName}]`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Available copilot guides (use read-guide with id to fetch full content):\n${listText}`
          }
        ]
      };
    }
  );

  server.registerTool(
    "read-guide",
    {
      title: "Read Copilot Guide",
      description: "Return the full content of a copilot guide by id",
      inputSchema: z.object({
        id: z.string().min(1).describe("Guide id from list-guides")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          id: z.string().min(1)
        })
        .parse(input);

      const guide = guideMap.get(parsed.id);
      if (!guide) {
        const available = guides.map((g) => g.id).join(", ");
        return {
          content: [
            {
              type: "text",
              text: `Unknown guide id: ${parsed.id}. Available: ${available}`
            }
          ]
        };
      }

      const { uri, text } = await loadGuide(guidesDir, guide.fileName);

      return {
        content: [
          {
            type: "text",
            text: `Guide: ${guide.title} (${guide.id})\nURI: ${uri}\n\n${text}`
          }
        ]
      };
    }
  );

  server.registerTool(
    "generate-project-instructions",
    {
      title: "Generate Project Instructions",
      description:
        "Generate .github/copilot-instructions.md from local copilot guides and project context in /project (writes file by default).",
      inputSchema: z.object({
        guideIds: z.array(z.string()).optional().describe("Guide ids to include (default: all guides)"),
        projectRoot: z.string().optional().describe("Absolute path to project root (default MCP_PROJECT_ROOT or cwd)"),
        outputPath: z
          .string()
          .optional()
          .describe("Output path (default .github/copilot-instructions.md; relative paths are resolved from project root)"),
        writeFile: z.boolean().optional().describe("Write the output file (default true)")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          guideIds: z.array(z.string()).optional(),
          projectRoot: z.string().optional(),
          outputPath: z.string().optional(),
          writeFile: z.boolean().optional()
        })
        .parse(input);

      try {
        const projectRoot = resolveProjectRoot(parsed.projectRoot);
        const guideIds = parsed.guideIds?.length ? uniqueKeepOrder(parsed.guideIds) : guides.map((g) => g.id);
        const projectContext = await readProjectContext(projectRoot);
        const { markdown, sources, missingGuideIds } = await buildProjectInstructions({
          guideIds,
          guidesDir,
          guideMap,
          projectContext
        });
        const outputPath = resolveOutputPath(projectRoot, parsed.outputPath);

        ensurePathInsideRoot(projectRoot, outputPath);

        const shouldWrite = parsed.writeFile ?? true;
        if (shouldWrite) {
          await mkdir(path.dirname(outputPath), { recursive: true });
          await writeFile(outputPath, markdown, "utf8");
        }

        const missingText = missingGuideIds.length ? `\nMissing guide ids: ${missingGuideIds.join(", ")}` : "";
        const writeText = shouldWrite ? `\nWrote: ${outputPath}` : "\nWrite skipped (writeFile=false).";
        const sourceText = sources.map((s) => `- ${s.title} (${s.id}) -> ${s.uri}`).join("\n");
        const contextUsed =
          projectContext.infoText || projectContext.styleText
            ? `\nProject context:\n- App type: ${projectContext.appType ?? "unspecified"}\n- Info: ${projectContext.infoSource ?? "none"}\n- Style: ${projectContext.styleSource ?? "none"}`
            : "\nProject context: (none found in /project)";

        return {
          content: [
            {
              type: "text",
              text: `Generated copilot instructions.${writeText}${missingText}${contextUsed}\n\nSources:\n${sourceText}\n\nPreview:\n${markdown}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to generate instructions. Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  server.registerTool(
    "generate-project-todo",
    {
      title: "Generate Project TODO",
      description: "Generate project/TODO.md from project context in /project (writes file by default).",
      inputSchema: z.object({
        projectRoot: z.string().optional().describe("Absolute path to project root (default MCP_PROJECT_ROOT or cwd)"),
        outputPath: z
          .string()
          .optional()
          .describe("Output path (default project/TODO.md; relative paths are resolved from project root)"),
        writeFile: z.boolean().optional().describe("Write the output file (default true)")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          projectRoot: z.string().optional(),
          outputPath: z.string().optional(),
          writeFile: z.boolean().optional()
        })
        .parse(input);

      try {
        const projectRoot = resolveProjectRoot(parsed.projectRoot);
        const projectContext = await readProjectContext(projectRoot);

        if (!projectContext.infoText && !projectContext.styleText) {
          return {
            content: [
              {
                type: "text",
                text: "No project context found in /project. Run ingest-project-context first."
              }
            ]
          };
        }

        const { markdown, derived } = buildProjectTodo(projectContext);
        const outputPath = resolveTodoPath(projectRoot, parsed.outputPath);
        ensurePathInsideRoot(projectRoot, outputPath);

        const shouldWrite = parsed.writeFile ?? true;
        if (shouldWrite) {
          await mkdir(path.dirname(outputPath), { recursive: true });
          await writeFile(outputPath, markdown, "utf8");
        }

        const writeText = shouldWrite ? `\nWrote: ${outputPath}` : "\nWrite skipped (writeFile=false).";
        const contextUsed =
          projectContext.infoText || projectContext.styleText
            ? `\nProject context:\n- App type: ${projectContext.appType ?? "unspecified"}\n- Info: ${projectContext.infoSource ?? "none"}\n- Style: ${projectContext.styleSource ?? "none"}`
            : "\nProject context: (none found in /project)";

        return {
          content: [
            {
              type: "text",
              text: `Generated project TODO.${writeText}${contextUsed}\nDerived items: features=${derived.featureCount}, flows=${derived.flowCount}, entities=${derived.entityCount}, routes=${derived.routeCount}\n\nPreview:\n${markdown}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to generate project TODO. Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  server.registerTool(
    "project-preflight",
    {
      title: "Project Preflight Checklist",
      description:
        "Generate a checklist/quiz from guides + project context. Ensures project/info aligns with required build decisions before instructions are generated.",
      inputSchema: z.object({
        projectRoot: z.string().optional().describe("Absolute path to project root (default MCP_PROJECT_ROOT or cwd)"),
        includeTemplate: z.boolean().optional().describe("Include checklist-aligned project info template (default true)")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          projectRoot: z.string().optional(),
          includeTemplate: z.boolean().optional()
        })
        .parse(input);

      const projectRoot = resolveProjectRoot(parsed.projectRoot);
      const projectContext = await readProjectContext(projectRoot);
      const checklist = buildChecklistItems(projectContext);

      const missing = checklist.filter((item) => item.status === "missing");
      const answered = checklist.filter((item) => item.status === "answered");
      const proposedDefaults = buildProposedDefaults(projectContext, checklist);

      const lines: string[] = [];
      lines.push("Project preflight checklist");
      lines.push(`App type: ${projectContext.appType ?? "unspecified"}`);
      lines.push(
        `Context sources: info=${projectContext.infoSource ?? "none"}, style=${projectContext.styleSource ?? "none"}`
      );
      lines.push("");

      lines.push("Answered:");
      if (answered.length === 0) {
        lines.push("- (none)");
      } else {
        for (const item of answered) {
          lines.push(`- ${item.title}${item.evidence ? `: ${item.evidence}` : ""}`);
        }
      }

      lines.push("");
      if (missing.length === 0) {
        lines.push("Missing items: (none)");
      } else {
        lines.push(`Missing items (${missing.length}) - Proposed defaults below:\n`);
        for (const item of missing) {
          const defaultValue = proposedDefaults[item.id];
          const guideRefs = item.guideIds.length ? ` [guides: ${item.guideIds.join(", ")}]` : "";
          if (defaultValue) {
            lines.push(`## ${item.title}`);
            lines.push(`Question: ${item.question}`);
            lines.push(`✓ Proposed: ${defaultValue}`);
            lines.push(`${guideRefs}`);
            lines.push("");
          } else {
            const hint = item.answerHint ? ` Hint: ${item.answerHint}` : "";
            lines.push(`- ${item.title}: ${item.question}${guideRefs}${hint}`);
          }
        }

        lines.push("");
        lines.push("---");
        lines.push("Would you like to proceed with these proposed defaults? If yes:");
        lines.push("1. Review the proposed values above");
        lines.push("2. Edit project/info.md to include these answers under the corresponding sections");
        lines.push("3. Run project-preflight again to validate");
        lines.push("4. Run generate-project-todo to refresh project/TODO.md");
        lines.push("5. Run generate-project-instructions to rebuild .github/copilot-instructions.md");
      }

      if (parsed.includeTemplate ?? true) {
        lines.push("");
        lines.push("---");
        lines.push("");
        lines.push("Template for manual edits:");
        lines.push(buildChecklistTemplate());
      }

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n")
          }
        ]
      };
    }
  );

  server.registerTool(
    "list-docs",
    {
      title: "List Package Docs",
      description: "List known docs sources by id (used by search-docs).",
      inputSchema: {}
    },
    async () => {
      const listText = docsRegistry.map((d) => `- ${d.id}: ${d.title} -> ${d.urls.join(" | ")}`).join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Known docs sources (use with search-docs):\n${listText}`
          }
        ]
      };
    }
  );

  server.registerTool(
    "search-docs",
    {
      title: "Search Package Docs",
      description: "Search known docs sources by id without providing URLs.",
      inputSchema: z.object({
        docId: z.string().describe("Docs id (run list-docs to see options)").min(1),
        query: z.string().describe("Keyword/phrase to search for").min(1),
        maxMatchesPerUrl: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Max snippets per URL (default 5, max 20)"),
        maxUrls: z.number().int().min(1).max(10).optional().describe("Max URLs to search (default: all, max 10)")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          docId: z.string().min(1),
          query: z.string().min(1),
          maxMatchesPerUrl: z.number().int().min(1).max(20).optional(),
          maxUrls: z.number().int().min(1).max(10).optional()
        })
        .parse(input);

      const entry = docsMap.get(parsed.docId);
      if (!entry) {
        return {
          content: [
            {
              type: "text",
              text: `Unknown docId: ${parsed.docId}. Run list-docs to see available ids.`
            }
          ]
        };
      }

      const urls = entry.urls.slice(0, parsed.maxUrls ?? entry.urls.length);
      const maxMatches = parsed.maxMatchesPerUrl ?? 5;
      const sections: string[] = [];

      for (const url of urls) {
        const page = await fetchPageText(url, 12_000);
        if (!page.ok) {
          sections.push(`URL: ${url}\nHTTP ${page.status}\nPreview:\n${page.text.slice(0, 600)}`);
          continue;
        }

        const matches = findQuerySnippets(page.text, parsed.query, maxMatches);
        if (matches.length === 0) continue;

        const bullets = matches.map((m, i) => `${i + 1}. ${m}`).join("\n\n");
        sections.push(`URL: ${url}\n\n${bullets}`);
      }

      if (sections.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No matches for "${parsed.query}" in ${entry.title} (${entry.id}).\nSearched URLs:\n- ${urls.join("\n- ")}`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Matches for "${parsed.query}" in ${entry.title} (${entry.id}):\n\n${sections.join("\n\n---\n\n")}`
          }
        ]
      };
    }
  );

  server.registerTool(
    "fetch-web-doc",
    {
      title: "Fetch / Search Web Docs",
      description:
        "Fetch a public documentation URL and optionally search it for a query. Returns a cleaned text preview or matching snippets.",
      inputSchema: z.object({
        url: z
          .string()
          .url()
          .describe("Public https URL to fetch (e.g. https://docs.uniwind.dev/migration-from-nativewind)"),
        query: z.string().optional().describe("Optional keyword/phrase to search for within the page text"),
        maxMatches: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Optional maximum number of matching snippets to return (default 5, max 20)")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          url: z.string().url(),
          query: z.string().optional(),
          maxMatches: z.number().int().min(1).max(20).optional()
        })
        .parse(input);

      try {
        const page = await fetchPageText(parsed.url, 12_000);
        const text = page.text;

        if (!page.ok) {
          return {
            content: [
              {
                type: "text",
                text: `HTTP ${page.status} from ${parsed.url}\n\nPreview (cleaned):\n${text.slice(0, 2000)}`
              }
            ]
          };
        }

        const query = (parsed.query ?? "").trim();
        if (query) {
          const matches = findQuerySnippets(text, query, parsed.maxMatches ?? 5);
          if (matches.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No matches for "${query}" in ${parsed.url}.\n\nPreview (cleaned):\n${text.slice(0, 2500)}`
                }
              ]
            };
          }

          const bullets = matches.map((m, i) => `${i + 1}. ${m}`).join("\n\n");
          return {
            content: [
              {
                type: "text",
                text: `Matches for "${query}" in ${parsed.url}:\n\n${bullets}`
              }
            ]
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Fetched ${parsed.url}.\n\nPreview (cleaned):\n${text.slice(0, 4000)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch ${parsed.url}. Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  server.registerTool(
    "smart-help",
    {
      title: "Smart Help (Guides + Live Docs)",
      description:
        "Auto-select relevant PokePages guides and query live docs sources. Use this when you want the server to choose the right guide(s)/docs automatically for a question.",
      inputSchema: z.object({
        question: z.string().min(1).describe("Your question"),
        preferGuides: z.boolean().optional().describe("Include guide excerpts (default true)"),
        preferDocs: z.boolean().optional().describe("Query live docs sources (default true)"),
        guideIds: z.array(z.string()).optional().describe("Optional explicit guide ids (overrides auto-selection)"),
        docIds: z.array(z.string()).optional().describe("Optional explicit docs ids (overrides auto-selection)"),
        docQuery: z.string().optional().describe("Override docs query term (default: inferred from question)"),
        maxDocIds: z.number().int().min(1).max(5).optional().describe("Limit auto-selected docIds (default 2)"),
        maxUrlsPerDoc: z.number().int().min(1).max(5).optional().describe("Limit URLs per docId (default 2)"),
        maxMatchesPerUrl: z.number().int().min(1).max(10).optional().describe("Max matches per URL (default 3)"),
        guideExcerptChars: z.number().int().min(200).max(4000).optional().describe("Guide excerpt length (default 1200 chars)")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          question: z.string().min(1),
          preferGuides: z.boolean().optional(),
          preferDocs: z.boolean().optional(),
          guideIds: z.array(z.string()).optional(),
          docIds: z.array(z.string()).optional(),
          docQuery: z.string().optional(),
          maxDocIds: z.number().int().min(1).max(5).optional(),
          maxUrlsPerDoc: z.number().int().min(1).max(5).optional(),
          maxMatchesPerUrl: z.number().int().min(1).max(10).optional(),
          guideExcerptChars: z.number().int().min(200).max(4000).optional()
        })
        .parse(input);

      const includeGuides = parsed.preferGuides ?? true;
      const includeDocs = parsed.preferDocs ?? true;
      const guideExcerptChars = parsed.guideExcerptChars ?? 1200;

      const selectedGuideIds = parsed.guideIds ? uniqueKeepOrder(parsed.guideIds) : pickGuideIds(parsed.question);
      const autoDocIds = pickDocIds(parsed.question);
      const selectedDocIds = parsed.docIds
        ? uniqueKeepOrder(parsed.docIds)
        : autoDocIds.slice(0, parsed.maxDocIds ?? 2);

      const docQuery = (parsed.docQuery ?? extractDocQuery(parsed.question)).trim();
      const maxUrlsPerDoc = parsed.maxUrlsPerDoc ?? 2;
      const maxMatchesPerUrl = parsed.maxMatchesPerUrl ?? 3;
      const fetchTimeoutMs = 10_000;

      const sections: string[] = [];
      sections.push(`Question:\n${parsed.question}`);

      if (includeGuides) {
        const guideLines: string[] = [];
        for (const guideId of selectedGuideIds) {
          const guide = guideMap.get(guideId);
          if (!guide) continue;

          const filePath = path.join(guidesDir, guide.fileName);
          const uri = toFileUri(filePath);
          const { text } = await loadGuide(guidesDir, guide.fileName);
          const excerpt = truncateText(text, guideExcerptChars);
          guideLines.push(`- ${guide.title} (${guide.id}) -> ${uri}\n  Excerpt:\n${excerpt}`);
        }

        sections.push(
          guideLines.length
            ? `Selected guide(s):\n${guideLines.join("\n\n")}`
            : `Selected guide(s):\n(no matching guides found)`
        );
      }

      if (includeDocs) {
        if (!docQuery) {
          sections.push(
            `Docs search skipped: could not infer a good query term. Provide \"docQuery\" or ask with a specific keyword (e.g. \"ThemeProvider\").`
          );
        } else if (selectedDocIds.length === 0) {
          sections.push(
            `Docs search skipped: no relevant doc sources inferred. Use \"search-docs\" directly or provide \"docIds\".`
          );
        } else {
          const docSections: string[] = [];
          for (const docId of selectedDocIds) {
            const entry = docsMap.get(docId);
            if (!entry) continue;

            const urls = entry.urls.slice(0, Math.min(maxUrlsPerDoc, entry.urls.length));
            const matchesByUrl: string[] = [];

            const settled = await Promise.allSettled(
              urls.map(async (url) => {
                const page = await fetchPageText(url, fetchTimeoutMs);
                return { url, page };
              })
            );

            for (const result of settled) {
              if (result.status === "rejected") {
                matchesByUrl.push(
                  `URL: (unknown)\nError: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
                );
                continue;
              }

              const { url, page } = result.value;
              if (!page.ok) {
                matchesByUrl.push(`URL: ${url}\nHTTP ${page.status}\nPreview:\n${truncateText(page.text, 600)}`);
                continue;
              }

              const matches = findQuerySnippets(page.text, docQuery, maxMatchesPerUrl);
              if (matches.length === 0) continue;
              const bullets = matches.map((m, i) => `${i + 1}. ${m}`).join("\n\n");
              matchesByUrl.push(`URL: ${url}\n\n${bullets}`);
            }

            if (matchesByUrl.length === 0) {
              docSections.push(`- ${entry.title} (${entry.id}): no matches for \"${docQuery}\" in:\n  - ${urls.join("\n  - ")}`);
            } else {
              docSections.push(`- ${entry.title} (${entry.id}) matches for \"${docQuery}\":\n\n${matchesByUrl.join("\n\n---\n\n")}`);
            }
          }

          sections.push(`Docs search (${docQuery}):\n${docSections.join("\n\n")}`);
        }
      }

      sections.push(
        "Tip: If results are too broad or empty, rerun with a tighter keyword using search-docs, or pass docQuery/docIds explicitly."
      );

      return {
        content: [
          {
            type: "text",
            text: sections.join("\n\n---\n\n")
          }
        ]
      };
    }
  );

  server.registerTool(
    "convert-styling",
    {
      title: "Convert Styling (Uniwind)",
      description:
        "Scan a project for styling usage and (optionally) apply best-effort Uniwind migration steps using the local styling guide as reference.",
      inputSchema: ConvertStylingInputSchema
    },
    async (input: unknown) => {
      const stylingGuideFile = guideMap.get("styling")?.fileName ?? "styling.md";
      const stylingGuidePath = path.join(guidesDir, stylingGuideFile);
      const guideText = await readFile(stylingGuidePath, "utf8");

      return runConvertStylingTool({
        input,
        projectRootFallback: process.env.MCP_PROJECT_ROOT ?? process.cwd(),
        guideText
      });
    }
  );

  server.registerTool(
    "update-app-naming",
    {
      title: "Update App Naming",
      description: "Update app name across package.json, app.json, public/manifest.webmanifest, and bundle identifiers.",
      inputSchema: z.object({
        projectRoot: z.string().optional().describe("Absolute path to project root (default MCP_PROJECT_ROOT or cwd)"),
        displayName: z.string().describe("Human-readable app name (e.g., 'My App', 'Creatisphere')"),
        companyDomain: z.string().optional().describe("Company domain for bundle ID (e.g., 'com.yourcompany'; default 'com.example')"),
        apply: z.boolean().optional().describe("Apply changes to files (default true)")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          projectRoot: z.string().optional(),
          displayName: z.string(),
          companyDomain: z.string().optional(),
          apply: z.boolean().optional()
        })
        .parse(input);

      const projectRoot = resolveProjectRoot(parsed.projectRoot);
      const displayName = parsed.displayName;
      const companyDomain = parsed.companyDomain ?? "com.example";
      const shouldApply = parsed.apply ?? true;

      // Derive naming variants
      const slug = displayName.toLowerCase().replace(/\s+/g, "");
      const packageName = displayName.toLowerCase().replace(/\s+/g, "-");
      const scheme = displayName.toLowerCase().replace(/\s+/g, "-");
      const bundleId = `${companyDomain}.${slug}`;
      const shortName = displayName.split(" ")[0].substring(0, 12);

      const updates: { file: string; before: string; after: string; description: string }[] = [];

      // Update package.json
      try {
        const packageJsonPath = path.join(projectRoot, "package.json");
        const packageContent = await readFile(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageContent);
        const oldPackageName = packageJson.name;
        packageJson.name = packageName;
        const newPackageContent = JSON.stringify(packageJson, null, 2) + "\n";

        if (shouldApply && oldPackageName !== packageName) {
          await writeFile(packageJsonPath, newPackageContent, "utf8");
        }

        updates.push({
          file: "package.json",
          before: `"name": "${oldPackageName}"`,
          after: `"name": "${packageName}"`,
          description: "Updated npm package name"
        });
      } catch (err) {
        updates.push({
          file: "package.json",
          before: "",
          after: "",
          description: `Error: ${err instanceof Error ? err.message : "Unknown error"}`
        });
      }

      // Update app.json
      try {
        const appJsonPath = path.join(projectRoot, "app.json");
        const appContent = await readFile(appJsonPath, "utf8");
        const appJson = JSON.parse(appContent);

        const oldName = appJson.expo?.name;
        const oldSlug = appJson.expo?.slug;
        const oldScheme = appJson.expo?.scheme;
        const oldIosBundleId = appJson.expo?.ios?.bundleIdentifier;
        const oldAndroidPackage = appJson.expo?.android?.package;

        if (!appJson.expo) appJson.expo = {};
        appJson.expo.name = displayName;
        appJson.expo.slug = slug;
        appJson.expo.scheme = scheme;
        if (!appJson.expo.ios) appJson.expo.ios = {};
        appJson.expo.ios.bundleIdentifier = bundleId;
        if (!appJson.expo.android) appJson.expo.android = {};
        appJson.expo.android.package = bundleId;

        const newAppContent = JSON.stringify(appJson, null, 2) + "\n";

        if (shouldApply) {
          await writeFile(appJsonPath, newAppContent, "utf8");
        }

        updates.push({
          file: "app.json (expo.name)",
          before: oldName ?? "(not set)",
          after: displayName,
          description: "Updated app display name"
        });
        updates.push({
          file: "app.json (expo.slug)",
          before: oldSlug ?? "(not set)",
          after: slug,
          description: "Updated app slug"
        });
        updates.push({
          file: "app.json (expo.scheme)",
          before: oldScheme ?? "(not set)",
          after: scheme,
          description: "Updated deep link scheme"
        });
        updates.push({
          file: "app.json (ios.bundleIdentifier)",
          before: oldIosBundleId ?? "(not set)",
          after: bundleId,
          description: "Updated iOS bundle identifier"
        });
        updates.push({
          file: "app.json (android.package)",
          before: oldAndroidPackage ?? "(not set)",
          after: bundleId,
          description: "Updated Android package"
        });
      } catch (err) {
        updates.push({
          file: "app.json",
          before: "",
          after: "",
          description: `Error: ${err instanceof Error ? err.message : "Unknown error"}`
        });
      }

      // Update public/manifest.webmanifest
      try {
        const manifestPath = path.join(projectRoot, "public", "manifest.webmanifest");
        const manifestContent = await readFile(manifestPath, "utf8");
        const manifest = JSON.parse(manifestContent);

        const oldManifestName = manifest.name;
        const oldManifestShortName = manifest.short_name;

        manifest.name = displayName;
        manifest.short_name = shortName;

        const newManifestContent = JSON.stringify(manifest, null, 2) + "\n";

        if (shouldApply) {
          await writeFile(manifestPath, newManifestContent, "utf8");
        }

        updates.push({
          file: "public/manifest.webmanifest (name)",
          before: oldManifestName ?? "(not set)",
          after: displayName,
          description: "Updated PWA manifest name"
        });
        updates.push({
          file: "public/manifest.webmanifest (short_name)",
          before: oldManifestShortName ?? "(not set)",
          after: shortName,
          description: "Updated PWA short name"
        });
      } catch (err) {
        updates.push({
          file: "public/manifest.webmanifest",
          before: "",
          after: "",
          description: `Error: ${err instanceof Error ? err.message : "Unknown error"}`
        });
      }

      const summary = updates
        .map((u) => `${u.file}:\n  Before: ${u.before}\n  After: ${u.after}\n  (${u.description})`)
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `App Naming Update ${shouldApply ? "Applied" : "(Dry-run)"}\n\nDisplay Name: ${displayName}\nSlug: ${slug}\nPackage: ${packageName}\nScheme: ${scheme}\nBundle ID: ${bundleId}\nShort Name: ${shortName}\n\nChanges:\n${summary}`
          }
        ]
      };
    }
  );

  server.registerTool(
    "update-readme",
    {
      title: "Update README",
      description: "Generate or revise README.md based on project info and style context.",
      inputSchema: z.object({
        projectRoot: z.string().optional().describe("Absolute path to project root (default MCP_PROJECT_ROOT or cwd)"),
        apply: z.boolean().optional().describe("Apply changes to README.md (default true)")
      })
    },
    async (input: unknown) => {
      const parsed = z
        .object({
          projectRoot: z.string().optional(),
          apply: z.boolean().optional()
        })
        .parse(input);

      const projectRoot = resolveProjectRoot(parsed.projectRoot);
      const shouldApply = parsed.apply ?? true;

      // Read project context files
      const infoPaths = [
        path.join(projectRoot, "project", "info.md"),
        path.join(projectRoot, "project", "info.txt")
      ];
      const stylePaths = [
        path.join(projectRoot, "project", "style.md"),
        path.join(projectRoot, "project", "style.txt")
      ];
      const appJsonPath = path.join(projectRoot, "app.json");

      let infoText = "";
      for (const filePath of infoPaths) {
        try {
          infoText = await readFile(filePath, "utf8");
          break;
        } catch {
          // Continue to next path
        }
      }

      let styleText = "";
      for (const filePath of stylePaths) {
        try {
          styleText = await readFile(filePath, "utf8");
          break;
        } catch {
          // Continue to next path
        }
      }

      let appName = "My App";
      try {
        const appContent = await readFile(appJsonPath, "utf8");
        const appJson = JSON.parse(appContent);
        appName = appJson.expo?.name ?? appName;
      } catch {
        // Use default
      }

      // Generate README content
      const readmeLines: string[] = [
        `# ${appName}`,
        ""
      ];

      if (infoText) {
        readmeLines.push("## About");
        readmeLines.push("");
        readmeLines.push(infoText.replace(/^#+\s+/gm, "").trim());
        readmeLines.push("");
      }

      if (styleText) {
        readmeLines.push("## Style & Design");
        readmeLines.push("");
        readmeLines.push(styleText.replace(/^#+\s+/gm, "").trim());
        readmeLines.push("");
      }

      if (!infoText && !styleText) {
        readmeLines.push("## Getting Started");
        readmeLines.push("");
        readmeLines.push("This project is built with Expo Router and React Native.");
        readmeLines.push("");
      }

      readmeLines.push("## Development");
      readmeLines.push("");
      readmeLines.push("```bash");
      readmeLines.push("npm install");
      readmeLines.push("npm start");
      readmeLines.push("```");
      readmeLines.push("");

      const readmeContent = readmeLines.join("\n");
      const readmePath = path.join(projectRoot, "README.md");

      let oldReadmeContent = "(README does not exist yet)";
      try {
        oldReadmeContent = await readFile(readmePath, "utf8");
      } catch {
        // File doesn't exist, use default message
      }

      if (shouldApply) {
        await writeFile(readmePath, readmeContent, "utf8");
      }

      return {
        content: [
          {
            type: "text",
            text: `README.md ${shouldApply ? "Updated" : "(Dry-run)"}\n\nGenerated from:\n- Project Info: ${infoText ? "Found" : "Not found"}\n- Project Style: ${styleText ? "Found" : "Not found"}\n- App Name: ${appName}\n\nNew README:\n${readmeContent}`
          }
        ]
      };
    }
  );
}
