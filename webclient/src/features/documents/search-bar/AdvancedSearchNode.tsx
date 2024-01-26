import React from "react";
import { RuleType } from "../../../contexts/documents/search/SearchNodes";
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
        case RuleType.Group: return <AdvancedSearchGroup {...props} bgColor={getBackground(props.data.level)} />;
        case RuleType.Field:
        case RuleType.TextField:
        case RuleType.NumberField:
        case RuleType.EnumField: return <AdvancedSearchField {...props} />;
    }
    return (<div></div>);
};

export default AdvancedSearchNode;
