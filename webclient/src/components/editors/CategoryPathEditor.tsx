import EditorProps from "./Editor";
import { Button } from "primereact/button";
import { useState } from "react";
import AssignableCategoryPicker from "../selects/AssignableCategoryPicker";
import { CategoryPath } from "../../adapters/ApiDocuments";

const CategoryPathEditor: React.FC<EditorProps<CategoryPath>> = ({
    value,
    editorCallback,
    cancelCallback,
}) => {
    const [categoryId, setCategoryId] = useState<number | null>(
        value[value.length - 1].category_id
    );

    return (
        <div className="number-editor">
            <AssignableCategoryPicker
                category_id={categoryId}
                callback={setCategoryId}
            />
            <Button
                key="submit"
                text
                className="p-1 text-green-500"
                icon="pi pi-check"
                disabled={!categoryId}
                onClick={() =>
                    editorCallback([
                        { category_id: categoryId, category_name: "" },
                    ])
                }
            />
            <Button
                key="cancel"
                text
                className="p-1 text-red-500"
                icon="pi pi-times"
                onClick={cancelCallback}
            />
        </div>
    );
};

export default CategoryPathEditor;
