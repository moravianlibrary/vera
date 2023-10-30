import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";

import { textEditor } from "../services/Editors";
import { Button } from "primereact/button";
import { dataService } from "../services/Data";

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
            dataService.createCategory(newData);
        } else {
            dataService.updateCategory(newData);
            setRefreshCount(refreshCount + 1);
        }
    };

    const handleDeleteCategory = (category) => {
        dataService.deleteCategory(category);
        setRefreshCount(refreshCount + 1);
    };

    useEffect(() => {
        async function fetchCategories() {
            const categories = await dataService.getCategories();
            setCategories(categories);
        }
        if (!insertMode) {
            fetchCategories();
        }
    }, [insertMode, refreshCount]);

    const tableHeader = () => {
        return (
            <Button icon="pi pi-plus" rounded onClick={handleInsert} />
        );
    };

    const deleteButton = (category) => {
        if (!insertMode || category.id) {
            return (
                <Button className="p-button-rounded p-button-text p-button-danger" icon="pi pi-trash" onClick={() => handleDeleteCategory(category)} />
            );
        }
    };

    return (
        <DataTable
            value={categories}
            editMode="row"
            onRowEditChange={onRowEditChange}
            editingRows={editingRows || [false]}
            onRowEditComplete={handleCategoryEdit}
            header={tableHeader}
            resizableColumns
            {...props}
        >
            <Column field="name" header={t('category_name')} editor={textEditor} />
            <Column rowEditor />
            <Column body={deleteButton} />
        </DataTable>
    );
};

export default Categories;