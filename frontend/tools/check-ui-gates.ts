// Enforces the gates of frontend/ui-gates.md marked (check). Prints each violation as
// `file:line  GATE  match` and exits 1; a file may hold up to the allowlisted number of hits for a
// gate, each with its reason, and must hold exactly that many, so the list only shrinks.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export interface Violation {
  file: string;
  line: number;
  gate: string;
  match: string;
}

interface Gate {
  id: string;
  pattern: RegExp;
  // Which source files the gate reads, by their path from frontend/src.
  appliesTo: (path: string) => boolean;
}

const colorNames =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black";
const colorUtilities =
  "bg|text|border|ring|fill|stroke|from|via|to|outline|divide|decoration|accent|caret|placeholder";
const spacingUtilities =
  "p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|top|right|bottom|left|inset|inset-x|inset-y|leading|tracking|size|w|h";

const anywhere = () => true;
const inFeatures = (path: string) => path.startsWith("features/");
const outsideLayout = (path: string) =>
  path.startsWith("features/") ||
  (path.startsWith("components/") && !path.startsWith("components/layout/"));

export const gates: readonly Gate[] = [
  {
    id: "G-STYLE-1",
    pattern: new RegExp(
      `(?<![\\w-])(${colorUtilities})-(${colorNames})(-\\d{2,3})?(?![\\w-])`,
      "g",
    ),
    appliesTo: anywhere,
  },
  {
    id: "G-STYLE-1",
    pattern: /\b(rgba?|hsla?|oklch)\(|\[#[0-9a-fA-F]{3,8}\]/g,
    appliesTo: anywhere,
  },
  { id: "G-STYLE-1", pattern: /\bdark:(bg|text|border|ring|fill|stroke)-/g, appliesTo: anywhere },
  { id: "G-STYLE-2", pattern: /(?<![\w-])text-\[[0-9.]/g, appliesTo: anywhere },
  {
    id: "G-STYLE-3",
    pattern: /(?<![\w-])rounded-\[|(?<![\w-])rounded(?=["'`\s]|$)/g,
    appliesTo: anywhere,
  },
  {
    id: "G-STYLE-4",
    pattern: new RegExp(`(?<![\\w-])-?(${spacingUtilities})-\\[-?[0-9.]+(rem|px|em)?\\]`, "g"),
    appliesTo: anywhere,
  },
  { id: "G-STYLE-4", pattern: /(?<![\w-])(z|shadow)-\[/g, appliesTo: anywhere },
  { id: "G-STYLE-4", pattern: /(?<=^|["'`\s])!-?[a-z]+-[a-z0-9]/g, appliesTo: anywhere },
  {
    id: "G-COMP-1",
    pattern:
      /from "@\/components\/ui\/(dialog|alert-dialog|sheet|table|tabs|collapsible|badge|card)"/g,
    appliesTo: inFeatures,
  },
  { id: "G-COMP-2", pattern: /<(select|input|textarea|table)\b/g, appliesTo: inFeatures },
  { id: "G-COMP-5", pattern: /\b(localStorage|sessionStorage)\b/g, appliesTo: outsideLayout },
];

// Vendored primitives, the mock API and tests are not the application's UI.
function isScanned(path: string): boolean {
  return (
    /\.tsx?$/.test(path) &&
    !path.startsWith("components/ui/") &&
    !path.startsWith("mocks/") &&
    !/\.test\.tsx?$/.test(path)
  );
}

export function findViolations(path: string, source: string): Violation[] {
  if (!isScanned(path)) {
    return [];
  }

  const violations: Violation[] = [];
  source.split("\n").forEach((text, index) => {
    for (const gate of gates) {
      if (!gate.appliesTo(path)) continue;
      for (const match of text.matchAll(gate.pattern)) {
        violations.push({ file: path, line: index + 1, gate: gate.id, match: match[0].trim() });
      }
    }
  });
  return violations;
}

interface Allowance {
  gate: string;
  file: string;
  count: number;
  reason: string;
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function main(): number {
  const tools = dirname(fileURLToPath(import.meta.url));
  const root = join(tools, "..", "src");
  const allowances: Allowance[] = JSON.parse(
    readFileSync(join(tools, "ui-gates-allow.json"), "utf8"),
  );
  const violations = filesUnder(root).flatMap((path) =>
    findViolations(relative(root, path), readFileSync(path, "utf8")),
  );

  let failed = false;
  const counted = new Map<string, Violation[]>();
  for (const violation of violations) {
    const key = `${violation.gate} ${violation.file}`;
    counted.set(key, [...(counted.get(key) ?? []), violation]);
  }

  for (const [key, found] of counted) {
    const allowance = allowances.find((entry) => `${entry.gate} ${entry.file}` === key);
    if (allowance !== undefined && allowance.count === found.length) continue;
    failed = true;
    for (const violation of found) {
      console.log(`${violation.file}:${violation.line}  ${violation.gate}  ${violation.match}`);
    }
    if (allowance !== undefined) {
      console.log(`  allowlisted ${allowance.count}, found ${found.length}: update the allowlist`);
    }
  }

  for (const allowance of allowances) {
    if (!counted.has(`${allowance.gate} ${allowance.file}`)) {
      failed = true;
      console.log(`${allowance.file}  ${allowance.gate}  allowlisted but clean: remove the entry`);
    }
  }

  console.log(failed ? "UI gates: failed" : "UI gates: pass");
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
