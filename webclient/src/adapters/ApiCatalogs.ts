import { ActionType } from "../types/ActionType";
import axiosInstance, { authHeader } from "./ApiBase";

export enum Marc21DiffType {
    MissingField = "MissingField",
    ExtraField = "ExtraField",
    DifferentValue = "DifferentValue",
    Equal = "Equal"
}

interface Marc21Subfield {
    code: string;
    value: string;
}

interface Marc21Field {
    tag: string;
    control_field: boolean;
    indicator1: string | null;
    indicator2: string | null;
    subfields: Marc21Subfield[];
    data: string | null;
}

interface Marc21Diff {
    type: Marc21DiffType;
    field: Marc21Field;
    value: string | null;
}

interface Marc21DiffRecord {
    diffs: Marc21Diff[];
    sysno1: string | null;
    sysno2: string | null;
}

namespace ApiCatalogs {
    export function getMzkSkcDiff(mzk_sysno: string) {
        return axiosInstance.get<Marc21DiffRecord>(`/catalogs/mzk_skc_diff/${mzk_sysno}`, { headers: authHeader() });
    }

    export function getMzkCnbDiff(mzk_sysno: string) {
        return axiosInstance.get<Marc21DiffRecord>(`/catalogs/mzk_cnb_diff/${mzk_sysno}`, { headers: authHeader() });
    }

    export function getCnbValidity(mzk_sysno: string) {
        return axiosInstance.get<number>(`/catalogs/cnb_validity/${mzk_sysno}`, { headers: authHeader() });
    }
}

export default ApiCatalogs;
export type { Marc21Diff, Marc21DiffRecord, Marc21Field, Marc21Subfield };
