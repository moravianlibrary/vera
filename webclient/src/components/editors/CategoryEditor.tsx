import { ColumnEditorOptions } from "primereact/column";
import React from "react";
import CategoryPicker from "../pickers/CategoryPicker";

interface CategoryEditorProps {
    options: ColumnEditorOptions;
}

const CategoryEditor: React.FC<CategoryEditorProps> = ({ options }) => {
    if (options.editorCallback === undefined) {
        return null;
    }

    return (
        <CategoryPicker
            category_id={options.value}
            callback={(category_id) => options.editorCallback!(category_id)}
        />
    );
};

export default CategoryEditor;
