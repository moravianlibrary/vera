import { z, type ZodType } from "zod";

const EsQuerySchema = z.any();
type EsQuery = z.infer<typeof EsQuerySchema>;

const EsRequestSchema = z.object({
    query: EsQuerySchema,
    from: z.number().min(0).optional(),
    size: z.number().min(1).max(1000).optional(),
    sort: z
        .array(
            z.object({
                field: z.string(),
                order: z.enum(["asc", "desc"]).default("asc"),
            })
        )
        .optional(),
});
type EsRequest = z.infer<typeof EsRequestSchema>;

const createEsHitSchema = <T extends ZodType<any>>(sourceSchema: T) =>
    z.object({
        _index: z.string(),
        _id: z.string(),
        _score: z.number().optional(),
        _source: sourceSchema,
    });

const createEsHitsSchema = <T extends ZodType<any>>(sourceSchema: T) =>
    z.object({
        total: z.object({ value: z.number() }),
        hits: z.array(createEsHitSchema(sourceSchema)),
    });

const createEsResponseSchema = <T extends ZodType<any>>(sourceSchema: T) =>
    z.object({
        took: z.number(),
        timed_out: z.boolean(),
        _shards: z.any(),
        hits: createEsHitsSchema(sourceSchema),
    });

export {
    EsQuerySchema,
    EsRequestSchema,
    createEsHitSchema,
    createEsHitsSchema,
    createEsResponseSchema,
};
export type { EsQuery, EsRequest };
