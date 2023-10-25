import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";

import { api } from "../services/Api";
import { dataService } from "../services/Data";
import { textEditor } from "../services/Editors";

const DepartmentsTable = (props) => {
    const { handleAddRow, onRowAdded } = props;
    const { t } = useTranslation();

    const [departments, setDepartments] = useState([]);
    
    const [editingRows, setEditingRows] = useState([]);
    const [insertMode, setInsertMode] = useState(false);
    const [refreshCount, setRefreshCount] = useState(0);

    const handleInsert = () => {
        if (!insertMode) {
            setInsertMode(true);
            const newDepartment = {};
            setDepartments([...departments, newDepartment]);
            setEditingRows([...editingRows, newDepartment]);
        }
    };

    const onRowEditChange = (event) => {
        const { data, index } = event;
        if (insertMode && index == departments.length - 1) {
            setInsertMode(false);
        }
        const activeRowArray = Array.isArray(data) ? data : [data];
        setEditingRows(activeRowArray);
    };

    const handleDepartmentEdit = (event) => {
        const { newData, index } = event;

        if (insertMode && index == departments.length - 1) {
            api.createDepartment(newData);
        } else {
            api.updateDepartment(newData);
            setRefreshCount(refreshCount + 1);
        }
    };

    useEffect(() => {
        async function fetchDepartments() {
            const {departments} = await dataService.getDepartments();
            setDepartments(departments);
        }
        if (!insertMode) {
            fetchDepartments();
        }
    }, [insertMode, refreshCount]);

    useEffect(() => {
        if (handleAddRow) {
            handleInsert();
            onRowAdded();
        }
    }, [handleAddRow]);

    return (
        <DataTable
            value={departments}
            editMode="row"
            onRowEditChange={onRowEditChange}
            editingRows={editingRows || [false]}
            onRowEditComplete={handleDepartmentEdit}
            {...props}
        >
            <Column field="abbreviation" header={t('department_abbreviation')} editor={textEditor} />
            <Column field="name" header={t('department_name')} editor={textEditor} />
            <Column rowEditor />
        </DataTable> 
    );
};

export default DepartmentsTable;