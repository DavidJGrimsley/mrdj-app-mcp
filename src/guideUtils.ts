import path from "node:path";
import { readFile } from "node:fs/promises";

export function toFileUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return `file:///${normalized}`;
}

export async function loadGuide(guidesDir: string, fileName: string): Promise<{ uri: string; text: string }> {
  const filePath = path.join(guidesDir, fileName);
  const text = await readFile(filePath, "utf8");
  return { uri: toFileUri(filePath), text };
}
