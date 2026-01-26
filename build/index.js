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
import { loadGuide, toFileUri } from "./guideUtils.js";
import { PORTFOLIO_TOOLS, registerTools } from "./tools.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const guidesDir = path.join(__dirname, "..", "guides");
const PORTFOLIO_SERVER_ID = "mrdj-app-mcp";
const PUBLIC_MCP_BASE_URL = "https://davidjgrimsley.com/public-facing/mcp";
const PUBLIC_MCP_SERVER_BASE_URL = `${PUBLIC_MCP_BASE_URL}/${PORTFOLIO_SERVER_ID}`;
const PUBLIC_MCP_SERVER_PATH = `/public-facing/mcp/${PORTFOLIO_SERVER_ID}`;
const PORTFOLIO_MCP_ENDPOINT_URL = `${PUBLIC_MCP_SERVER_BASE_URL}/mcp`;
const PORTFOLIO_SSE_MESSAGES_URL = `${PUBLIC_MCP_SERVER_BASE_URL}/messages`;
const PORTFOLIO_HEALTH_URL = `${PUBLIC_MCP_SERVER_BASE_URL}/health`;
const PORTFOLIO_PORTFOLIO_URL = `${PUBLIC_MCP_SERVER_BASE_URL}/portfolio.json`;
const PORTFOLIO_GITHUB_REPO_URL = "https://github.com/DavidJGrimsley/mrdj-app-mcp";
const SERVER_STARTED_AT = new Date().toISOString();
const PORTFOLIO_PROMPTS = [
    {
        name: "project-intake",
        title: "Project intake (normalize context)",
        description: "Turn raw project/info.txt + project/style.txt into clean markdown and prepare instructions.",
        args: []
    },
    {
        name: "full-app-build",
        title: "Full app build",
        description: "Plan and execute the full build from project context; ask clarifying questions then auto-start tasks.",
        args: []
    },
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
const PORTFOLIO_ENDPOINTS = [
    {
        id: "mcp-endpoint",
        title: "MCP Endpoint",
        method: "GET",
        url: PORTFOLIO_MCP_ENDPOINT_URL,
        description: "Primary MCP server endpoint (SSE transport).",
        transport: "sse",
        contentType: "text/event-stream"
    },
    {
        id: "sse-messages",
        title: "SSE Messages (POST)",
        method: "POST",
        url: PORTFOLIO_SSE_MESSAGES_URL,
        description: "SSE transport message endpoint (used by legacy SSE MCP clients).",
        transport: "sse",
        contentType: "application/json"
    },
    {
        id: "portfolio-json",
        title: "Portfolio Metadata (portfolio.json)",
        method: "GET",
        url: PORTFOLIO_PORTFOLIO_URL,
        description: "The metadata that powers this page. Pretty meta huh?",
        contentType: "application/json"
    },
    {
        id: "health",
        title: "Health Check",
        method: "GET",
        url: PORTFOLIO_HEALTH_URL,
        description: "Server health status endpoint.",
        contentType: "application/json"
    }
];
let cachedPackageVersion = null;
async function getPackageVersion() {
    if (cachedPackageVersion)
        return cachedPackageVersion;
    const packageJsonPath = path.join(__dirname, "..", "package.json");
    const raw = await readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw);
    const version = typeof parsed.version === "string" ? parsed.version : "0.0.0";
    cachedPackageVersion = version;
    return version;
}
const guides = [
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
const server = new McpServer({
    name: "mrdj-app-mcp",
    version: "0.1.0",
    description: "Local PokePages copilot guides exposed as MCP resources and prompts."
}, {
    capabilities: {
        resources: {},
        prompts: {},
        tools: {}
    }
});
guides.forEach((guide) => {
    server.registerResource(guide.id, toFileUri(path.join(guidesDir, guide.fileName)), {
        title: guide.title,
        description: guide.description,
        mimeType: "text/markdown"
    }, async () => {
        const { uri, text } = await loadGuide(guidesDir, guide.fileName);
        return {
            contents: [
                {
                    uri,
                    text
                }
            ]
        };
    });
});
registerTools({
    server,
    guides,
    guideMap,
    guidesDir
});
server.registerPrompt("project-intake", {
    title: "Project intake (normalize context)",
    description: "Turn raw project/info.txt + project/style.txt into clean markdown and prepare instructions.",
    argsSchema: {}
}, async () => {
    return {
        messages: [
            {
                role: "assistant",
                content: {
                    type: "text",
                    text: "You are preparing project context for a build. Use the project/ folder as the source of truth. Convert raw txt into clean markdown, then generate copilot instructions that merge project context with guides. Keep output concise and actionable."
                }
            },
            {
                role: "user",
                content: {
                    type: "text",
                    text: "Steps:\n1) Run ingest-project-context to convert project/info.txt + project/style.txt into project/info.md + project/style.md and delete the .txt files.\n2) Run generate-project-instructions to rebuild .github/copilot-instructions.md using the new project context.\n3) Summarize what was produced and any missing context."
                }
            }
        ]
    };
});
server.registerPrompt("full-app-build", {
    title: "Full app build",
    description: "Plan and execute the full build from project context; ask clarifying questions then auto-start tasks.",
    argsSchema: {}
}, async () => {
    return {
        messages: [
            {
                role: "assistant",
                content: {
                    type: "text",
                    text: "You are a senior builder. Use project/info.md and project/style.md as primary context, plus the MCP guides. First, summarize the project in 5-8 bullets, infer app type (web/app/both), then produce a detailed plan. Ask all clarifying questions in one list. After the user answers, auto-start tasks and keep a running todo list."
                }
            },
            {
                role: "user",
                content: {
                    type: "text",
                    text: "Use the project context in project/ and the guides. Generate:\n- A readable project brief\n- A scoped execution plan (milestones + tasks)\n- A dependency checklist\n- Clarifying questions (single pass)\nAfter answers, begin implementation and update the todo list as you go."
                }
            }
        ]
    };
});
server.registerPrompt("architecture-help", {
    title: "Architecture and DB helper",
    description: "Answer architecture or database design questions using the architecture and database guides",
    argsSchema: {
        question: z.string().describe("Your question about architecture or database design")
    }
}, async ({ question }) => {
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
});
server.registerPrompt("state-store-template", {
    title: "Zustand store helper",
    description: "Generate a Zustand store plan using the state management guide",
    argsSchema: {
        storeName: z.string().describe("Name of the store or feature area"),
        concern: z.string().describe("What the store manages (auth, list data, filters, ui flags, etc.)"),
        persistence: z.enum(["none", "device", "secure", "session"]).optional().describe("Persistence level: none/device/secure/session")
    }
}, async ({ storeName, concern, persistence }) => {
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
});
server.registerPrompt("routing-checklist", {
    title: "Routing checklist",
    description: "Provide an Expo Router checklist for a screen or flow",
    argsSchema: {
        route: z.string().describe("Route segment or screen name")
    }
}, async ({ route }) => {
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
});
async function main() {
    const args = process.argv.slice(2);
    const httpPortIndex = args.indexOf("--http-port");
    const useHttp = httpPortIndex !== -1 && args[httpPortIndex + 1];
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
        const app = express();
        app.use(cors({
            origin: "*",
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"]
        }));
        const sseMessagesPathExternal = `${PUBLIC_MCP_SERVER_PATH}/messages`;
        const sseMessagesPathInternal = "/mcp/messages";
        app.use((req, res, next) => {
            if (req.path === sseMessagesPathExternal || req.path === sseMessagesPathInternal) {
                next();
            }
            else {
                express.json()(req, res, next);
            }
        });
        const transports = {};
        const sseTransports = {};
        app.get("/health", (_req, res) => {
            res.set("Cache-Control", "no-store");
            res.json({ status: "ok", service: "mrdj-app-mcp", version: "0.1.0" });
        });
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
                    resources: guides.map((guide) => ({
                        id: guide.id,
                        title: guide.title,
                        fileName: guide.fileName,
                        description: guide.description
                    })),
                    tools: PORTFOLIO_TOOLS,
                    prompts: PORTFOLIO_PROMPTS,
                    endpoints: PORTFOLIO_ENDPOINTS,
                    updatedAt: SERVER_STARTED_AT
                };
                const payloadStr = JSON.stringify(payload);
                const hash = createHash("sha1").update(payloadStr, "utf8").digest("hex");
                const etag = `"${hash.slice(0, 16)}"`;
                res.set("Cache-Control", "public, max-age=300");
                res.set("ETag", etag);
                const clientEtag = req.headers["if-none-match"];
                if (clientEtag === etag) {
                    return res.status(304).end();
                }
                res.json(payload);
            }
            catch (error) {
                console.error("Error building /portfolio.json response:", error);
                res.status(500).json({ error: "portfolio_meta_failed" });
            }
        });
        const sseHeartbeats = {};
        app.all("/mcp", async (req, res) => {
            const sessionId = req.headers["mcp-session-id"];
            const acceptHeader = req.headers.accept || "";
            const isSseRequest = req.method === "GET" && acceptHeader.includes("text/event-stream") && !sessionId;
            if (isSseRequest) {
                console.error("Handling legacy SSE MCP request");
                const transport = new SSEServerTransport(sseMessagesPathExternal, res);
                const actualSessionId = transport.sessionId;
                sseTransports[actualSessionId] = transport;
                console.error(`SSE session created with transport sessionId: ${actualSessionId}`);
                const heartbeatInterval = setInterval(() => {
                    try {
                        if (!res.writableEnded) {
                            res.write(`:heartbeat\n\n`);
                        }
                        else {
                            clearInterval(heartbeatInterval);
                            delete sseHeartbeats[actualSessionId];
                        }
                    }
                    catch (error) {
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
                res.on("close", () => {
                    if (sseHeartbeats[actualSessionId]) {
                        clearInterval(sseHeartbeats[actualSessionId]);
                        delete sseHeartbeats[actualSessionId];
                    }
                });
                try {
                    await server.connect(transport);
                }
                catch (error) {
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
            console.error(`${req.method} /mcp session: ${sessionId || "new"} Accept: ${acceptHeader}`);
            let transport;
            if (sessionId && transports[sessionId]) {
                transport = transports[sessionId];
                console.error(`Reusing transport for session ${sessionId}`);
            }
            else {
                console.error("Creating new transport");
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (newSessionId) => {
                        console.error(`New MCP session initialized: ${newSessionId}`);
                        transports[newSessionId] = transport;
                    }
                });
                transport.onclose = () => {
                    const sid = Object.keys(transports).find((k) => transports[k] === transport);
                    if (sid) {
                        console.error(`MCP session closed: ${sid}`);
                        delete transports[sid];
                    }
                };
                console.error("Connecting server to transport");
                await server.connect(transport);
                console.error("Server connected to transport");
            }
            try {
                await transport.handleRequest(req, res);
            }
            catch (error) {
                console.error("Error handling MCP request:", error);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Internal server error" });
                }
            }
        });
        const handleSseMessage = async (req, res) => {
            const sessionId = req.query.sessionId;
            console.error(`SSE POST message received, sessionId: ${sessionId}`);
            const transport = sseTransports[sessionId];
            if (transport) {
                try {
                    await transport.handlePostMessage(req, res);
                }
                catch (error) {
                    console.error("Error handling SSE message:", error);
                    if (!res.headersSent) {
                        res.status(500).json({ error: "Internal server error" });
                    }
                }
            }
            else {
                console.error(`No SSE transport found for session: ${sessionId}`);
                res.status(404).json({ error: "Session not found" });
            }
        };
        app.post(sseMessagesPathInternal, handleSseMessage);
        app.post(sseMessagesPathExternal, handleSseMessage);
        const httpServer = app.listen(port, () => {
            console.error(`mrdj-app-mcp MCP server running on http://localhost:${port}`);
            console.error(`Health check: http://localhost:${port}/health`);
            console.error(`MCP endpoint: http://localhost:${port}/mcp`);
        });
        process.on("SIGTERM", () => {
            console.error("SIGTERM received, closing server");
            httpServer.close();
        });
    }
    else {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("mrdj-app-mcp MCP server running on stdio");
        process.stdin.resume();
    }
}
main().catch((error) => {
    console.error("Fatal error in main()", error);
    process.exit(1);
});
