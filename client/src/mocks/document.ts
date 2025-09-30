import { Factory, Model, Server } from "miragejs";
import { faker } from "@faker-js/faker";
import {
    DocumentStatusSchema,
    type Document,
    type DocumentDigitizationRecord,
} from "../models/document";
import {
    IdentiferTypeSchema,
    IssuanceTypeSchema,
    MaterialTypeSchema,
} from "../models/catalog";
import {
    DigitizationRecordStateSchema,
    DigitizationStateSchema,
} from "../models/digitization";
import { fakeCatalogRecordId, fakeId } from "./faker";
import type { EsRequest } from "../models/es";
import { buildTermsAggregation } from "./es_factories";

export const identifierFactory = () => ({
    type: faker.helpers.arrayElement(IdentiferTypeSchema.options),
    value: faker.string.uuid(),
});

export const digitizationRecordFactory = (): DocumentDigitizationRecord => ({
    registry_record_id: faker.string.uuid(),
    record_state: faker.helpers.arrayElements(
        DigitizationRecordStateSchema.options,
        { min: 1, max: 2 }
    ),
    registry_issue_id: faker.datatype.boolean() ? faker.string.uuid() : null,
    issue_state: faker.datatype.boolean()
        ? faker.helpers.arrayElements(DigitizationRecordStateSchema.options, {
              min: 1,
              max: 2,
          })
        : null,
});

export const documentFactory = Factory.extend<Document>({
    id: fakeId,
    catalog_record_id: () => fakeCatalogRecordId(),
    document_id: fakeId,
    iteration: () => faker.number.int({ min: 1, max: 3 }),

    material_type: () => faker.helpers.arrayElement(MaterialTypeSchema.options),
    title: () => faker.lorem.sentence(3),
    subtitle: () => faker.lorem.sentence(6),
    identifiers: () =>
        Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () =>
            identifierFactory()
        ),

    barcode: () => faker.string.alphanumeric(8),
    volume_number: () => faker.string.numeric(2),
    volume_year: () => faker.date.past().getFullYear().toString(),
    bundle: () => faker.string.numeric(2),
    issuance_type: () => faker.helpers.arrayElement(IssuanceTypeSchema.options),

    digitization_state: () =>
        faker.helpers.arrayElements(DigitizationStateSchema.options, {
            min: 1,
            max: 2,
        }),
    digitization_records: () => {
        const count = faker.number.int({ min: 1, max: 4 });
        return Array.from({ length: count }, () => digitizationRecordFactory());
    },

    page_count_manual: () => faker.number.int({ min: 10, max: 500 }),
    page_count: () => faker.number.int({ min: 10, max: 500 }),

    properties: () => ({ language: "en", notes: faker.lorem.words(5) }),

    category_id: () => fakeId({ min: 1, max: 10 }),
    priority: () => faker.number.int({ min: 1, max: 5 }),

    digitization_list_id: () => null,
    digitization_list_state: () => null,

    status: () =>
        faker.helpers.arrayElements(DocumentStatusSchema.options, {
            min: 1,
            max: 2,
        }),

    created_by: () => faker.internet.username(),
    created_at: () => faker.date.past(),
    updated_at: () => faker.date.recent(),

    watchlists: () => [],
});

export function documentSeeds(server: Server) {
    server.createList("document", 100);
}

export function documentRoutes(this: any) {
    this.post("/documents/search", (schema: any, request: any) => {
        const esRequest = JSON.parse(request.requestBody) as EsRequest;

        const { query, aggs } = esRequest;

        const hits = schema
            .all("document")
            .models.filter((p: any) => query.match_all)
            .slice(query.from || 0, (query.from || 0) + (esRequest.size || 10))
            .map((p: any) => {
                const { id, ...rest } = p.attrs;
                return {
                    _index: "documents",
                    _id: String(p.id),
                    _source: rest,
                };
            });
        const totalItems = schema.all("document").length;

        const aggregationResults: Record<string, any> = {};
        if (aggs) {
            for (const [aggName, aggDef] of Object.entries(aggs)) {
                if ("terms" in (aggDef as any)) {
                    const field = (aggDef as any).terms.field;
                    aggregationResults[aggName] = buildTermsAggregation(
                        field,
                        schema.all("document").models
                    );
                }
                // Optionally: handle range, date_range, etc.
            }
        }

        return {
            took: 1,
            timed_out: false,
            _shards: { total: 1, successful: 1, failed: 0 },
            hits: { total: { value: totalItems }, hits },
            aggregations: aggregationResults,
        };
    });

    this.post("/documents/export", (schema: any, request: any) => {
        return new Blob(["Exported content"], { type: "text/csv" });
    });

    // this.post("/documents/generate-list", (schema: any, request: any) => {
    //     return schema.create("document");
    // });

    this.patch("/documents/:id/page-count", (schema: any, request: any) => {
        const id = request.params.id;
        const page_count = request.queryParams.page_count;
        const doc = schema.find("document", id);
        if (doc) {
            doc.update({ page_count });
            return doc.attrs;
        }
        return new Response({ detail: "Document not found" }, { status: 404 });
    });

    // this.post("/documents/watchlist", (schema, request) => {
    //     const { name, description } = request.queryParams;
    //     return { id: faker.string.uuid(), name, description };
    // });
}
