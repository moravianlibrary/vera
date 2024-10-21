import MarcFieldDifferenceType from "../types/MarcFieldDifferenceType";
import { MaterialType } from "../types/MaterialType";
import { ApiBase, ApiOptions, authHeader } from "./ApiBase";

interface MarcSubfieldDifference {
    code: string;
    value: string | null;
    different_to: string | null;
    differs: boolean;
}

interface MarcFieldDifference {
    id: number;
    tag: string;
    ind1: string | null;
    ind2: string | null;
    control_field: boolean;
    difference_type: MarcFieldDifferenceType;
    subfield_differences: MarcSubfieldDifference[];
    approved_by: string | null;
    approved_at: string | null;
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

interface Frequency {
    frequency: string;
    date?: string;
}

interface CatalogRecord {
    id: string;
    sysno: string;
    main_record: MarcRecord;
    cnb: string | null;
    language: string | null;
    signature: string | null;
    isxn: string | null;
    barcodes: string[] | null;
    skc_sysno: string | null;
    skc_record: MarcRecord | null;
    skc_difference: MarcFieldDifference[] | null;
    has_valid_main_record: boolean;
    cnb_sysno: string | null;
    cnb_record: MarcRecord | null;
    cnb_difference: MarcFieldDifference[] | null;
    has_valid_cnb: boolean;
    added_at: string;
    updated_at: string;
    material_type: MaterialType | null;
    title: string | null;
    size: string | null;
    location_uri: string | null;
    publisher: string | null;
    publishing_place: string | null;
    publishing_year: string | null;
    languages: string[] | null;
    frequencies: Frequency[] | null;
}

class ApiCatalogRecords extends ApiBase<CatalogRecord> {
    constructor() {
        super("/catalog_records", {
            disableCreate: true,
            disableUpdate: true,
            disableDelete: true,
            disableGetPage: true,
        } as ApiOptions);
    }

    static search(query_params: Object) {
        const url = "/catalog_records/search";
        return ApiBase.axiosInstance.post(url, query_params, {
            headers: authHeader(),
        });
    }

    approveDifference(differenceId: number) {
        const url = `/catalog_records/differences/${differenceId}/approve`;
        return ApiBase.axiosInstance.patch(url, null, {
            headers: authHeader(),
        });
    }
}

export default ApiCatalogRecords;
export type {
    CatalogRecord,
    MarcSubfieldDifference,
    MarcFieldDifference,
    MarcRecord,
    Frequency,
};
