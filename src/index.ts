import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { ConvertStylingInputSchema, runConvertStylingTool } from "./convertStyling.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const guidesDir = path.join(__dirname, "..", "guides");

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

type PortfolioResource = {
  id: string;
  title: string;
  fileName: string;
  description: string;
};

type PortfolioTool = {
  name: string;
  title: string;
  description: string;
  schema: Record<string, unknown>;
};

type PortfolioPrompt = {
  name: string;
  title: string;
  description: string;
  args: string[];
};

type PortfolioEndpoint = {
  id: string;
  title: string;
  method?: string;
  url: string;
  description?: string;
  transport?: string;
  contentType?: string;
};

const PORTFOLIO_SERVER_ID = "mrdj-app-mcp";
const PORTFOLIO_MCP_ENDPOINT_URL = "https://davidjgrimsley.com/mcp/mrdj-app-mcp/mcp";
const PORTFOLIO_GITHUB_REPO_URL = "https://github.com/DavidJGrimsley/mrdj-app-mcp";

// Keep these arrays in the exact order expected by the portfolio UI.
const PORTFOLIO_RESOURCES: PortfolioResource[] = [
  { id: "architecture", title: "Architecture", fileName: "architecture.md", description: "Stack, structure, and conventions for PokePages." },
  { id: "state-management", title: "State Management", fileName: "stateManagement.md", description: "Zustand patterns, selectors, persistence, and performance tips." },
  { id: "database-architecture", title: "Database Architecture", fileName: "databaseArchitecture.md", description: "Drizzle + Supabase schema patterns, RLS, and migration practices." },
  { id: "routing", title: "Routing", fileName: "routing.md", description: "Expo Router layouts, guards, deep linking, and SEO head usage." },
  { id: "styling", title: "Styling", fileName: "styling.md", description: "NativeWind setup, class patterns, dark mode, and responsive rules." },
  { id: "performance", title: "Performance", fileName: "performance.md", description: "React Native perf checklist: startup, rerenders, lists, and animation." },
  { id: "animation", title: "Animation", fileName: "animation.md", description: "Reanimated setup, shared values, gestures, layout animations, and patterns." },
  { id: "meta-tags", title: "Meta Tags", fileName: "metaTags.md", description: "SEO/meta templates for Expo Router (OG/Twitter/structured data)." },
  { id: "offline-first", title: "Offline First", fileName: "offlineFirst.md", description: "Conflict resolution, sync strategy, storage, and NetInfo guidance." },
  { id: "plesk-deployment", title: "Plesk Deployment", fileName: "pleskDeployment.md", description: "Plesk web/API deployment steps, env management, and rollback notes." },
  { id: "build-scripts", title: "Build Scripts", fileName: "buildScripts.md", description: "Sitemap generator and API build workflows." },
  { id: "backend-best-practices", title: "Backend Best Practices", fileName: "backendBestPractices.md", description: "Node.js/Express best practices: CORS, caching, security, error handling, logging, and API design." }
];

const PORTFOLIO_TOOLS: PortfolioTool[] = [
  {
    name: "list-guides",
    title: "List Copilot Guides",
    description: "Return the available copilot guides as resource links",
    schema: {}
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
  }
];

const PORTFOLIO_PROMPTS: PortfolioPrompt[] = [
  {
    name: "architecture-help",
    title: "Architecture and DB helper",
    description: "Answer architecture or database design questions using the architecture and database guides",
    args: ["question"]
  },
  {
    name: "state-store-template",
    title: "Zustand store helper",
    description: "Generate a Zustand store plan using the state management guide",
    args: ["storeName", "concern", "persistence"]
  },
  {
    name: "routing-checklist",
    title: "Routing checklist",
    description: "Provide an Expo Router checklist for a screen or flow",
    args: ["route"]
  }
];

const PORTFOLIO_ENDPOINTS: PortfolioEndpoint[] = [
  {
    id: "mcp-endpoint",
    title: "MCP Endpoint",
    method: "GET",
    url: "https://davidjgrimsley.com/mcp/mrdj-app-mcp/mcp",
    description: "Primary MCP server endpoint (SSE transport).",
    transport: "sse",
    contentType: "text/event-stream"
  },
    {
    id: "sse-messages",
    title: "SSE Messages (POST)",
    method: "POST",
    url: "https://davidjgrimsley.com/mcp/mrdj-app-mcp/messages",
    description: "SSE transport message endpoint (used by legacy SSE MCP clients).",
    transport: "sse",
    contentType: "application/json"
  },
  {
    id: "portfolio-json",
    title: "Portfolio Metadata (portfolio.json)",
    method: "GET",
    url: "https://davidjgrimsley.com/mcp/mrdj-app-mcp/portfolio.json",
    description: "The metadata that powers this page. Pretty meta huh?",
    contentType: "application/json"
  },
  {
    id: "health",
    title: "Health Check",
    method: "GET",
    url: "https://davidjgrimsley.com/mcp/mrdj-app-mcp/health",
    description: "Server health status endpoint.",
    contentType: "application/json"
  }
];

let cachedPackageVersion: string | null = null;

async function getPackageVersion(): Promise<string> {
  if (cachedPackageVersion) return cachedPackageVersion;

  const packageJsonPath = path.join(__dirname, "..", "package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: unknown };
  const version = typeof parsed.version === "string" ? parsed.version : "0.0.0";
  cachedPackageVersion = version;
  return version;
}

const guides: GuideSpec[] = [
  { id: "architecture", title: "Architecture", fileName: "architecture.md", description: "Stack, structure, and conventions for PokePages." },
  { id: "state-management", title: "State Management", fileName: "stateManagement.md", description: "Zustand patterns, selectors, persistence, and performance tips." },
  { id: "database-architecture", title: "Database Architecture", fileName: "databaseArchitecture.md", description: "Drizzle + Supabase schema patterns, RLS, and migration practices." },
  { id: "routing", title: "Routing", fileName: "routing.md", description: "Expo Router layouts, guards, deep linking, and SEO head usage." },
  { id: "styling", title: "Styling", fileName: "styling.md", description: "Uniwind setup, class patterns, theming in CSS, and responsive rules." },
  { id: "performance", title: "Performance", fileName: "performance.md", description: "React Native perf checklist: startup, rerenders, lists, and animation." },
  { id: "animation", title: "Animation", fileName: "animation.md", description: "Reanimated setup, shared values, gestures, layout animations, and patterns." },
  { id: "meta-tags", title: "Meta Tags", fileName: "metaTags.md", description: "SEO/meta templates for Expo Router (OG/Twitter/structured data)." },
  { id: "offline-first", title: "Offline First", fileName: "offlineFirst.md", description: "Conflict resolution, sync strategy, storage, and NetInfo guidance." },
  { id: "plesk-deployment", title: "Plesk Deployment", fileName: "pleskDeployment.md", description: "Plesk web/API deployment steps, env management, and rollback notes." },
  { id: "build-scripts", title: "Build Scripts", fileName: "buildScripts.md", description: "Sitemap generator and API build workflows." },
  { id: "index", title: "Index", fileName: "index.md", description: "Top-level index linking all copilot guides." },
  { id: "general", title: "General (legacy)", fileName: "general.md", description: "Older combined guidance; superseded by topic-specific guides." }
];

const guideMap = new Map(guides.map((g) => [g.id, g]));

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
  const q = question.toLowerCase();
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

  // If nothing matched, default to index as a starting point.
  if (guideIds.length === 0) guideIds.push("index");

  // Cap to keep responses small.
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

  // General fallback: MCP docs can help if the question is about MCP itself.
  if (q.includes("mcp") || q.includes("model context protocol")) docIds.push("mcp");

  return uniqueKeepOrder(docIds);
}

function extractDocQuery(question: string): string {
  const backticked = question.match(/`([^`]{2,60})`/);
  if (backticked?.[1]) return backticked[1];

  // Prefer identifiers that look like APIs/config keys.
  // Avoid grabbing sentence-start words like "Please" by requiring an internal capital.
  const pascalOrCamel =
    question.match(/\b[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*\b/) ??
    question.match(/\b[a-z][a-z0-9]+[A-Z][A-Za-z0-9]*\b/);
  if (pascalOrCamel?.[0]) return pascalOrCamel[0];

  // Prefer kebab-case identifiers like expo-router.
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

function toFileUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return `file:///${normalized}`;
}

async function loadGuide(fileName: string): Promise<{ uri: string; text: string }> {
  const filePath = path.join(guidesDir, fileName);
  const text = await readFile(filePath, "utf8");
  return { uri: toFileUri(filePath), text };
}

const server = new McpServer(
  {
    name: "mrdj-app-mcp",
    version: "0.1.0",
    description: "Local PokePages copilot guides exposed as MCP resources and prompts."
  },
  {
    capabilities: {
      resources: {},
      prompts: {},
      tools: {}
    }
  }
);

guides.forEach((guide) => {
  server.registerResource(
    guide.id,
    toFileUri(path.join(guidesDir, guide.fileName)),
    {
      title: guide.title,
      description: guide.description,
      mimeType: "text/markdown"
    },
    async () => {
      const { uri, text } = await loadGuide(guide.fileName);
      return {
        contents: [
          {
            uri,
            text
          }
        ]
      };
    }
  );
});

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
        const filePath = path.join(guidesDir, guide.fileName);
        return `- ${guide.title} (${guide.description}) -> ${toFileUri(filePath)}`;
      })
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Available copilot guides (open with readResource):\n${listText}`
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
    const listText = docsRegistry
      .map((d) => `- ${d.id}: ${d.title} -> ${d.urls.join(" | ")}`)
      .join("\n");

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
        const { text } = await loadGuide(guide.fileName);
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
              matchesByUrl.push(`URL: (unknown)\nError: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
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

server.registerPrompt(
  "architecture-help",
  {
    title: "Architecture and DB helper",
    description: "Answer architecture or database design questions using the architecture and database guides",
    argsSchema: {
      question: z.string().describe("Your question about architecture or database design")
    }
  },
  async ({ question }) => {
    const architectureUri = toFileUri(path.join(guidesDir, guideMap.get("architecture")?.fileName ?? ""));
    const dbUri = toFileUri(path.join(guidesDir, guideMap.get("database-architecture")?.fileName ?? ""));

    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: "Use the PokePages architecture and database guides. Keep answers concise, prefer ordered steps, and surface risks or trade-offs."
          }
        },
        {
          role: "user",
          content: {
            type: "text",
            text: `Question: ${question}\nResources:\n- ${architectureUri}\n- ${dbUri}`
          }
        }
      ]
    };
  }
);

server.registerPrompt(
  "state-store-template",
  {
    title: "Zustand store helper",
    description: "Generate a Zustand store plan using the state management guide",
    argsSchema: {
      storeName: z.string().describe("Name of the store or feature area"),
      concern: z.string().describe("What the store manages (auth, list data, filters, ui flags, etc.)"),
      persistence: z.enum(["none", "device", "secure", "session"]).optional().describe("Persistence level: none/device/secure/session")
    }
  },
  async ({ storeName, concern, persistence }) => {
    const stateUri = toFileUri(path.join(guidesDir, guideMap.get("state-management")?.fileName ?? ""));

    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: "Follow the PokePages state management guide: use selectors, avoid unnecessary rerenders, keep actions small, and document persistence choices."
          }
        },
        {
          role: "user",
          content: {
            type: "text",
            text: `Create a Zustand store for ${storeName}. Concern: ${concern}. Persistence: ${persistence ?? "unspecified"}. Use guidance from ${stateUri}. Output: shape, initial state, actions, selector examples, and storage choice.`
          }
        }
      ]
    };
  }
);

server.registerPrompt(
  "routing-checklist",
  {
    title: "Routing checklist",
    description: "Provide an Expo Router checklist for a screen or flow",
    argsSchema: {
      route: z.string().describe("Route segment or screen name")
    }
  },
  async ({ route }) => {
    const routingUri = toFileUri(path.join(guidesDir, guideMap.get("routing")?.fileName ?? ""));

    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: "Use the routing guide. Include layout placement, group usage, guards, head meta, deep links, and file naming."
          }
        },
        {
          role: "user",
          content: {
            type: "text",
            text: `Build a routing checklist for ${route}. Include: segment path, layout files, middleware/guards, search params, modals/sheets, head metadata, deep links, and testing steps. Reference: ${routingUri}.`
          }
        }
      ]
    };
  }
);

async function main() {
  // Check for --http-port flag
  const args = process.argv.slice(2);
  const httpPortIndex = args.indexOf("--http-port");
  const useHttp = httpPortIndex !== -1 && args[httpPortIndex + 1];

  // Optional: default project root for scanning tools
  const projectRootIndex = args.indexOf("--project-root");
  const projectRootValue = projectRootIndex !== -1 ? args[projectRootIndex + 1] : undefined;
  if (projectRootValue) {
    process.env.MCP_PROJECT_ROOT = path.resolve(projectRootValue);
    console.error(`MCP project root set to: ${process.env.MCP_PROJECT_ROOT}`);
  }
  
  if (useHttp) {
    const port = parseInt(args[httpPortIndex + 1], 10);
    if (isNaN(port)) {
      console.error("Invalid port number");
      process.exit(1);
    }
    
    // HTTP/SSE mode
    const app = express();
    
    // Enable CORS for open access
    app.use(cors({
      origin: "*", // Allow all origins for open access
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    }));
    
    // External path clients will POST to (through nginx)
    const sseMessagesPathExternal = "/mcp/mrdj-app-mcp/messages";
    // Internal path nginx proxies to
    const sseMessagesPathInternal = "/mcp/messages";
    
    // Apply JSON body parsing only to non-SSE message routes
    // SSE transport needs raw stream access
    app.use((req, res, next) => {
      if (req.path === sseMessagesPathExternal || req.path === sseMessagesPathInternal) {
        // Skip body parsing for SSE message endpoints
        next();
      } else {
        express.json()(req, res, next);
      }
    });
    
    // Store transports by session ID (for both Streamable HTTP and SSE)
    const transports: Record<string, StreamableHTTPServerTransport> = {};
    const sseTransports: Record<string, SSEServerTransport> = {};
    
    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.json({ status: "ok", service: "mrdj-app-mcp", version: "0.1.0" });
    });

    // Portfolio metadata endpoint (public REST; not MCP; not SSE)
    // Supports CORS preflight (OPTIONS) and conditional requests (If-None-Match)
    app.options("/portfolio.json", (_req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).end();
    });

    app.get("/portfolio.json", async (req, res) => {
      try {
        const version = await getPackageVersion();
        const payload = {
          server: {
            id: PORTFOLIO_SERVER_ID,
            name: PORTFOLIO_SERVER_ID,
            version,
            mcpEndpointUrl: PORTFOLIO_MCP_ENDPOINT_URL,
            githubRepoUrl: PORTFOLIO_GITHUB_REPO_URL
          },
          resources: PORTFOLIO_RESOURCES,
          tools: PORTFOLIO_TOOLS,
          prompts: PORTFOLIO_PROMPTS,
          endpoints: PORTFOLIO_ENDPOINTS
        };

        // Compute ETag for conditional requests
        const payloadStr = JSON.stringify(payload);
        const hash = createHash("sha1").update(payloadStr, "utf8").digest("hex");
        const etag = `"${hash.slice(0, 16)}"`;

        // Set caching headers
        res.set("Cache-Control", "public, max-age=300");
        res.set("ETag", etag);

        // Check If-None-Match for conditional request (304)
        const clientEtag = req.headers["if-none-match"];
        if (clientEtag === etag) {
          return res.status(304).end();
        }

        // Return 200 with JSON payload
        res.json(payload);
      } catch (error) {
        console.error("Error building /portfolio.json response:", error);
        res.status(500).json({ error: "portfolio_meta_failed" });
      }
    });

    // Store heartbeat intervals for cleanup
    const sseHeartbeats: Record<string, NodeJS.Timeout> = {};

    // MCP endpoint (Streamable HTTP + SSE fallback). VS Code should point here.
    app.all("/mcp", async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      const acceptHeader = req.headers.accept || "";
      const isSseRequest = req.method === "GET" && acceptHeader.includes("text/event-stream") && !sessionId;

      if (isSseRequest) {
        console.error("Handling legacy SSE MCP request");
        // Use external path so client POSTs to the right nginx location
        const transport = new SSEServerTransport(sseMessagesPathExternal, res);
        
        // Store the SSE transport by its actual session ID (set by the transport)
        // The transport's sessionId is available after construction
        const actualSessionId = transport.sessionId;
        sseTransports[actualSessionId] = transport;
        console.error(`SSE session created with transport sessionId: ${actualSessionId}`);
        
        // Send SSE heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            if (!res.writableEnded) {
              res.write(`:heartbeat\n\n`);
            } else {
              clearInterval(heartbeatInterval);
              delete sseHeartbeats[actualSessionId];
            }
          } catch (error) {
            console.error(`Heartbeat error for session ${actualSessionId}:`, error);
            clearInterval(heartbeatInterval);
            delete sseHeartbeats[actualSessionId];
          }
        }, 30000);
        sseHeartbeats[actualSessionId] = heartbeatInterval;
        
        transport.onclose = () => {
          console.error(`SSE session closed: ${actualSessionId}`);
          if (sseHeartbeats[actualSessionId]) {
            clearInterval(sseHeartbeats[actualSessionId]);
            delete sseHeartbeats[actualSessionId];
          }
          delete sseTransports[actualSessionId];
        };
        
        // Also handle response close event
        res.on('close', () => {
          if (sseHeartbeats[actualSessionId]) {
            clearInterval(sseHeartbeats[actualSessionId]);
            delete sseHeartbeats[actualSessionId];
          }
        });
        
        try {
          await server.connect(transport);
        } catch (error) {
          console.error("Error handling SSE MCP request:", error);
          if (sseHeartbeats[actualSessionId]) {
            clearInterval(sseHeartbeats[actualSessionId]);
            delete sseHeartbeats[actualSessionId];
          }
          delete sseTransports[actualSessionId];
          if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
          }
        }
        return;
      }

      console.error(`${req.method} /mcp session: ${sessionId || 'new'} Accept: ${acceptHeader}`);

      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
        console.error(`Reusing transport for session ${sessionId}`);
      } else {
        console.error('Creating new transport');
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            console.error(`New MCP session initialized: ${newSessionId}`);
            transports[newSessionId] = transport;
          }
        });

        transport.onclose = () => {
          const sid = Object.keys(transports).find(k => transports[k] === transport);
          if (sid) {
            console.error(`MCP session closed: ${sid}`);
            delete transports[sid];
          }
        };

        console.error('Connecting server to transport');
        await server.connect(transport);
        console.error('Server connected to transport');
      }

      try {
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // SSE Messages endpoint - handle both internal path (nginx proxied) and external path
    const handleSseMessage = async (req: express.Request, res: express.Response) => {
      const sessionId = req.query.sessionId as string;
      console.error(`SSE POST message received, sessionId: ${sessionId}`);
      
      const transport = sseTransports[sessionId];
      if (transport) {
        try {
          await transport.handlePostMessage(req, res);
        } catch (error) {
          console.error("Error handling SSE message:", error);
          if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
          }
        }
      } else {
        console.error(`No SSE transport found for session: ${sessionId}`);
        res.status(404).json({ error: "Session not found" });
      }
    };
    
    // Register both paths for SSE messages (internal for nginx proxy, external for direct)
    app.post(sseMessagesPathInternal, handleSseMessage);
    app.post(sseMessagesPathExternal, handleSseMessage);
    
    const httpServer = app.listen(port, () => {
      console.error(`mrdj-app-mcp MCP server running on http://localhost:${port}`);
      console.error(`Health check: http://localhost:${port}/health`);
      console.error(`MCP endpoint: http://localhost:${port}/mcp`);
    });
    
    // Keep server alive
    process.on("SIGTERM", () => {
      console.error("SIGTERM received, closing server");
      httpServer.close();
    });
  } else {
    // Stdio mode (default)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("mrdj-app-mcp MCP server running on stdio");
    
    // Keep process alive - without this, Node may exit
    process.stdin.resume();
  }
}

main().catch((error) => {
  console.error("Fatal error in main()", error);
  process.exit(1);
});
