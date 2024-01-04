import { RuleType } from "./SearchNodes";

const DocumentField = {
    SYSNO: {name: "sysno", type: RuleType.TEXT_FIELD},
    VOLUME_NUMBER: {name: "volume_number", type: RuleType.TEXT_FIELD},
    CATEGORY: {name: "category", type: RuleType.ENUM_FIELD},
    TITLE: {name: "title", type: RuleType.TEXT_FIELD},
    PAGES_COUNT: {name: "pages_count", type: RuleType.NUMBER_FIELD},
};

export default DocumentField;
