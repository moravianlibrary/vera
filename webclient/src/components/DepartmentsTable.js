import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";

import { dataService } from "../services/Data";
import { textEditor } from "../services/Editors";
import { Button } from "primereact/button";

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
            dataService.createDepartment(newData);
        } else {
            dataService.updateDepartment(newData);
            setRefreshCount(refreshCount + 1);
        }
    };

    const handleDeleteDepartment = (department) => {
        dataService.deleteDepartment(department);
        setRefreshCount(refreshCount + 1);
    };

    useEffect(() => {
        async function fetchDepartments() {
            const departments = await dataService.getDepartments();
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

    const deleteButton = (department) => {
        if (department.id) {
            return (
                <Button className="p-button-rounded p-button-text p-button-danger" icon="pi pi-trash" onClick={() => handleDeleteDepartment(department)} />
            );
        }
    };

    return (
        <DataTable
            value={departments}
            editMode="row"
            onRowEditChange={onRowEditChange}
            editingRows={editingRows || [false]}
            onRowEditComplete={handleDepartmentEdit}
            {...props}
        >
            <Column field="name" header={t('department_name')} editor={textEditor} />
            <Column rowEditor />
            <Column body={deleteButton} />
        </DataTable> 
    );
};

export default DepartmentsTable;