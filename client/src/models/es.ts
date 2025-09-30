import { z } from "zod";
import type {
    EsAggregation,
    EsTermsAggregation,
} from "./api/responses/es_aggregations";

export const EsTermsAggRequestSchema = z.object({
    field: z.string(),
    size: z.number().optional(),
    include: z.union([z.string(), z.array(z.string())]).optional(),
    exclude: z.union([z.string(), z.array(z.string())]).optional(),
    order: z
        .object({ _count: z.literal("desc").or(z.literal("asc")).optional() })
        .optional(),
});
export type EsTermsAggRequest = z.infer<typeof EsTermsAggRequestSchema>;

export const EsRangeAggRequestSchema = z.object({
    field: z.string(),
    ranges: z.array(
        z.object({
            key: z.string().optional(),
            from: z.number().nullable().optional(),
            to: z.number().nullable().optional(),
        })
    ),
});
export type EsRangeAggRequest = z.infer<typeof EsRangeAggRequestSchema>;

export const EsDateRangeAggRequestSchema = z.object({
    field: z.string(),
    format: z.string().optional(),
    ranges: z.array(
        z.object({
            key: z.string().optional(),
            from: z.union([z.string(), z.number()]).nullable().optional(),
            to: z.union([z.string(), z.number()]).nullable().optional(),
        })
    ),
});
export type EsDateRangeAggRequest = z.infer<typeof EsDateRangeAggRequestSchema>;

export const EsAggregationsRequestSchema = z.union([
    z.object({ terms: EsTermsAggRequestSchema }),
    z.object({ range: EsRangeAggRequestSchema }),
    z.object({ date_range: EsDateRangeAggRequestSchema }),
]);
export type EsAggregationsRequest = z.infer<typeof EsAggregationsRequestSchema>;

//
//
//
//

export const EsFilterTypeSchema = z.enum([
    "terms",
    "range",
    "date-range",
    "search",
]);
export type EsFilterType = z.infer<typeof EsFilterTypeSchema>;

export interface EsTermsFilterConfig {
    type: "terms";
    field: string;
    displayType?: "labels" | "tree";
    size?: number;
    sizeOptions?: number[];
    include?: string[] | string;
    exclude?: string[] | string;
    order?: { _count: "asc" | "desc" };
    searchable?: boolean;
    renderBucketKey?: (key: string) => React.ReactNode;
    displayOrder?: string[];
}

export interface EsRangeFilterConfig {
    type: "range";
    field: string;
    min?: number;
    max?: number;
}

export interface EsDateRangeFilterConfig {
    type: "date-range";
    field: string;
}

export interface EsSearchFilterConfig {
    type: "search";
    field: string;
}

export type EsFilterConfig =
    | EsTermsFilterConfig
    | EsRangeFilterConfig
    | EsDateRangeFilterConfig
    | EsSearchFilterConfig;
