import { RuleType } from "./SearchNodes";

enum DocumentField {
    Sysno = 'Sysno',
    Volume = 'Volume',
    Category = 'Category',
    Title = 'Title',
    PagesCount = 'PagesCount',
}

type DocumentSearchFieldType = {
    [key in keyof typeof DocumentField]: { name: string; type: RuleType };
};

const DocumentSearchField: DocumentSearchFieldType = {
    Sysno: {name: "System number", type: RuleType.TextField},
    Volume: {name: "Volume", type: RuleType.TextField},
    Category: {name: "Category", type: RuleType.EnumField},
    Title: {name: "Title", type: RuleType.TextField},
    PagesCount: {name: "Pages count", type: RuleType.NumberField},
};

export default DocumentSearchField;
export type { DocumentField, DocumentSearchFieldType };
