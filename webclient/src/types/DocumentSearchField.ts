import { DigitizationState } from "./DigitizationState";
import { IssuanceType } from "./IssuanceType";
import { MaterialType } from "./MaterialType";
import { RuleType } from "./SearchTypes";

export enum DocumentField {
    Sysno = "Sysno",
    MaterialType = "MaterialType",
    IssuanceType = "IssuanceType",
    Volume = "Volume",
    Bundle = "Bundle",
    Year = "Year",

    Category = "Category",
    Title = "title",

    Barcode = "Barcode",
    Signature = "Signature",
    Cnb = "Cnb",
    IsbnIssn = "IsbnIssn",
    Location = "Location",

    DigitizationState = "DigitizationState",

    PagesCount = "PagesCount",
    PagesCountCatalog = "PagesCountCatalog",
    PagesCountManual = "PagesCountManual",
    PagesCountPredicted = "PagesCountPredicted",
}

export type DocumentSearchFieldType = {
    [key in keyof typeof DocumentField]: { name: string; type: RuleType, enumOptions?: string[] };
};

const DocumentSearchField: DocumentSearchFieldType = {
    Sysno: {name: "System number", type: RuleType.TextField},
    MaterialType: {name: "Material type", type: RuleType.EnumField, enumOptions: Object.values(MaterialType)},
    IssuanceType: {name: "Issuance type", type: RuleType.EnumField, enumOptions: Object.values(IssuanceType)},
    Volume: {name: "Volume", type: RuleType.TextField},
    Bundle: {name: "Bundle", type: RuleType.TextField},
    Year: {name: "Year", type: RuleType.TextField},

    Category: {name: "Category", type: RuleType.TreeField},
    Title: {name: "Title", type: RuleType.TextField},

    Barcode: {name: "Barcode", type: RuleType.TextField},
    Signature: {name: "Signature", type: RuleType.TextField},
    Cnb: {name: "CNB", type: RuleType.TextField},
    IsbnIssn: {name: "ISBN/ISSN", type: RuleType.TextField},
    Location: {name: "Location", type: RuleType.RegexField},

    DigitizationState: {name: "Digitization state", type: RuleType.EnumField, enumOptions: Object.values(DigitizationState)},

    PagesCount: {name: "Pages count", type: RuleType.NumberField},
    PagesCountCatalog: {name: "Catalog's pages count", type: RuleType.NumberField},
    PagesCountManual: {name: "Manual pages count", type: RuleType.NumberField},
    PagesCountPredicted: {name: "Predicted pages count", type: RuleType.NumberField},
};

export default DocumentSearchField;
