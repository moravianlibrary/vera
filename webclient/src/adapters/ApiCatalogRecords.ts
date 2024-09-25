import { ActionType } from "../types/ActionType";
import MarcFieldDifferenceType from "../types/MarcFieldDifferenceType";
import axiosInstance, { ApiBase, ApiOptions, authHeader } from "./ApiBase";

export enum Marc21DiffType {
    MissingField = "MissingField",
    ExtraField = "ExtraField",
    DifferentValue = "DifferentValue",
    Equal = "Equal",
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

interface MarcSubfieldDifference {
    code: string;
    value: string | null;
    different_to: string | null;
    differs: boolean;
}

interface MarcFieldDifference {
    tag: string;
    ind1: string | null;
    ind2: string | null;
    control_field: boolean;
    difference_type: MarcFieldDifferenceType;
    subfield_differences: MarcSubfieldDifference[];
}

interface MarcSubfield {
    [key: string]: string;
}

interface MarcFieldData {
    ind1: string;
    ind2: string;
    subfields: MarcSubfield[];
}

interface MarcField {
    [key: string]: string | MarcFieldData;
}

interface MarcRecord {
    leader: string;
    fields: MarcField[];
}

interface CatalogRecord {
    sysno: string;
    main_record: MarcRecord;
    cnb: string | null;
    language: string | null;
    signature: string | null;
    isxn: string | null;
    skc_sysno: string | null;
    skc_record: MarcRecord | null;
    skc_difference: MarcFieldDifference[] | null;
    has_valid_main_record: boolean;
    cnb_sysno: string | null;
    cnb_record: MarcRecord | null;
    cnb_difference: MarcFieldDifference[] | null;
    has_valid_cnb: boolean;
    last_updated: string;
}

class ApiCatalogRecords extends ApiBase<CatalogRecord> {
    constructor() {
        super("/catalog_records", {
            disableCreate: true,
            disableUpdate: true,
            disableDelete: true,
        } as ApiOptions);
    }
}

export default ApiCatalogRecords;
export type {
    CatalogRecord,
    MarcSubfieldDifference,
    MarcFieldDifference,
    MarcRecord,
    Marc21Diff,
    Marc21DiffRecord,
    Marc21Field,
    Marc21Subfield,
};
