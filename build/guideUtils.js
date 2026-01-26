import path from "node:path";
import { readFile } from "node:fs/promises";
export function toFileUri(filePath) {
    const normalized = filePath.replace(/\\/g, "/");
    return `file:///${normalized}`;
}
export async function loadGuide(guidesDir, fileName) {
    const filePath = path.join(guidesDir, fileName);
    const text = await readFile(filePath, "utf8");
    return { uri: toFileUri(filePath), text };
}
