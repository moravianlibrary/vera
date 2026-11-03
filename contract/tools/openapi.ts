// Writes the backend's OpenAPI document from the contract's endpoint table (B2).

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { z } from "zod";
import { type EndpointSpec, endpoints } from "../src/endpoints.ts";

type JsonSchema = Record<string, any>;
type OpenApiEndpoint = EndpointSpec & { name?: string };
type ExportedSchema = { id: string; module: string; schema: z.ZodType };

const root = resolve(import.meta.dir, "../..");
const target = resolve(import.meta.dir, "../openapi.json");
const componentPath = "#/components/schemas/";

function schemaFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) return schemaFiles(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });
}

async function exportedSchemas(): Promise<ExportedSchema[]> {
  const modules = ["domain/src", "contract/src"].flatMap((path) =>
    schemaFiles(resolve(root, path)).filter((file) => {
      // Plugin operation types describe in-process calls, not HTTP components.
      return !relative(root, file).startsWith("domain/src/plugin-api/");
    }),
  );
  const byId = new Map<string, ExportedSchema>();
  for (const path of modules.sort()) {
    const exports = await import(path);
    for (const [name, value] of Object.entries(exports)) {
      if (!name.endsWith("Schema") || !(value as any)?._zod?.def) continue;
      const exportName = name.slice(0, -"Schema".length);
      const id = exportName[0]?.toUpperCase() + exportName.slice(1);
      const current = byId.get(id);
      const module = relative(root, path);
      if (current && current.schema !== value) {
        throw new Error(
          `OpenAPI component ${id} is exported by both ${current.module} and ${module}`,
        );
      }
      if (!current) byId.set(id, { id, module, schema: value as z.ZodType });
    }
  }
  return [...byId.values()];
}

const schemas = await exportedSchemas();
const schemaIds = new Map(schemas.map(({ id, schema }) => [schema, id]));

function schemaOf(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  try {
    return z.toJSONSchema(schema, { target: "draft-2020-12", io }) as JsonSchema;
  } catch {
    return z.toJSONSchema(schema, {
      target: "draft-2020-12",
      io,
      unrepresentable: "any",
    }) as JsonSchema;
  }
}

function refinedPaths(schema: z.ZodType, path: (string | number)[] = []): (string | number)[][] {
  const def = schema._def as any;
  const paths: (string | number)[][] = [];
  if (
    def.checks?.some(
      (check: any) => check._zod?.def?.check === "custom" || check.def?.check === "custom",
    )
  ) {
    paths.push(path);
  }
  const descend = (child: z.ZodType, key: string | number) =>
    paths.push(...refinedPaths(child, [...path, key]));
  if (def.type === "object") {
    const shape = typeof def.shape === "function" ? def.shape() : def.shape;
    for (const [key, child] of Object.entries(shape) as [string, z.ZodType][]) descend(child, key);
  } else if (def.type === "array") descend(def.element, "items");
  else if (
    def.type === "optional" ||
    def.type === "nullable" ||
    def.type === "default" ||
    def.type === "readonly" ||
    def.type === "nonoptional"
  )
    descend(def.innerType, "inner");
  else if (def.type === "union") {
    def.options.forEach((child: z.ZodType, index: number) => {
      descend(child, `anyOf.${index}`);
    });
  } else if (def.type === "pipe") descend(def.in, "inner");
  return paths;
}

function markRefinements(json: JsonSchema, schema: z.ZodType): void {
  for (const path of refinedPaths(schema)) {
    let node: any = json;
    for (const part of path) {
      if (typeof part === "number") node = node?.anyOf?.[part];
      else if (part === "items") node = node?.items;
      else if (part === "inner") continue;
      else if (part.startsWith("anyOf.")) node = node?.anyOf?.[Number(part.slice(6))];
      else node = node?.properties?.[part];
    }
    if (node && typeof node === "object") node["x-vera-refined"] = true;
  }
}

function componentId(schema: z.ZodType, io: "input" | "output"): string | undefined {
  const id = schemaIds.get(schema);
  if (id === undefined || io === "output") return id;
  return inputIds.get(schema) ?? id;
}

function registryOf(io: "input" | "output", include?: { id: string; schema: z.ZodType }) {
  const registry = z.registry<{ id: string }>();
  for (const { id, schema } of schemas) {
    const component = io === "input" && inputIds.has(schema) ? `${id}Input` : id;
    registry.add(schema, { id: component });
  }
  if (include) registry.add(include.schema, { id: include.id });
  return registry;
}

const inputIds = new Map<z.ZodType, string>();
for (const { id, schema } of schemas) {
  if (JSON.stringify(schemaOf(schema, "input")) !== JSON.stringify(schemaOf(schema, "output"))) {
    inputIds.set(schema, `${id}Input`);
  }
}

function registeredComponents(io: "input" | "output"): Record<string, JsonSchema> {
  const converted = z.toJSONSchema(registryOf(io), {
    target: "draft-2020-12",
    io,
    uri: (id) => `${componentPath}${id}`,
  }).schemas as Record<string, JsonSchema>;
  const result: Record<string, JsonSchema> = {};
  for (const { id, schema } of schemas) {
    const key = io === "input" && inputIds.has(schema) ? `${id}Input` : id;
    const component = converted[key];
    if (component) {
      markRefinements(component, schema);
      result[key] = component;
    }
  }
  if (converted.__shared) result.__shared = converted.__shared;
  return result;
}

const outputComponents = registeredComponents("output");
const inputComponents = registeredComponents("input");
const inlineSchemas = new WeakMap<z.ZodType, Map<"input" | "output", JsonSchema>>();

function inlineSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const id = componentId(schema, io);
  if (id) return { $ref: `${componentPath}${id}` };
  const cached = inlineSchemas.get(schema)?.get(io);
  if (cached) return cached;
  const inlineId = "VeraInlineRoot";
  const converted = z.toJSONSchema(registryOf(io, { id: inlineId, schema }), {
    target: "draft-2020-12",
    io,
    uri: (component) => `${componentPath}${component}`,
  }).schemas as Record<string, JsonSchema>;
  const result = { ...converted[inlineId] };
  delete result.$id;
  markRefinements(result, schema);
  const forms = inlineSchemas.get(schema) ?? new Map<"input" | "output", JsonSchema>();
  forms.set(io, result);
  inlineSchemas.set(schema, forms);
  return result;
}

function paramsOf(
  schema: z.ZodType | undefined,
  where: "path" | "query",
  components: Record<string, JsonSchema>,
): JsonSchema[] {
  if (!schema) return [];
  let full = inlineSchema(schema, "input");
  if (typeof full.$ref === "string") {
    const id = full.$ref.slice(componentPath.length);
    full = components[id] ?? full;
  }
  const properties = full.properties ?? {};
  const required = new Set(full.required ?? []);
  return Object.entries(properties).map(([name, value]) => ({
    name,
    in: where,
    required: where === "path" || required.has(name),
    schema: value,
  }));
}

export function openApiOf(table: Record<string, OpenApiEndpoint>) {
  const paths: Record<string, Record<string, unknown>> = {};
  const components = { ...outputComponents, ...inputComponents };
  for (const [name, endpoint] of Object.entries(table)) {
    const path = endpoint.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const operation: Record<string, any> = {
      operationId: name,
      summary: endpoint.summary,
      parameters: [
        ...paramsOf(endpoint.params, "path", components),
        ...paramsOf(endpoint.query, "query", components),
      ],
      responses: {},
      "x-vera-codes": [...endpoint.codes],
    };
    if (endpoint.body)
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: inlineSchema(endpoint.body, "input") } },
      };
    if (endpoint.form)
      operation.requestBody = {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: Object.fromEntries(
                endpoint.form.map((field) => [
                  field,
                  field === "file" ? { type: "string", format: "binary" } : { type: "string" },
                ]),
              ),
              required: [...endpoint.form],
            },
          },
        },
      };
    if (endpoint.public) operation["x-vera-public"] = true;
    if (endpoint.engine === false) operation["x-vera-engine"] = false;
    if (endpoint.redirects) {
      operation.responses["302"] = {
        description: "Redirect",
        headers: { Location: { schema: { type: "string" } } },
      };
    } else {
      const status = endpoint.status ?? (endpoint.response ? 200 : 204);
      operation.responses[String(status)] = endpoint.response
        ? {
            description: "Success",
            content: { "application/json": { schema: inlineSchema(endpoint.response, "output") } },
          }
        : { description: "No content" };
    }
    operation.responses.default = {
      description: "Problem",
      content: { "application/problem+json": { schema: { $ref: `${componentPath}Problem` } } },
    };
    const method = endpoint.method.toLowerCase();
    paths[path] ??= {};
    paths[path] = { ...paths[path], [method]: operation };
  }
  return {
    openapi: "3.1.0",
    info: { title: "VERA API", version: readFileSync(resolve(root, "VERSION"), "utf8").trim() },
    servers: [{ url: "/api" }],
    paths,
    components: { schemas: components },
  };
}

function jsonText(value: unknown, depth = 0, path: string[] = []): string {
  const indent = "  ".repeat(depth);
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((item) => `${"  ".repeat(depth + 1)}${jsonText(item, depth + 1, path)}`).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  return `{\n${entries
    .map(([key, entry]) => {
      const entryPath = [...path, key];
      const serialized =
        path.join(".") === "components.schemas"
          ? JSON.stringify(entry)
          : jsonText(entry, depth + 1, entryPath);
      return `${"  ".repeat(depth + 1)}${JSON.stringify(key)}: ${serialized}`;
    })
    .join(",\n")}\n${indent}}`;
}

if (import.meta.main) {
  const contents = `${jsonText(openApiOf(endpoints))}\n`;
  if (process.argv.includes("--check")) {
    if (readFileSync(target, "utf8") !== contents) {
      console.error("contract/openapi.json is stale; run make openapi");
      process.exitCode = 1;
    }
  } else {
    writeFileSync(target, contents);
  }
}
