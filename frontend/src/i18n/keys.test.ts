// Message keys in source must exist before they reach a screen.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resources } from "@/i18n";

const sourceRoot = join(import.meta.dirname, "..");
const namespaces = Object.keys(resources.en);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (["mocks", "ui", "locales"].includes(entry.name)) continue;
      files.push(...(await sourceFiles(join(directory, entry.name))));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

describe("source message keys", () => {
  it("exist in the English messages", async () => {
    const files = await sourceFiles(sourceRoot);
    const problems: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      const localNamespaces = [...source.matchAll(/useTranslation\(["']([^"']+)["']\)/g)].map(
        (match) => match[1],
      );
      const onlyNamespace =
        localNamespaces.length > 0 && new Set(localNamespaces).size === 1
          ? localNamespaces[0]
          : undefined;
      const keys = resources.en as Record<string, Record<string, unknown>>;
      for (const match of source.matchAll(/(["'])([\w-]+):([\w.-]+)\1/g)) {
        const [, , namespace, key] = match;
        if (
          namespaces.includes(namespace) &&
          keys[namespace][key] === undefined &&
          keys[namespace][`${key}_one`] === undefined &&
          keys[namespace][`${key}_other`] === undefined
        ) {
          problems.push(`${file}: ${namespace}:${key}`);
        }
      }
      if (onlyNamespace) {
        for (const match of source.matchAll(/\bt\(["']([\w.-]+)["']/g)) {
          const key = match[1];
          if (
            keys[onlyNamespace][key] === undefined &&
            keys[onlyNamespace][`${key}_one`] === undefined &&
            keys[onlyNamespace][`${key}_other`] === undefined
          ) {
            problems.push(`${file}: ${onlyNamespace}:${key}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
