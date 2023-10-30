import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";

import { api } from "../services/Api";
import { textEditor } from "../services/Editors";

const Categories = (props) => {
    const { t } = useTranslation();

    const [categories, setCategories] = useState([]);

    const [editingRows, setEditingRows] = useState([]);
    const [insertMode, setInsertMode] = useState(false);
    const [refreshCount, setRefreshCount] = useState(0);

    const handleInsert = () => {
        if (!insertMode) {
            setInsertMode(true);
            const newCategory = {};
            setCategories([...categories, newCategory]);
            setEditingRows([...editingRows, newCategory]);
        }
    };

    const onRowEditChange = (event) => {
        const { data, index } = event;
        if (insertMode && index == categories.length - 1) {
            setInsertMode(false);
        }
        const activeRowArray = Array.isArray(data) ? data : [data];
        setEditingRows(activeRowArray);
    };

    const handleCategoryEdit = (event) => {
        const { newData, index } = event;

        if (insertMode && index == categories.length - 1) {
            api.createCategory(newData);
        } else {
            api.updateCategory(newData);
            setRefreshCount(refreshCount + 1);
        }
    };

    return (
        <DataTable
            value={categories}
            onRowEditComplete={handleCategoryEdit}
            {...props}
        >
            <Column field="name" header={t('category_name')} editor={textEditor} />
            <Column rowEditor />
        </DataTable>
    );
};

export default Categories;