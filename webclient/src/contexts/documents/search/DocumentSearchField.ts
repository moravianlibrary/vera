import { RuleType } from "./SearchNodes";

export enum DocumentField {
    Sysno = 'Sysno',
    Volume = 'Volume',
    Category = 'Category',
    Title = 'Title',
    PagesCount = 'PagesCount',
}

export type DocumentSearchFieldType = {
    [key in keyof typeof DocumentField]: { name: string; type: RuleType };
};

const DocumentSearchField: DocumentSearchFieldType = {
    Sysno: {name: "System number", type: RuleType.TextField},
    Volume: {name: "Volume", type: RuleType.TextField},
    Category: {name: "Category", type: RuleType.TreeField},
    Title: {name: "Title", type: RuleType.TextField},
    PagesCount: {name: "Pages count", type: RuleType.NumberField},
};

export default DocumentSearchField;
