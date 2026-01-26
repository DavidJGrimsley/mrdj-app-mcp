import { z } from "zod";
import path from "node:path";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { ConvertStylingInputSchema, runConvertStylingTool } from "./convertStyling.js";
import { loadGuide, toFileUri } from "./guideUtils.js";
export const PORTFOLIO_TOOLS = [
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
        name: "list-guides",
        title: "List Copilot Guides",
        description: "Return the available copilot guides as resource links",
        schema: {}
    },
    {
        name: "generate-project-instructions",
        title: "Generate Project Instructions",
        description: "Generate .github/copilot-instructions.md from local copilot guides and project context in /project (writes file by default).",
        schema: {
            guideIds: "string[] (optional; default all guides)",
            projectRoot: "string (optional absolute path; default MCP_PROJECT_ROOT or cwd)",
            outputPath: "string (optional; default .github/copilot-instructions.md)",
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
    }
];
const docsRegistry = [
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
const pageCache = new Map();
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
function htmlToText(html) {
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
function findQuerySnippets(text, query, maxMatches) {
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();
    if (!needle)
        return [];
    const snippets = [];
    let startIndex = 0;
    while (snippets.length < maxMatches) {
        const foundIndex = haystack.indexOf(needle, startIndex);
        if (foundIndex === -1)
            break;
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
async function fetchPageText(url, timeoutMs) {
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
    }
    finally {
        clearTimeout(timeout);
    }
}
function uniqueKeepOrder(values) {
    const seen = new Set();
    const out = [];
    for (const v of values) {
        if (seen.has(v))
            continue;
        seen.add(v);
        out.push(v);
    }
    return out;
}
function pickGuideIds(question) {
    const guideIds = [];
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
        if (/meta\s*tags|og\b|open\s*graph|twitter card/i.test(question))
            guideIds.push("meta-tags");
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
    if (guideIds.length === 0)
        guideIds.push("index");
    return uniqueKeepOrder(guideIds).slice(0, 3);
}
function pickDocIds(question) {
    const q = question.toLowerCase();
    const docIds = [];
    if (q.includes("uniwind"))
        docIds.push("uniwind");
    if (q.includes("nativewind"))
        docIds.push("nativewind");
    if (q.includes("tailwind"))
        docIds.push("tailwindcss");
    if (q.includes("expo router") || q.includes("expo-router") || q.includes("router"))
        docIds.push("expo-router");
    if (q.includes("expo"))
        docIds.push("expo");
    if (q.includes("react native") || q.includes("react-native"))
        docIds.push("react-native");
    if (q.includes("reanimated"))
        docIds.push("reanimated");
    if (q.includes("gesture"))
        docIds.push("gesture-handler");
    if (q.includes("safe area") || q.includes("safe-area"))
        docIds.push("safe-area-context");
    if (q.includes("zustand"))
        docIds.push("zustand");
    if (q.includes("supabase"))
        docIds.push("supabase");
    if (q.includes("drizzle"))
        docIds.push("drizzle");
    if (q.includes("zod"))
        docIds.push("zod");
    if (q.includes("clsx"))
        docIds.push("clsx");
    if (q.includes("tailwind-merge") || q.includes("twmerge"))
        docIds.push("tailwind-merge");
    if (q.includes("mcp") || q.includes("model context protocol"))
        docIds.push("mcp");
    return uniqueKeepOrder(docIds);
}
function extractDocQuery(question) {
    const backticked = question.match(/`([^`]{2,60})`/);
    if (backticked?.[1])
        return backticked[1];
    const pascalOrCamel = question.match(/\b[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*\b/) ??
        question.match(/\b[a-z][a-z0-9]+[A-Z][A-Za-z0-9]*\b/);
    if (pascalOrCamel?.[0])
        return pascalOrCamel[0];
    const kebab = question.match(/\b[a-z0-9]+(?:-[a-z0-9]+){1,}\b/i);
    if (kebab?.[0])
        return kebab[0];
    const tokens = question
        .toLowerCase()
        .split(/[^a-z0-9-]+/g)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
    return tokens[0] ?? "";
}
function truncateText(text, maxChars) {
    if (text.length <= maxChars)
        return text;
    return `${text.slice(0, maxChars).trimEnd()}…`;
}
function resolveProjectRoot(inputRoot) {
    if (inputRoot && inputRoot.trim())
        return path.resolve(inputRoot);
    return process.env.MCP_PROJECT_ROOT ? path.resolve(process.env.MCP_PROJECT_ROOT) : process.cwd();
}
function resolveOutputPath(projectRoot, outputPath) {
    if (!outputPath || !outputPath.trim()) {
        return path.join(projectRoot, ".github", "copilot-instructions.md");
    }
    return path.isAbsolute(outputPath) ? outputPath : path.join(projectRoot, outputPath);
}
function ensurePathInsideRoot(projectRoot, filePath) {
    const relative = path.relative(projectRoot, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Output path must be inside project root: ${projectRoot}`);
    }
}
function inferAppType(text) {
    const lower = text.toLowerCase();
    const hasWeb = /(\bweb\b|website|web app|browser|pwa)/i.test(lower);
    const hasMobile = /(mobile|ios|android|expo|react native|\bapp\b)/i.test(lower);
    const hasDesktop = /(desktop|electron|macos|windows)/i.test(lower);
    const tags = [];
    if (hasWeb)
        tags.push("web");
    if (hasMobile)
        tags.push("mobile");
    if (hasDesktop)
        tags.push("desktop");
    if (tags.length === 0)
        return "unspecified";
    if (tags.length === 1 && tags[0] === "mobile")
        return "mobile app";
    return tags.join(" + ");
}
async function readOptionalFile(filePath) {
    try {
        const text = await readFile(filePath, "utf8");
        return text.trim();
    }
    catch {
        return undefined;
    }
}
async function readProjectContext(projectRoot) {
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
function extractSection(text, heading) {
    const lines = text.split(/\r?\n/);
    const headingRegex = new RegExp(`^\s*(#{1,6}\s*)?${escapeRegExp(heading)}\s*:?\s*$`, "i");
    let start = -1;
    for (let i = 0; i < lines.length; i += 1) {
        if (headingRegex.test(lines[i])) {
            start = i + 1;
            break;
        }
    }
    if (start === -1)
        return undefined;
    const sectionLines = [];
    for (let i = start; i < lines.length; i += 1) {
        const line = lines[i];
        if (/^\s*#{1,6}\s+/.test(line))
            break;
        if (headingRegex.test(line))
            continue;
        sectionLines.push(line);
    }
    const cleaned = sectionLines.join("\n").trim();
    return cleaned.length ? cleaned : undefined;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function buildProjectInstructions(params) {
    const sources = [];
    const missingGuideIds = [];
    const sections = [];
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
    return {
        markdown: `${headerLines.join("\n")}${sections.join("\n")}`.trimEnd() + "\n",
        sources,
        missingGuideIds
    };
}
export function registerTools(params) {
    const { server, guides, guideMap, guidesDir } = params;
    server.registerTool("ingest-project-context", {
        title: "Ingest Project Context",
        description: "Convert project/info.txt + project/style.txt into markdown in /project and optionally delete the .txt files.",
        inputSchema: z.object({
            projectRoot: z.string().optional().describe("Absolute path to project root (default MCP_PROJECT_ROOT or cwd)"),
            infoPath: z.string().optional().describe("Path to project info.txt (default project/info.txt)"),
            stylePath: z.string().optional().describe("Path to project style.txt (default project/style.txt)"),
            writeFile: z.boolean().optional().describe("Write the output files (default true)"),
            deleteTxt: z.boolean().optional().describe("Delete source .txt files after conversion (default true)")
        })
    }, async (input) => {
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
            ? parsed.infoPath
            : path.join(projectRoot, parsed.infoPath ?? path.join("project", "info.txt"));
        const styleTxtPath = path.isAbsolute(parsed.stylePath ?? "")
            ? parsed.stylePath
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
        const infoMarkdown = infoTxt ? `# Project Info\n\n${infoTxt.trim()}\n` : undefined;
        const styleMarkdown = styleTxt ? `# Project Style\n\n${styleTxt.trim()}\n` : undefined;
        const shouldWrite = parsed.writeFile ?? true;
        const shouldDelete = parsed.deleteTxt ?? true;
        if (shouldWrite) {
            await mkdir(path.join(projectRoot, "project"), { recursive: true });
            if (infoMarkdown)
                await writeFile(infoMdPath, infoMarkdown, "utf8");
            if (styleMarkdown)
                await writeFile(styleMdPath, styleMarkdown, "utf8");
        }
        if (shouldDelete) {
            if (infoTxt) {
                try {
                    await unlink(infoTxtPath);
                }
                catch {
                    // ignore delete errors
                }
            }
            if (styleTxt) {
                try {
                    await unlink(styleTxtPath);
                }
                catch {
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
    });
    server.registerTool("list-guides", {
        title: "List Copilot Guides",
        description: "Return the available copilot guides as resource links",
        inputSchema: {}
    }, async () => {
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
    });
    server.registerTool("generate-project-instructions", {
        title: "Generate Project Instructions",
        description: "Generate .github/copilot-instructions.md from local copilot guides and project context in /project (writes file by default).",
        inputSchema: z.object({
            guideIds: z.array(z.string()).optional().describe("Guide ids to include (default: all guides)"),
            projectRoot: z.string().optional().describe("Absolute path to project root (default MCP_PROJECT_ROOT or cwd)"),
            outputPath: z
                .string()
                .optional()
                .describe("Output path (default .github/copilot-instructions.md; relative paths are resolved from project root)"),
            writeFile: z.boolean().optional().describe("Write the output file (default true)")
        })
    }, async (input) => {
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
            const contextUsed = projectContext.infoText || projectContext.styleText
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
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to generate instructions. Error: ${error instanceof Error ? error.message : String(error)}`
                    }
                ]
            };
        }
    });
    server.registerTool("list-docs", {
        title: "List Package Docs",
        description: "List known docs sources by id (used by search-docs).",
        inputSchema: {}
    }, async () => {
        const listText = docsRegistry.map((d) => `- ${d.id}: ${d.title} -> ${d.urls.join(" | ")}`).join("\n");
        return {
            content: [
                {
                    type: "text",
                    text: `Known docs sources (use with search-docs):\n${listText}`
                }
            ]
        };
    });
    server.registerTool("search-docs", {
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
    }, async (input) => {
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
        const sections = [];
        for (const url of urls) {
            const page = await fetchPageText(url, 12000);
            if (!page.ok) {
                sections.push(`URL: ${url}\nHTTP ${page.status}\nPreview:\n${page.text.slice(0, 600)}`);
                continue;
            }
            const matches = findQuerySnippets(page.text, parsed.query, maxMatches);
            if (matches.length === 0)
                continue;
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
    });
    server.registerTool("fetch-web-doc", {
        title: "Fetch / Search Web Docs",
        description: "Fetch a public documentation URL and optionally search it for a query. Returns a cleaned text preview or matching snippets.",
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
    }, async (input) => {
        const parsed = z
            .object({
            url: z.string().url(),
            query: z.string().optional(),
            maxMatches: z.number().int().min(1).max(20).optional()
        })
            .parse(input);
        try {
            const page = await fetchPageText(parsed.url, 12000);
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
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to fetch ${parsed.url}. Error: ${error instanceof Error ? error.message : String(error)}`
                    }
                ]
            };
        }
    });
    server.registerTool("smart-help", {
        title: "Smart Help (Guides + Live Docs)",
        description: "Auto-select relevant PokePages guides and query live docs sources. Use this when you want the server to choose the right guide(s)/docs automatically for a question.",
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
    }, async (input) => {
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
        const fetchTimeoutMs = 10000;
        const sections = [];
        sections.push(`Question:\n${parsed.question}`);
        if (includeGuides) {
            const guideLines = [];
            for (const guideId of selectedGuideIds) {
                const guide = guideMap.get(guideId);
                if (!guide)
                    continue;
                const filePath = path.join(guidesDir, guide.fileName);
                const uri = toFileUri(filePath);
                const { text } = await loadGuide(guidesDir, guide.fileName);
                const excerpt = truncateText(text, guideExcerptChars);
                guideLines.push(`- ${guide.title} (${guide.id}) -> ${uri}\n  Excerpt:\n${excerpt}`);
            }
            sections.push(guideLines.length
                ? `Selected guide(s):\n${guideLines.join("\n\n")}`
                : `Selected guide(s):\n(no matching guides found)`);
        }
        if (includeDocs) {
            if (!docQuery) {
                sections.push(`Docs search skipped: could not infer a good query term. Provide \"docQuery\" or ask with a specific keyword (e.g. \"ThemeProvider\").`);
            }
            else if (selectedDocIds.length === 0) {
                sections.push(`Docs search skipped: no relevant doc sources inferred. Use \"search-docs\" directly or provide \"docIds\".`);
            }
            else {
                const docSections = [];
                for (const docId of selectedDocIds) {
                    const entry = docsMap.get(docId);
                    if (!entry)
                        continue;
                    const urls = entry.urls.slice(0, Math.min(maxUrlsPerDoc, entry.urls.length));
                    const matchesByUrl = [];
                    const settled = await Promise.allSettled(urls.map(async (url) => {
                        const page = await fetchPageText(url, fetchTimeoutMs);
                        return { url, page };
                    }));
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
                        if (matches.length === 0)
                            continue;
                        const bullets = matches.map((m, i) => `${i + 1}. ${m}`).join("\n\n");
                        matchesByUrl.push(`URL: ${url}\n\n${bullets}`);
                    }
                    if (matchesByUrl.length === 0) {
                        docSections.push(`- ${entry.title} (${entry.id}): no matches for \"${docQuery}\" in:\n  - ${urls.join("\n  - ")}`);
                    }
                    else {
                        docSections.push(`- ${entry.title} (${entry.id}) matches for \"${docQuery}\":\n\n${matchesByUrl.join("\n\n---\n\n")}`);
                    }
                }
                sections.push(`Docs search (${docQuery}):\n${docSections.join("\n\n")}`);
            }
        }
        sections.push("Tip: If results are too broad or empty, rerun with a tighter keyword using search-docs, or pass docQuery/docIds explicitly.");
        return {
            content: [
                {
                    type: "text",
                    text: sections.join("\n\n---\n\n")
                }
            ]
        };
    });
    server.registerTool("convert-styling", {
        title: "Convert Styling (Uniwind)",
        description: "Scan a project for styling usage and (optionally) apply best-effort Uniwind migration steps using the local styling guide as reference.",
        inputSchema: ConvertStylingInputSchema
    }, async (input) => {
        const stylingGuideFile = guideMap.get("styling")?.fileName ?? "styling.md";
        const stylingGuidePath = path.join(guidesDir, stylingGuideFile);
        const guideText = await readFile(stylingGuidePath, "utf8");
        return runConvertStylingTool({
            input,
            projectRootFallback: process.env.MCP_PROJECT_ROOT ?? process.cwd(),
            guideText
        });
    });
}
