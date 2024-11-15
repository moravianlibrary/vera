import React from "react";

interface TagsViewProps {
    values: any[];
    onDisplayValue: (value: any, index: number) => React.ReactNode;
}

const TagsView: React.FC<TagsViewProps> = ({ values, onDisplayValue }) => {
    return (
        <div className="flex flex-wrap gap-2">{values.map(onDisplayValue)}</div>
    );
};

export default TagsView;
