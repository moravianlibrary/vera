import React from "react";
import { SearchField, SearchGroup } from "../../../contexts/documents/search/SearchNodes";
import AdvancedSearchField from "./AdvancedSearchField";
import AdvancedSearchGroup from "./AdvancedSearchGroup";
import { RuleType } from "../../../types/SearchTypes";

function getBackground(level: number) {
    switch (level) {
        case 0: return "#badaee";
        case 1: return "#cee5f3";
        case 2: return "#e3f0f8";
        case 3: return "#f7fbfd";
    }
};

interface AdvancedSearchNodeProps {
    data: SearchGroup | SearchField | undefined;
    index?: number;
    onDelete?: (index: number) => void;
}

const AdvancedSearchNode: React.FC<AdvancedSearchNodeProps> = ({ data, index, onDelete }) => {
    switch (data?.type) {
        case RuleType.Group: return <AdvancedSearchGroup data={data as SearchGroup} index={index} onDelete={onDelete} bgColor={getBackground(data.level)} />;
        case RuleType.Field:
        case RuleType.TextField:
        case RuleType.NumberField:
        case RuleType.TreeField: return <AdvancedSearchField data={data as SearchField} index={index!} onDelete={onDelete!} />;
    }
    return (<div></div>);
};

export default AdvancedSearchNode;
