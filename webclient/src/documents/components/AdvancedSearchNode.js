import { RuleType } from "../models/SearchNodes";
import AdvancedSearchField from "./AdvancedSearchField";
import AdvancedSearchGroup from "./AdvancedSearchGroup";
import AdvancedSearchTextField from "./AdvancedSearchTextField";

function getBackground(level) {
    switch (level) {
        case 0: return "#badaee";
        case 1: return "#cee5f3";
        case 2: return "#e3f0f8";
        case 3: return "#f7fbfd";
    }
};

const AdvancedSearchNode = (props) => {
    switch (props.data?.type) {
        case RuleType.GROUP: return <AdvancedSearchGroup {...props} bgColor={getBackground(props.data.level)} />;
        case RuleType.FIELD:
        case RuleType.TEXT_FIELD:
        case RuleType.NUMBER_FIELD:
        case RuleType.ENUM_FIELD: return <AdvancedSearchField {...props} />;
    }
    return (<div></div>);
};

export default AdvancedSearchNode;
