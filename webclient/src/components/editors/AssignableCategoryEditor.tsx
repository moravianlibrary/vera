import { ColumnEditorOptions } from "primereact/column";
import React from "react";
import AssignableCategoryPicker from "../selects/AssignableCategoryPicker";

interface AssignableCategoryEditorProps {
    options: ColumnEditorOptions;
}

const AssignableCategoryEditor: React.FC<AssignableCategoryEditorProps> = ({
    options,
}) => {
    if (options.editorCallback === undefined) {
        return null;
    }

    return (
        <AssignableCategoryPicker
            category_id={options.value}
            callback={(category_id) => options.editorCallback!(category_id)}
        />
    );
};

export default AssignableCategoryEditor;
