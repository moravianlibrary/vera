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
import type { Role } from "../../domain/src/access.ts";
import type {
  PermissionEntry,
  Requirement,
  StaticPermission,
} from "../../domain/src/permissions.ts";
import {
  catalogEntryOf,
  permissionCatalog,
  permissionGroups,
  permissionKeys,
  permissionRequires,
  propertyEditRequires,
} from "../../domain/src/permissions.ts";
import { editPermissionOf } from "../../domain/src/properties.ts";
import {
  navigationEntries,
  visibleNavigation,
} from "../../frontend/src/components/layout/navigation.ts";
import type { ColumnDefinition } from "../../frontend/src/components/lists/record-list.tsx";
import { accessView } from "../../frontend/src/features/access/access-view.ts";
import { permissionLineOf } from "../../frontend/src/features/access/access-words.ts";
import { categoriesView } from "../../frontend/src/features/categories/categories-view.ts";
import {
  publicDocumentColumns,
  staffDocumentColumns,
} from "../../frontend/src/features/documents/document-list.tsx";
import {
  documentsView,
  myDocumentsView,
} from "../../frontend/src/features/documents/documents-view.ts";
import { hookColumns } from "../../frontend/src/features/hooks/hooks-page.tsx";
import { hooksView } from "../../frontend/src/features/hooks/hooks-view.ts";
import { intentionsView } from "../../frontend/src/features/intentions/intentions-board-view.ts";
import { listEditorColumns } from "../../frontend/src/features/lists/list-editor.tsx";
import { listColumns } from "../../frontend/src/features/lists/list-rows.tsx";
import { listsView } from "../../frontend/src/features/lists/lists-view.ts";
import { instanceColumns } from "../../frontend/src/features/plugins/plugin-table.tsx";
import { pluginsView } from "../../frontend/src/features/plugins/plugins-view.ts";
import {
  endedProjectColumns,
  rejectedProjectColumns,
} from "../../frontend/src/features/projects/projects-page.tsx";
import { projectsView } from "../../frontend/src/features/projects/projects-view.ts";
import { propertyColumns } from "../../frontend/src/features/properties/properties-page.tsx";
import { requestColumns } from "../../frontend/src/features/requests/request-list.tsx";
import { requestsView } from "../../frontend/src/features/requests/requests-view.ts";
import { runColumns } from "../../frontend/src/features/tasks/run-parts.tsx";
import { scheduleColumns } from "../../frontend/src/features/tasks/schedules-page.tsx";
import { tasksView } from "../../frontend/src/features/tasks/tasks-view.ts";
import { validationColumns } from "../../frontend/src/features/validations/validation-list.tsx";
import { validationsView } from "../../frontend/src/features/validations/validations-view.ts";
import type { PerTier } from "../../frontend/src/hooks/use-tier.ts";
import { tiers, valueForTier } from "../../frontend/src/hooks/use-tier.ts";
import type { FilterFieldDefinition } from "../../frontend/src/lib/view-definition.ts";
import { roles } from "../../frontend/src/mocks/fixtures/access.ts";

const root = resolve(import.meta.dir, "../..");
const docs = join(root, "docs");
const isCheck = process.argv.includes("--check");

// ---------------------------------------------------------------- generated blocks

// Each property's own permission, one row for them all (PERM-property-edit).
const propertyEditKey = "property.<key>.edit";
const propertyEditEntry = catalogEntryOf(editPermissionOf("key"));

const acceptedText = ({ scopes }: PermissionEntry) =>
  scopes.map((scope) => (scope === "own" ? "own" : `\`${scope}\``)).join(" · ");

function permissionCatalogTable(): string {
  return permissionGroups
    .map((group) => {
      const rows = [
        ...permissionKeys
          .filter((permission) => permissionCatalog[permission].group === group)
          .map(
            (permission) =>
              `| \`${permission}\` | ${acceptedText(permissionCatalog[permission])} | ${permissionLineOf(permission)} |`,
          ),
        ...(propertyEditEntry.group === group
          ? [
              `| \`${propertyEditKey}\` | ${acceptedText(propertyEditEntry)} | ${permissionLineOf(editPermissionOf("key"))}, one per property |`,
            ]
          : []),
      ];
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
    at === "any"
      ? `\`${permission}@any\``
      : at === "held"
        ? `\`${permission}\` (any scope)`
        : `\`${permission}\``;
  const rows = new Map<string, string[]>();
  const add = (permission: string, needs: readonly Requirement[]) => {
    const text = needs.map(needText).join(", ");
    rows.set(text, [...(rows.get(text) ?? []), permission]);
  };
  for (const permission of permissionKeys) {
    const needs = permissionRequires[permission];
    if (needs !== undefined) {
      add(permission, needs);
    }
  }
  add(propertyEditKey, propertyEditRequires);
  return [
    "| Permission | Needs |",
    "|---|---|",
    ...[...rows].map(
      ([needs, permissions]) =>
        `| ${permissions.map((permission) => `\`${permission}\``).join(", ")} | ${needs} |`,
    ),
  ].join("\n");
}

function scopeCell(role: Role, permission: StaticPermission): string {
  const grant = role.grants.find((candidate) => candidate.permission === permission);
  if (grant === undefined) {
    return "";
  }

  return grant.scope === null ? "own" : grant.scope;
}

function roleGrantsTable(): string {
  const header = `| Permission | ${roles.map((role) => `\`${role.name}\``).join(" | ")} |`;
  const rule = `|---|${roles.map(() => "---").join("|")}|`;
  // A shipped role holds no property's permission: properties are defined after it ships.
  const rows = permissionGroups.flatMap((group) => [
    `| **${group}** |${roles.map(() => " ").join("|")}|`,
    ...(propertyEditEntry.group === group
      ? [`| \`${propertyEditKey}\` | ${roles.map(() => "").join(" | ")} |`]
      : []),
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
  ["Requests", requestsView],
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
      const fields = [
        ...(definition.fields as readonly FilterFieldDefinition<unknown>[]).map(fieldText),
        ...("filtersProperties" in definition && definition.filtersProperties === true
          ? ["each property (by its type)"]
          : []),
      ];
      const groupings = definition.groupings.map((option) => option.label);
      return `| ${page} | ${definition.view === undefined ? "no" : `\`${definition.view}\``} | ${fields.join(" · ") || "—"} | ${groupings.join(" · ") || "—"} |`;
    }),
  ].join("\n");
}

// Each page's list columns, as its code declares them: one set for a list that turns each row into
// a card when it is narrow, or a set per tier.
type ColumnSet = readonly Pick<ColumnDefinition<never>, "header">[];
const nobody = () => "";
const pageColumns: readonly (readonly [string, ColumnSet | PerTier<ColumnSet>])[] = [
  ["Documents", staffDocumentColumns([])],
  ["My Documents", publicDocumentColumns("")],
  ["Requests", requestColumns({ users: [], projects: [], custodies: [] })],
  ["Documents Validations", validationColumns(nobody)],
  ["Digitization Lists", listColumns],
  ["List editor, pool and members", listEditorColumns(nobody)],
  ["Projects, ended", endedProjectColumns],
  ["Projects, rejected", rejectedProjectColumns(nobody)],
  ["Tasks, finished runs", runColumns({ asOf: "", nameOf: nobody, onOpen: () => {} })],
  ["Schedules", scheduleColumns({ asOf: "", acts: {} })],
  [
    "Plugins, instances",
    instanceColumns({
      asOf: "",
      implementationOf: () => undefined,
      categoryOf: nobody,
      custodyOf: () => undefined,
    }),
  ],
  ["Properties", propertyColumns],
  ["Hooks", hookColumns(undefined)],
];

const headersText = (columns: ColumnSet) =>
  columns
    .map(({ header }) => header)
    .filter((header): header is string => typeof header === "string" && header !== "")
    .join(" · ");

function columnsText(columns: ColumnSet | PerTier<ColumnSet>): string {
  if (Array.isArray(columns)) {
    return `${headersText(columns as ColumnSet)}; a card per row when the list is narrow`;
  }

  // Tiers that show the same columns share a line, widest first.
  const lines: { tiers: string[]; text: string }[] = [];
  for (const tier of tiers.toReversed()) {
    const text = headersText(valueForTier(columns as PerTier<ColumnSet>, tier));
    const last = lines.at(-1);
    if (last?.text === text) {
      last.tiers.push(tier);
    } else {
      lines.push({ tiers: [tier], text });
    }
  }

  return lines.map((line) => `${line.tiers.join(", ")}: ${line.text}`).join("<br>");
}

function pageColumnsTable(): string {
  return [
    "| List | Columns |",
    "|---|---|",
    ...pageColumns.map(([page, columns]) => `| ${page} | ${columnsText(columns)} |`),
  ].join("\n");
}

const generators: Record<string, () => string> = {
  "page-columns": pageColumnsTable,
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
// The code: the frontend and the packages it shares with the engine.
const codeFiles = ["frontend/src", "contract/src", "domain/src", "engine/src"].flatMap((dir) =>
  sourceFiles(join(root, dir)),
);
const citing = [...codeFiles, ...newDocs.filter((file) => !examples.includes(file))];
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
  return new Set(
    [...text.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) => anchorOf(heading ?? "")),
  );
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
      failures.push(
        `${relative(root, file)}: links to ${target}#${fragment}, which has no such heading`,
      );
    }
  }
}

// ---------------------------------------------------------------- old citations

const oldSources =
  /docs\/demos|docs\/design|STATUS|\b(?:component-interfaces|component-inventory|continuation|intentions|flows|plugins|permissions|filtering|view-map|status-model|projects|view-rules|navigation|messaging|concepts|proposal-custody|identity|page-composition|view-catalog|status-log|document-properties|relationships|document-identity|registry-status|priority-levels|identifier-types|watchlists-and-notifications|users-management-redesign)\.md\b|page-[a-z]+\.js|vera-[a-z]+\.(?:js|css)/g;
let oldCitations = 0;
let oldFiles = 0;
for (const file of codeFiles) {
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
