import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const guidesDir = path.join(__dirname, "..", "guides");
const guides = [
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
    { id: "index", title: "Index", fileName: "index.md", description: "Top-level index linking all copilot guides." },
    { id: "general", title: "General (legacy)", fileName: "general.md", description: "Older combined guidance; superseded by topic-specific guides." }
];
const guideMap = new Map(guides.map((g) => [g.id, g]));
function toFileUri(filePath) {
    const normalized = filePath.replace(/\\/g, "/");
    return `file:///${normalized}`;
}
async function loadGuide(fileName) {
    const filePath = path.join(guidesDir, fileName);
    const text = await readFile(filePath, "utf8");
    return { uri: toFileUri(filePath), text };
}
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
        const { uri, text } = await loadGuide(guide.fileName);
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
    // Check for --http-port flag
    const args = process.argv.slice(2);
    const httpPortIndex = args.indexOf("--http-port");
    const useHttp = httpPortIndex !== -1 && args[httpPortIndex + 1];
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
            }
            else {
                express.json()(req, res, next);
            }
        });
        // Store transports by session ID (for both Streamable HTTP and SSE)
        const transports = {};
        const sseTransports = {};
        // Health check endpoint
        app.get("/health", (_req, res) => {
            res.json({ status: "ok", service: "mrdj-app-mcp", version: "0.1.0" });
        });
        // Store heartbeat intervals for cleanup
        const sseHeartbeats = {};
        // MCP endpoint (Streamable HTTP + SSE fallback). VS Code should point here.
        app.all("/mcp", async (req, res) => {
            const sessionId = req.headers['mcp-session-id'];
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
                // Also handle response close event
                res.on('close', () => {
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
            console.error(`${req.method} /mcp session: ${sessionId || 'new'} Accept: ${acceptHeader}`);
            let transport;
            if (sessionId && transports[sessionId]) {
                transport = transports[sessionId];
                console.error(`Reusing transport for session ${sessionId}`);
            }
            else {
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
            }
            catch (error) {
                console.error('Error handling MCP request:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });
        // SSE Messages endpoint - handle both internal path (nginx proxied) and external path
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
    }
    else {
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
