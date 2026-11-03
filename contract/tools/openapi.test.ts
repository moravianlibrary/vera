import { describe, expect, test } from "bun:test";
import { endpoints } from "../src/endpoints.ts";
import { openApiOf } from "./openapi.ts";

const document = openApiOf(endpoints);

describe("OpenAPI document", () => {
  test("has one operation per endpoint at its method and path", () => {
    const operations = Object.values(document.paths).flatMap((path) => Object.values(path));
    expect(operations).toHaveLength(Object.keys(endpoints).length);
    for (const [name, endpoint] of Object.entries(endpoints)) {
      const path = endpoint.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
      const operation = document.paths[path]?.[endpoint.method.toLowerCase()] as any;
      expect(operation?.operationId).toBe(name);
    }
  });

  test("documents parameters, success statuses, redirects and refusal codes", () => {
    for (const [name, endpoint] of Object.entries(endpoints)) {
      const path = endpoint.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
      const operation = document.paths[path]?.[endpoint.method.toLowerCase()] as any;
      const params = operation.parameters as any[];
      const pathNames = [...endpoint.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);
      for (const key of pathNames)
        expect(params).toContainEqual(
          expect.objectContaining({ name: key, in: "path", required: true }),
        );
      for (const key of Object.keys((endpoint.query as any)?._def.shape ?? {}))
        expect(params.some((item) => item.name === key && item.in === "query")).toBe(true);
      if (!endpoint.response && !endpoint.redirects)
        expect(operation.responses[String(endpoint.status ?? 204)]).toBeDefined();
      if (endpoint.status === 201) expect(operation.responses["201"]).toBeDefined();
      if (endpoint.redirects) expect(operation.responses["302"]?.headers?.Location).toBeDefined();
      expect(operation["x-vera-codes"]).toEqual(endpoint.codes);
      expect(operation["x-vera-engine"] === false).toBe(endpoint.engine === false);
      expect(name).toBeTruthy();
    }
  });

  test("has resolvable references and matching path parameters", () => {
    expect(document.openapi).toBe("3.1.0");
    const walk = (value: any) => {
      if (!value || typeof value !== "object") return;
      if (typeof value.$ref === "string") {
        let target: any = document;
        for (const part of value.$ref.slice(2).split("/"))
          target = target?.[part.replaceAll("~1", "/").replaceAll("~0", "~")];
        expect(target).toBeDefined();
      }
      for (const child of Object.values(value)) walk(child);
    };
    walk(document);
    for (const [path, pathItem] of Object.entries(document.paths)) {
      const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      for (const operation of Object.values(pathItem)) {
        const params = (operation as any).parameters ?? [];
        expect(
          params
            .filter((param: any) => param.in === "path")
            .map((param: any) => param.name)
            .sort(),
        ).toEqual(names.sort());
      }
    }
  });

  test("uses component references instead of inlining registered schemas", () => {
    const componentProperties = Object.values(document.components.schemas)
      .map((schema: any) => schema.properties)
      .filter((properties: any) => properties && Object.keys(properties).length > 0);
    const visit = (value: any) => {
      if (!value || typeof value !== "object") return;
      if (value.properties) {
        for (const properties of componentProperties)
          expect(value.properties).not.toEqual(properties);
      }
      for (const child of Object.values(value)) visit(child);
    };
    visit(document.paths);
  });

  test("is deterministic", () => {
    expect(JSON.stringify(openApiOf(endpoints))).toBe(JSON.stringify(openApiOf(endpoints)));
  });
});
