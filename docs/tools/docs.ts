// Keeps the reference honest (docs/structure.md §4). `bun docs/tools/docs.ts` rewrites every
// generated block from the frontend's code; `--check` writes nothing and fails when a block is
// stale, when a rule ID is defined twice or cited without being defined, or when a relative link
// in the new docs points nowhere. It also counts the code comments that still cite the old
// design documents, which must reach zero before those are removed.
//
// A generated block sits between `<!-- generated:name -->` and `<!-- /generated:name -->`;
// everything around it is written by hand. A rule is a heading whose whole text is its ID.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Role } from "../../frontend/src/domain/access.ts";
import type {
  Permission,
  PermissionEntry,
  Requirement,
} from "../../frontend/src/domain/permissions.ts";
import {
  permissionCatalog,
  permissionGroups,
  permissionKeys,
  permissionRequires,
} from "../../frontend/src/domain/permissions.ts";
import { permissionLines } from "../../frontend/src/features/access/access-words.ts";
import { navigationEntries, visibleNavigation } from "../../frontend/src/components/layout/navigation.ts";
import { roles } from "../../frontend/src/mocks/fixtures/access.ts";
import { accessView } from "../../frontend/src/features/access/access-view.ts";
import { categoriesView } from "../../frontend/src/features/categories/categories-view.ts";
import { documentsView, myDocumentsView } from "../../frontend/src/features/documents/documents-view.ts";
import { hooksView } from "../../frontend/src/features/hooks/hooks-view.ts";
import { intentionsView } from "../../frontend/src/features/intentions/intentions-board-view.ts";
import { listsView } from "../../frontend/src/features/lists/lists-view.ts";
import { pluginsView } from "../../frontend/src/features/plugins/plugins-view.ts";
import { projectsView } from "../../frontend/src/features/projects/projects-view.ts";
import { proposalsView } from "../../frontend/src/features/proposals/proposals-view.ts";
import { tasksView } from "../../frontend/src/features/tasks/tasks-view.ts";
import { validationsView } from "../../frontend/src/features/validations/validations-view.ts";
import type { FilterFieldDefinition } from "../../frontend/src/lib/view-definition.ts";


const root = resolve(import.meta.dir, "../..");
const docs = join(root, "docs");
const isCheck = process.argv.includes("--check");

// ---------------------------------------------------------------- generated blocks

function permissionCatalogTable(): string {
  return permissionGroups
    .map((group) => {
      const rows = permissionKeys
        .filter((permission) => permissionCatalog[permission].group === group)
        .map((permission) => {
          const { scopes } = permissionCatalog[permission] as PermissionEntry;
          const accepted =
            scopes === null ? "own" : scopes.map((scope) => `\`${scope}\``).join(" · ");
          return `| \`${permission}\` | ${accepted} | ${permissionLines[permission]} |`;
        });
      return [
        `### ${group}`,
        "",
        "| Permission | Scopes | What it lets you do |",
        "|---|---|---|",
        ...rows,
      ].join("\n");
    })
    .join("\n\n");
}

// What each permission needs, permissions with the same needs on one row, in catalog order.
function permissionRequiresTable(): string {
  const needText = ({ permission, at }: Requirement) =>
    at === "any" ? `\`${permission}@any\`` : at === "held" ? `\`${permission}\` (any scope)` : `\`${permission}\``;
  const rows = new Map<string, Permission[]>();
  for (const permission of permissionKeys) {
    const needs = permissionRequires[permission];
    if (needs !== undefined) {
      const text = needs.map(needText).join(", ");
      rows.set(text, [...(rows.get(text) ?? []), permission]);
    }
  }
  return [
    "| Permission | Needs |",
    "|---|---|",
    ...[...rows].map(
      ([needs, permissions]) =>
        `| ${permissions.map((permission) => `\`${permission}\``).join(", ")} | ${needs} |`,
    ),
  ].join("\n");
}

function scopeCell(role: Role, permission: Permission): string {
  const grant = role.grants.find((candidate) => candidate.permission === permission);
  if (grant === undefined) {
    return "";
  }

  return grant.scope === null ? "own" : grant.scope;
}

function roleGrantsTable(): string {
  const header = `| Permission | ${roles.map((role) => `\`${role.name}\``).join(" | ")} |`;
  const rule = `|---|${roles.map(() => "---").join("|")}|`;
  const rows = permissionGroups.flatMap((group) => [
    `| **${group}** |${roles.map(() => " ").join("|")}|`,
    ...permissionKeys
      .filter((permission) => permissionCatalog[permission].group === group)
      .map(
        (permission) =>
          `| \`${permission}\` | ${roles.map((role) => scopeCell(role, permission)).join(" | ")} |`,
      ),
  ]);
  return [header, rule, ...rows].join("\n");
}

const limitText = (limit: number | null) => (limit === null ? "unlimited" : String(limit));

function roleLimitsTable(): string {
  return [
    "| Role | Description | Items per submission | Accepted items per day |",
    "|---|---|---|---|",
    ...roles.map(
      (role) =>
        `| \`${role.name}\` | ${role.description} | ${limitText(role.proposalBatchLimit)} | ${limitText(role.proposalDailyLimit)} |`,
    ),
  ].join("\n");
}

// Each sidebar entry, what reveals it, and the label each shipped role sees, by itself.
function sidebarTable(): string {
  const sessionOf = (role: Role) => ({
    user: { id: "u", name: "", kind: "person" as const, email: null },
    roleIds: [role.id],
    grants: role.grants,
    custodyCategoryIds: [],
    groupIds: [],
  });
  const visible = roles.map((role) => visibleNavigation(sessionOf(role)));
  return [
    `| Entry | Path | Shown with any of | ${roles.map((role) => `\`${role.name}\``).join(" | ")} |`,
    `|---|---|---|${roles.map(() => "---").join("|")}|`,
    ...navigationEntries.map((entry) => {
      const cells = visible.map(
        (entries) => entries.find((shown) => shown.id === entry.id)?.visibleLabel ?? "",
      );
      const requires = entry.requires.map((permission) => `\`${permission}\``).join(" · ");
      return `| ${entry.label} | \`${entry.path}\` | ${requires} | ${cells.join(" | ")} |`;
    }),
  ].join("\n");
}

// Each page's filter bar and groupings, as its view definition declares them.
const pageViews = [
  ["Documents", documentsView],
  ["My Documents", myDocumentsView],
  ["Proposals", proposalsView],
  ["Documents Validations", validationsView],
  ["Digitization Lists", listsView],
  ["Projects", projectsView],
  ["Categories", categoriesView],
  ["Intentions", intentionsView],
  ["Tasks", tasksView],
  ["Users management", accessView],
  ["Plugins", pluginsView],
  ["Hooks", hooksView],
] as const;

function fieldText(field: FilterFieldDefinition<unknown>): string {
  const kind = field.field.kind;
  const where = "isQuick" in field && field.isQuick === true ? " (on the bar)" : "";
  const range = kind === "numberRange" || kind === "dateRange" ? " (range)" : "";
  return `${field.label}${where}${range}`;
}

function pageFiltersTable(): string {
  return [
    "| Page | Watchlists | Filters | Groupings |",
    "|---|---|---|---|",
    ...pageViews.map(([page, definition]) => {
      const fields = (definition.fields as readonly FilterFieldDefinition<unknown>[]).map(fieldText);
      const groupings = definition.groupings.map((option) => option.label);
      return `| ${page} | ${definition.view === undefined ? "no" : `\`${definition.view}\``} | ${fields.join(" · ") || "—"} | ${groupings.join(" · ") || "—"} |`;
    }),
  ].join("\n");
}

const generators: Record<string, () => string> = {
  "page-filters": pageFiltersTable,
  sidebar: sidebarTable,
  "permission-catalog": permissionCatalogTable,
  "permission-requires": permissionRequiresTable,
  "role-grants": roleGrantsTable,
  "role-limits": roleLimitsTable,
};

// ---------------------------------------------------------------- files

function markdownFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === "node_modules" ? [] : markdownFiles(path);
    }

    return name.endsWith(".md") ? [path] : [];
  });
}

// The new documentation; the old design material is left alone until it is removed.
const newDocs = [
  ...["README.md", "AGENTS.md", "structure.md", "ledger.md", "glossary.md"]
    .map((name) => join(docs, name))
    .filter(existsSync),
  ...["reference", "user-journeys", "develop", "decisions", "guide"]
    .map((name) => join(docs, name))
    .filter(existsSync)
    .flatMap(markdownFiles),
];

const failures: string[] = [];

// ---------------------------------------------------------------- generated blocks

const blockPattern = /<!-- generated:([a-z-]+) -->\n[\s\S]*?<!-- \/generated:\1 -->/g;

for (const file of newDocs) {
  const text = readFileSync(file, "utf8");
  const updated = text.replace(blockPattern, (_, name: string) => {
    const generate = generators[name];
    if (generate === undefined) {
      failures.push(`${relative(root, file)}: no generator called ${name}`);
      return _;
    }

    return `<!-- generated:${name} -->\n${generate()}\n<!-- /generated:${name} -->`;
  });
  if (updated !== text) {
    if (isCheck) {
      failures.push(`${relative(root, file)}: a generated block is stale; run make docs`);
    } else {
      writeFileSync(file, updated);
      console.log(`wrote ${relative(root, file)}`);
    }
  }
}

// ---------------------------------------------------------------- rule IDs

const prefixes = [
  "ENT",
  "REL",
  "DOC",
  "STAT",
  "LOG",
  "LC-REQ",
  "LC-ITER",
  "LC-LIST",
  "LC-PROJ",
  "LC-INT",
  "PLAN",
  "PERM",
  "SCOPE",
  "ROLE",
  "ACCESS",
  "VIEW",
  "ACT",
  "PLG",
  "REG",
  "HOOK",
  "MSG",
  "WATCH",
  "UI",
];
const idPattern = `(?:${prefixes.join("|")})-[a-z0-9]+(?:-[a-z0-9]+)*`;
// A heading whose whole text is the ID, or a table row whose first cell is the ID in backticks.
const definition = new RegExp(`^(?:#{2,5} (${idPattern})|\\| \`(${idPattern})\` \\|.*)$`, "gm");
// A decision's ID is the start of its file name: `DEC-0001` for `decisions/DEC-0001-title.md`.
const decisionPattern = "DEC-[0-9]{4}";
const citation = new RegExp(`(?<![\\w-])(${idPattern}|${decisionPattern})(?![\\w-])`, "g");

const defined = new Map<string, string>();
for (const file of markdownFiles(join(docs, "reference"))) {
  for (const [, heading, row] of readFileSync(file, "utf8").matchAll(definition)) {
    const id = heading ?? row ?? "";
    const where = relative(root, file);
    const earlier = defined.get(id);
    if (earlier !== undefined) {
      failures.push(`${where}: ${id} is already defined in ${earlier}`);
    }

    defined.set(id, where);
  }
}

const decisions = join(docs, "decisions");
for (const name of existsSync(decisions) ? readdirSync(decisions) : []) {
  const id = name.match(new RegExp(`^(${decisionPattern})-`))?.[1];
  if (id === undefined) {
    if (name !== "README.md") {
      failures.push(`docs/decisions/${name}: a decision's file name starts with DEC-NNNN-`);
    }
    continue;
  }

  const where = `docs/decisions/${name}`;
  const earlier = defined.get(id);
  if (earlier !== undefined) {
    failures.push(`${where}: ${id} is already defined in ${earlier}`);
  }

  defined.set(id, where);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === "node_modules" ? [] : sourceFiles(path);
    }

    return /\.(tsx?|md)$/.test(name) ? [path] : [];
  });
}

// The structure and the reference's own README name example IDs that are not rules.
const examples = [join(docs, "structure.md"), join(docs, "reference/README.md")];
const citing = [
  ...sourceFiles(join(root, "frontend/src")),
  ...newDocs.filter((file) => !examples.includes(file)),
];
for (const file of citing) {
  for (const [, id] of readFileSync(file, "utf8").matchAll(citation)) {
    if (!defined.has(id)) {
      failures.push(`${relative(root, file)}: cites ${id}, which no reference file defines`);
    }
  }
}

// ---------------------------------------------------------------- relative links

// GitHub's anchor for a heading: lower case, punctuation dropped, spaces as hyphens.
function anchorOf(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");
}

function anchorsIn(file: string): Set<string> {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  return new Set([...text.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) => anchorOf(heading ?? "")));
}

const linkPattern = /\]\(([^)\s#]*)(?:#([^)\s]*))?\)/g;
for (const file of newDocs) {
  for (const [, target = "", fragment] of readFileSync(file, "utf8").matchAll(linkPattern)) {
    if (/^[a-z]+:/.test(target)) {
      continue;
    }

    const linked = target === "" ? file : resolve(dirname(file), target);
    if (!existsSync(linked)) {
      failures.push(`${relative(root, file)}: links to ${target}, which does not exist`);
      continue;
    }

    if (fragment !== undefined && linked.endsWith(".md") && !anchorsIn(linked).has(fragment)) {
      failures.push(`${relative(root, file)}: links to ${target}#${fragment}, which has no such heading`);
    }
  }
}

// ---------------------------------------------------------------- old citations

const oldSources =
  /docs\/demos|docs\/design|STATUS|\b(?:component-interfaces|component-inventory|continuation|intentions|flows|plugins|permissions|filtering|view-map|status-model|projects|view-rules|navigation|messaging|concepts|proposal-custody|identity|page-composition|view-catalog|status-log|document-properties|relationships|document-identity|registry-status|priority-levels|identifier-types|watchlists-and-notifications|users-management-redesign)\.md\b|page-[a-z]+\.js|vera-[a-z]+\.(?:js|css)/g;
let oldCitations = 0;
let oldFiles = 0;
for (const file of sourceFiles(join(root, "frontend/src"))) {
  const count = readFileSync(file, "utf8").match(oldSources)?.length ?? 0;
  oldCitations += count;
  oldFiles += count > 0 ? 1 : 0;
}

console.log(
  `${defined.size} rules defined; ${oldCitations} citations of old documents in ${oldFiles} files`,
);
for (const failure of failures) {
  console.error(failure);
}

if (failures.length > 0) {
  process.exit(1);
}
