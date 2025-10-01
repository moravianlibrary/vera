import { z } from "zod";
import { NameSchema } from "../common";

// TODO: validate filters structure
export const EsFilterPresetSchema = z.object({
    id: z.uuid(),
    name: NameSchema,
    filters: z.record(z.string(), z.any()),
});
export type EsFilterPreset = z.infer<typeof EsFilterPresetSchema>;

export interface EsTermsFilterState {
    size: number;
    include: string[];
}

export interface EsRangeFilterState {
    from?: number;
    to?: number;
}

export interface EsDateRangeFilterState {
    from?: string | number;
    to?: string | number;
}

export interface EsSearchFilterState {
    value: string;
}

export type EsFilterState =
    | EsTermsFilterState
    | EsRangeFilterState
    | EsDateRangeFilterState
    | EsSearchFilterState;

export type EsFilterStates = Record<string, EsFilterState>;
