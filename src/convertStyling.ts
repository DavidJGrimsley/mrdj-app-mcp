import { z } from "zod";
import path from "node:path";
import { createHash } from "node:crypto";
import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";

export const ConvertStylingInputSchema = z.object({
  projectRoot: z
    .string()
    .min(1)
    .optional()
    .describe("Absolute path to the project root to scan/convert. Defaults to MCP project root / cwd."),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(400).describe("File path label (workspace-relative preferred)."),
        content: z.string().describe("Full file contents.")
      })
    )
    .optional()
    .describe(
      "Optional in-memory file set to scan/convert. Use this when the MCP server cannot access your project folder on disk. If provided, projectRoot is ignored and apply returns edits instead of writing files."
    ),
  basePath: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional base path label used for reporting when 'files' are provided (e.g. repo name). This does not need to exist on disk."
    ),
  apply: z.boolean().optional().describe("When true, writes changes to disk. Default false (dry-run)."),
  maxFiles: z
    .number()
    .int()
    .min(1)
    .max(20000)
    .optional()
    .describe("Safety limit for max files scanned (default 5000)."),
  includeExtensions: z
    .array(z.string().min(1))
    .optional()
    .describe("File extensions to scan (default: js/ts/tsx/jsx/css/json + common config names)."),
  excludeDirNames: z
    .array(z.string().min(1))
    .optional()
    .describe("Directory names to skip (default includes node_modules, build, dist, .git, etc)."),
  mode: z
    .enum(["uniwind-migration"])
    .optional()
    .describe("Conversion mode. Currently only 'uniwind-migration'.")
});

export type ConvertStylingInput = z.infer<typeof ConvertStylingInputSchema>;

type Finding = {
  file: string;
  kind:
    | "nativewind-import"
    | "nativewind-babel"
    | "nativewind-metro"
    | "nativewind-dts"
    | "uniwind-types"
    | "stylesheet"
    | "tailwind-config"
    | "global-css";
  message: string;
};

type Change = {
  file: string;
  action: "update" | "delete";
  reason: string;
  beforeSha1?: string;
  afterSha1?: string;
  newContent?: string;
};

function sha1(text: string): string {
  return createHash("sha1").update(text, "utf8").digest("hex");
}

function isSubPath(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root: string, options: { excludeDirNames: Set<string>; maxFiles: number }): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (out.length >= options.maxFiles) return;

    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (out.length >= options.maxFiles) return;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (options.excludeDirNames.has(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }

  await walk(root);
  return out;
}

function removeArrayStringLiteral(source: string, literal: string): { updated: string; removed: boolean } {
  // Best-effort remove of e.g. "nativewind/babel" from an array literal.
  // This is intentionally conservative; if it doesn't match cleanly, it leaves the file unchanged.
  const patterns = [
    new RegExp(`\\n(\\s*)['\"]${literal}['\"],?\\s*`, "g"),
    new RegExp(`(\\[\\s*)(['\"]${literal}['\"]\\s*,\\s*)`, "g"),
    new RegExp(`(,\\s*)(['\"]${literal}['\"]\\s*)(\\])`, "g")
  ];

  let updated = source;
  let removed = false;

  for (const pattern of patterns) {
    const next = updated.replace(pattern, (match, g1, g2, g3) => {
      removed = true;
      if (g3) return g3; // handles , "x" ]
      if (g1 && g2) return g1; // handles [ "x", ...
      return g1 ?? "";
    });
    updated = next;
  }

  return { updated, removed };
}

function upsertUniwindCssImports(source: string): { updated: string; changed: boolean } {
  let updated = source;
  let changed = false;

  const hasTailwindImport = /@import\s+['\"]tailwindcss['\"];?/m.test(updated);
  const hasUniwindImport = /@import\s+['\"]uniwind['\"];?/m.test(updated);

  // Remove Tailwind v3 directives if present.
  const hadTailwindDirectives = /@tailwind\s+(base|components|utilities)\s*;?/m.test(updated);
  if (hadTailwindDirectives) {
    updated = updated
      .replace(/^\s*@tailwind\s+base\s*;?\s*$/gm, "")
      .replace(/^\s*@tailwind\s+components\s*;?\s*$/gm, "")
      .replace(/^\s*@tailwind\s+utilities\s*;?\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n");
    changed = true;
  }

  // Remove any @import 'nativewind' / @import "nativewind" if found.
  const beforeNativewind = updated;
  updated = updated.replace(/^\s*@import\s+['\"]nativewind['\"];?\s*$/gm, "");
  if (updated !== beforeNativewind) changed = true;

  if (!hasTailwindImport || !hasUniwindImport) {
    const headerLines: string[] = [];
    headerLines.push("@import 'tailwindcss';");
    headerLines.push("@import 'uniwind';");

    // If neither exists, prepend. If one exists, normalize to both at top.
    // Strategy: remove existing tailwind/uniwind imports then add header.
    updated = updated
      .replace(/^\s*@import\s+['\"]tailwindcss['\"];?\s*$/gm, "")
      .replace(/^\s*@import\s+['\"]uniwind['\"];?\s*$/gm, "")
      .trimStart();

    updated = `${headerLines.join("\n")}\n\n${updated}`;
    changed = true;
  }

  return { updated, changed };
}

function convertMetroConfig(source: string): { updated: string; changed: boolean; notes: string[] } {
  // Best-effort migration: nativewind/metro -> uniwind/metro, withNativewind -> withUniwindConfig
  const notes: string[] = [];
  let updated = source;
  let changed = false;

  const hadNativewindMetro = /nativewind\/(metro|metro-config)/.test(updated);
  if (hadNativewindMetro) {
    updated = updated.replace(/nativewind\/(metro|metro-config)/g, "uniwind/metro");
    changed = true;
    notes.push("Replaced nativewind metro import with uniwind/metro.");
  }

  if (/withNativewind/.test(updated)) {
    updated = updated.replace(/withNativewind/g, "withUniwindConfig");
    changed = true;
    notes.push("Renamed withNativewind -> withUniwindConfig.");
  }

  // Normalize common option keys if present.
  // Examples seen in the wild: { input: './global.css' } or { cssInput: ... }
  const beforeKeys = updated;
  updated = updated
    .replace(/\bcssInput\b/g, "cssEntryFile")
    .replace(/\binput\b\s*:/g, "cssEntryFile:");
  if (updated !== beforeKeys) {
    changed = true;
    notes.push("Normalized metro options to use cssEntryFile.");
  }

  // Ensure the helper is named correctly if the require line exists.
  // If file already has withUniwindConfig import, we leave it.
  const hasUniwindRequire = /withUniwindConfig\s*\}\s*=\s*require\(['\"]uniwind\/metro['\"]\)/.test(updated);
  if (!hasUniwindRequire && /require\(['\"]uniwind\/metro['\"]\)/.test(updated)) {
    // Try to rewrite destructuring name.
    const before = updated;
    updated = updated.replace(
      /const\s*\{\s*([a-zA-Z0-9_$]+)\s*\}\s*=\s*require\(['\"]uniwind\/metro['\"]\);?/,
      "const { withUniwindConfig } = require('uniwind/metro');"
    );
    if (updated !== before) {
      changed = true;
      notes.push("Normalized metro require to { withUniwindConfig }.");
    }
  }

  return { updated, changed, notes };
}

function scanCodeFindings(text: string): Finding[] {
  const findings: Finding[] = [];

  if (/from\s+['\"]nativewind['\"]/m.test(text) || /require\(['\"]nativewind['\"]\)/m.test(text)) {
    findings.push({
      kind: "nativewind-import",
      file: "",
      message: "Found nativewind import/require. Likely needs Uniwind migration or manual review (cssInterop/styled/ThemeProvider)."
    });
  }

  if (/StyleSheet\.create\s*\(/m.test(text)) {
    findings.push({
      kind: "stylesheet",
      file: "",
      message: "Found StyleSheet.create(). Guide prefers className utilities; this usually needs manual conversion."
    });
  }

  return findings;
}

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

function looksLikeWindowsAbsPath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p);
}

function shouldSkipVirtualPath(rel: string, excludeDirNames: Set<string>): boolean {
  const parts = rel.split("/").filter(Boolean);
  return parts.some((part) => excludeDirNames.has(part));
}

export async function runConvertStylingTool(params: {
  input: unknown;
  projectRootFallback: string;
  guideText: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const parsed = ConvertStylingInputSchema.safeParse(params.input);
  if (!parsed.success) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid input: ${parsed.error.message}`
        }
      ]
    };
  }

  const {
    apply = false,
    maxFiles = 5000,
    includeExtensions,
    excludeDirNames,
    mode,
    files: inputFiles,
    basePath
  } = parsed.data;

  const excludeDirs = new Set(
    excludeDirNames ?? [
      "node_modules",
      ".git",
      "build",
      "dist",
      ".next",
      ".expo",
      ".turbo",
      ".cache",
      "coverage",
      "ios",
      "android"
    ]
  );

  const scanExts = new Set(
    (includeExtensions ?? [".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".cjs", ".mjs"]).map((e) =>
      e.startsWith(".") ? e : `.${e}`
    )
  );

  const guideSha = sha1(params.guideText);

  // In-memory mode: operate on provided files (e.g. files attached in chat)
  if (Array.isArray(inputFiles) && inputFiles.length > 0) {
    const findings: Finding[] = [];
    const changes: Change[] = [];
    let sawUniwindTypes = false;
    let sawGlobalCss = false;

    const effectiveBase = (basePath ?? "(chat)").trim();

    const limited = inputFiles.slice(0, maxFiles);
    for (const f of limited) {
      const rel = normalizeRelPath(f.path);
      if (!rel) continue;
      if (shouldSkipVirtualPath(rel, excludeDirs)) continue;

      const base = path.posix.basename(rel);
      const ext = path.posix.extname(rel);

      const isConfigCandidate =
        base === "babel.config.js" ||
        base === "babel.config.cjs" ||
        base === "metro.config.js" ||
        base === "metro.config.cjs" ||
        base === "tailwind.config.js" ||
        base === "tailwind.config.cjs" ||
        base === "nativewind.d.ts" ||
        base === "uniwind-types.d.ts" ||
        base === "global.css";

      const shouldRead = isConfigCandidate || scanExts.has(ext);
      if (!shouldRead) continue;

      const raw = f.content ?? "";

      if (base === "nativewind.d.ts") {
        findings.push({
          file: rel,
          kind: "nativewind-dts",
          message: "nativewind.d.ts present. Uniwind migration checklist suggests deleting it."
        });
        if (apply) {
          changes.push({ file: rel, action: "delete", reason: "Delete nativewind.d.ts (Uniwind migration step)." });
        }
        continue;
      }

      if (base === "uniwind-types.d.ts") {
        sawUniwindTypes = true;
        continue;
      }

      // tailwind.config.*: report only
      if (base.startsWith("tailwind.config.")) {
        if (/nativewind|ThemeProvider|cssInterop/i.test(raw)) {
          findings.push({
            file: rel,
            kind: "tailwind-config",
            message:
              "tailwind.config.* references nativewind-related config. Uniwind prefers tokens/themes in CSS; likely needs manual migration."
          });
        } else {
          findings.push({
            file: rel,
            kind: "tailwind-config",
            message:
              "tailwind.config.* found. If it only existed for NativeWind theming, consider moving tokens to CSS and removing it."
          });
        }
        continue;
      }

      // babel.config: remove nativewind/babel (return edit)
      if (base.startsWith("babel.config.")) {
        if (/nativewind\/babel/.test(raw)) {
          const before = raw;
          const { updated, removed } = removeArrayStringLiteral(before, "nativewind/babel");
          if (removed && updated !== before) {
            findings.push({
              file: rel,
              kind: "nativewind-babel",
              message: apply
                ? "Removed nativewind/babel from babel config (returned as edit)."
                : "Found nativewind/babel in babel config (set apply=true to return an edit)."
            });
            if (apply) {
              changes.push({
                file: rel,
                action: "update",
                reason: "Remove nativewind/babel preset.",
                beforeSha1: sha1(before),
                afterSha1: sha1(updated),
                newContent: updated
              });
            }
          } else {
            findings.push({
              file: rel,
              kind: "nativewind-babel",
              message: "Found nativewind/babel in babel config but could not safely auto-edit; manual removal recommended."
            });
          }
        }
        continue;
      }

      // metro.config: best-effort (return edit)
      if (base.startsWith("metro.config.")) {
        if (/nativewind\/(metro|metro-config)|withNativewind/.test(raw)) {
          const before = raw;
          const { updated, changed, notes } = convertMetroConfig(before);
          findings.push({
            file: rel,
            kind: "nativewind-metro",
            message: `Metro config references NativeWind. ${notes.join(" ") || "May need manual migration to withUniwindConfig."}`
          });
          if (apply && changed && updated !== before) {
            changes.push({
              file: rel,
              action: "update",
              reason: "Best-effort migrate metro config toward Uniwind.",
              beforeSha1: sha1(before),
              afterSha1: sha1(updated),
              newContent: updated
            });
          }
        }
        continue;
      }

      // global.css: normalize imports (return edit)
      if (base === "global.css" || /\bglobal\.css$/.test(rel)) {
        sawGlobalCss = true;
        const before = raw;
        const { updated, changed } = upsertUniwindCssImports(before);
        if (changed && updated !== before) {
          findings.push({
            file: rel,
            kind: "global-css",
            message: apply
              ? "Normalized global.css imports for Tailwind 4 + Uniwind (returned as edit)."
              : "global.css imports should be Tailwind 4 + Uniwind (set apply=true to return an edit)."
          });
          if (apply) {
            changes.push({
              file: rel,
              action: "update",
              reason: "Update global.css header to Tailwind 4 + Uniwind.",
              beforeSha1: sha1(before),
              afterSha1: sha1(updated),
              newContent: updated
            });
          }
        }
        continue;
      }

      // code scan
      if (scanExts.has(ext)) {
        const codeFindings = scanCodeFindings(raw).map((finding) => ({ ...finding, file: rel }));
        findings.push(...codeFindings);
      }
    }

    if (sawGlobalCss && !sawUniwindTypes) {
      findings.push({
        file: "uniwind-types.d.ts",
        kind: "uniwind-types",
        message: "global.css found but uniwind-types.d.ts is missing. Add it to enable className typing for Uniwind."
      });
    }

    const findingsByKind = findings.reduce<Record<string, number>>((acc, fnd) => {
      acc[fnd.kind] = (acc[fnd.kind] ?? 0) + 1;
      return acc;
    }, {});

    const summary = {
      mode: mode ?? "uniwind-migration",
      projectRoot: `${effectiveBase} (in-memory)`.replace(/\s+/g, " ").trim(),
      apply,
      filesEnumerated: limited.length,
      guideSha1: guideSha,
      findings: findings.length,
      changes: changes.length,
      findingsByKind
    };

    const lines: string[] = [];
    lines.push("convert-styling results");
    lines.push(JSON.stringify(summary, null, 2));

    if (findings.length) {
      lines.push("\nFindings (first 100):");
      for (const fnd of findings.slice(0, 100)) {
        lines.push(`- ${fnd.kind}: ${fnd.file} — ${fnd.message}`);
      }
      if (findings.length > 100) lines.push(`...and ${findings.length - 100} more`);
    } else {
      lines.push("\nNo findings.");
    }

    if (apply && changes.length) {
      const editBundle = {
        note: "In-memory mode: no filesystem writes. Apply these edits in your repo.",
        edits: changes
          .filter((c) => c.action === "update" && typeof c.newContent === "string")
          .map((c) => ({ path: c.file, content: c.newContent })),
        deletes: changes.filter((c) => c.action === "delete").map((c) => ({ path: c.file }))
      };

      lines.push("\nReturned edits:");
      lines.push(JSON.stringify(editBundle, null, 2));
    } else {
      lines.push(apply ? "\nNo changes were returned." : "\nDry-run: no files were modified.");
    }

    lines.push("\nNotes:");
    lines.push("- This tool is best-effort + conservative; it auto-edits only mechanical changes (babel/metro/global.css/nativewind.d.ts).");
    lines.push("- StyleSheet.create() and nativewind runtime APIs (ThemeProvider/cssInterop/styled) are reported for manual conversion.");
    lines.push("- In-memory mode is ideal for a handful of files added to chat; it is not practical for whole-repo migrations.");

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }

  const requestedRoot = parsed.data.projectRoot ?? params.projectRootFallback;

  // Common foot-gun: using a remote Linux HTTP MCP server but passing a local Windows path.
  if (typeof requestedRoot === "string" && process.platform !== "win32" && looksLikeWindowsAbsPath(requestedRoot)) {
    return {
      content: [
        {
          type: "text",
          text:
            `Project root looks like a Windows path (${requestedRoot}), but this MCP server is running on ${process.platform}.\n` +
            `If you're connected via HTTP to a remote server, it cannot read your local Windows filesystem.\n\n` +
            `Fix options:\n` +
            `1) Run this MCP server locally via stdio (recommended for whole-project scans), or\n` +
            `2) Use in-memory mode by passing { files: [{ path, content }] } for chat-attached files.`
        }
      ]
    };
  }

  const projectRoot = path.resolve(requestedRoot);

  if (!(await pathExists(projectRoot))) {
    return { content: [{ type: "text", text: `Project root not found: ${projectRoot}` }] };
  }

  const diskFiles = await walkFiles(projectRoot, { excludeDirNames: excludeDirs, maxFiles });

  const findings: Finding[] = [];
  const changes: Change[] = [];
  let sawUniwindTypes = false;
  let sawGlobalCss = false;

  // guideSha computed above

  for (const absPath of diskFiles) {
    const rel = path.relative(projectRoot, absPath);

    // Safety: only operate within projectRoot.
    if (!isSubPath(projectRoot, absPath) && path.resolve(projectRoot) !== path.resolve(absPath)) continue;

    const base = path.basename(absPath);
    const ext = path.extname(absPath);

    const isConfigCandidate =
      base === "babel.config.js" ||
      base === "babel.config.cjs" ||
      base === "metro.config.js" ||
      base === "metro.config.cjs" ||
      base === "tailwind.config.js" ||
      base === "tailwind.config.cjs" ||
      base === "nativewind.d.ts" ||
      base === "uniwind-types.d.ts" ||
      base === "global.css";

    const shouldRead = isConfigCandidate || scanExts.has(ext);
    if (!shouldRead) continue;

    if (base === "nativewind.d.ts") {
      findings.push({ file: rel, kind: "nativewind-dts", message: "nativewind.d.ts present. Uniwind migration checklist suggests deleting it." });
      if (apply) {
        await unlink(absPath);
        changes.push({ file: rel, action: "delete", reason: "Deleted nativewind.d.ts (Uniwind migration step)." });
      }
      continue;
    }

    if (base === "uniwind-types.d.ts") {
      sawUniwindTypes = true;
      continue;
    }

    let raw: string;
    try {
      raw = await readFile(absPath, "utf8");
    } catch {
      continue;
    }

    // tailwind.config.js: report only
    if (base.startsWith("tailwind.config.")) {
      if (/nativewind|ThemeProvider|cssInterop/i.test(raw)) {
        findings.push({
          file: rel,
          kind: "tailwind-config",
          message: "tailwind.config.* references nativewind-related config. Uniwind prefers tokens/themes in CSS; likely needs manual migration."
        });
      } else {
        findings.push({
          file: rel,
          kind: "tailwind-config",
          message: "tailwind.config.* found. If it only existed for NativeWind theming, consider moving tokens to CSS and removing it."
        });
      }
      continue;
    }

    // babel.config: remove nativewind/babel
    if (base.startsWith("babel.config.")) {
      if (/nativewind\/babel/.test(raw)) {
        const before = raw;
        const { updated, removed } = removeArrayStringLiteral(before, "nativewind/babel");
        if (removed && updated !== before) {
          findings.push({ file: rel, kind: "nativewind-babel", message: "Removed nativewind/babel from babel config (Uniwind migration step)." });
          const beforeSha1 = sha1(before);
          const afterSha1 = sha1(updated);
          if (apply) await writeFile(absPath, updated, "utf8");
          changes.push({ file: rel, action: "update", reason: "Removed nativewind/babel preset.", beforeSha1, afterSha1 });
        } else {
          findings.push({ file: rel, kind: "nativewind-babel", message: "Found nativewind/babel in babel config but could not safely auto-edit; manual removal recommended." });
        }
      }
      continue;
    }

    // metro.config: best-effort
    if (base.startsWith("metro.config.")) {
      if (/nativewind\/(metro|metro-config)|withNativewind/.test(raw)) {
        const before = raw;
        const { updated, changed, notes } = convertMetroConfig(before);
        findings.push({ file: rel, kind: "nativewind-metro", message: `Metro config references NativeWind. ${notes.join(" ") || "May need manual migration to withUniwindConfig."}` });
        if (changed && updated !== before) {
          const beforeSha1 = sha1(before);
          const afterSha1 = sha1(updated);
          if (apply) await writeFile(absPath, updated, "utf8");
          changes.push({ file: rel, action: "update", reason: "Best-effort migrate metro config toward Uniwind.", beforeSha1, afterSha1 });
        }
      }
      continue;
    }

    // global.css
    if (base === "global.css" || /\bglobal\.css$/.test(rel)) {
      sawGlobalCss = true;
      const before = raw;
      const { updated, changed } = upsertUniwindCssImports(before);
      if (changed && updated !== before) {
        findings.push({ file: rel, kind: "global-css", message: "Normalized global.css imports for Tailwind 4 + Uniwind (@import 'tailwindcss'; @import 'uniwind';)." });
        const beforeSha1 = sha1(before);
        const afterSha1 = sha1(updated);
        if (apply) await writeFile(absPath, updated, "utf8");
        changes.push({ file: rel, action: "update", reason: "Update global.css header to Tailwind 4 + Uniwind.", beforeSha1, afterSha1 });
      }
      continue;
    }

    // code scan (ts/tsx/js/jsx)
    if (scanExts.has(ext)) {
      const codeFindings = scanCodeFindings(raw).map((f) => ({ ...f, file: rel }));
      findings.push(...codeFindings);
    }
  }

  if (sawGlobalCss && !sawUniwindTypes) {
    findings.push({
      file: "uniwind-types.d.ts",
      kind: "uniwind-types",
      message: "global.css found but uniwind-types.d.ts is missing. Add it to enable className typing for Uniwind."
    });
  }

  const findingsByKind = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});

  const summary = {
    mode: mode ?? "uniwind-migration",
    projectRoot,
    apply,
    filesEnumerated: diskFiles.length,
    guideSha1: guideSha,
    findings: findings.length,
    changes: changes.length,
    findingsByKind
  };

  // Keep the response mostly text so it's friendly to chat clients.
  const lines: string[] = [];
  lines.push("convert-styling results");
  lines.push(JSON.stringify(summary, null, 2));

  if (findings.length) {
    lines.push("\nFindings (first 100):");
    for (const f of findings.slice(0, 100)) {
      lines.push(`- ${f.kind}: ${f.file} — ${f.message}`);
    }
    if (findings.length > 100) lines.push(`...and ${findings.length - 100} more`);
  } else {
    lines.push("\nNo findings.");
  }

  if (changes.length) {
    lines.push("\nChanges applied/planned (first 100):");
    for (const c of changes.slice(0, 100)) {
      lines.push(`- ${c.action}: ${c.file} — ${c.reason}`);
    }
    if (changes.length > 100) lines.push(`...and ${changes.length - 100} more`);
  } else {
    lines.push(apply ? "\nNo changes were applied." : "\nDry-run: no files were modified.");
  }

  lines.push("\nNotes:");
  lines.push("- This tool is best-effort + conservative; it auto-edits only mechanical changes (babel/metro/global.css/nativewind.d.ts).");
  lines.push("- StyleSheet.create() and nativewind runtime APIs (ThemeProvider/cssInterop/styled) are reported for manual conversion.");

  return { content: [{ type: "text", text: lines.join("\n") }] };
}
