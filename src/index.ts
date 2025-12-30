import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const guidesDir = path.join(__dirname, "..", "guides");

type GuideSpec = {
  id: string;
  title: string;
  fileName: string;
  description: string;
};

const guides: GuideSpec[] = [
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
    
    app.use(express.json());
    
    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.json({ status: "ok", service: "mrdj-app-mcp", version: "0.1.0" });
    });
    
    // MCP SSE endpoint
    app.get("/sse", async (req, res) => {
      console.error("New SSE connection established");
      const transport = new SSEServerTransport("/message", res);
      await server.connect(transport);
    });
    
    // MCP message endpoint
    app.post("/message", async (req, res) => {
      // This will be handled by the SSE transport
      res.status(200).end();
    });
    
    const httpServer = app.listen(port, () => {
      console.error(`mrdj-app-mcp MCP server running on http://localhost:${port}`);
      console.error(`Health check: http://localhost:${port}/health`);
      console.error(`MCP SSE endpoint: http://localhost:${port}/sse`);
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
