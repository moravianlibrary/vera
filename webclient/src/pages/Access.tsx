import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";

import '../styles/Access.css';
import RolesTable from "../features/roles/RolesTable";
import DepartmentsTable from "../components/DepartmentsTable.js";
import { RolesProvider, useRoles } from "../contexts/roles/RolesContext";

const TableEnum = {
    DEPARTMENS: 'departments',
    ROLES: 'roles'
};

const Access = () => {
    return (
        <RolesProvider>
            <AccessDiv />
        </RolesProvider>
    )
}

const AccessDiv = () => {
    const { t } = useTranslation();
    const { handleAddRole } = useRoles();

    const [table, setTable] = useState(TableEnum.DEPARTMENS);
    const [tablesOptions] = useState([
        { label: t('departments'), value: TableEnum.DEPARTMENS },
        { label: t('roles'), value: TableEnum.ROLES }
    ]);

    const [addDepartment, setAddDepartment] = useState(false);

    const handleInsert = (event) => {
        if (table === TableEnum.DEPARTMENS) {
            setAddDepartment(true);
        } else if (table === TableEnum.ROLES) {
            handleAddRole();
        }
    };

    const resetAddDepartment = () => {
        setAddDepartment(false);
    };

    const tableHeader = () => {
        return (
            <div className="table-header">
                <Button className="add-button" icon="pi pi-plus" rounded onClick={handleInsert} />
                <div className="middle-container">
                    <SelectButton className="select-button" value={table} onChange={(e) => setTable(e.value ? e.value : table)} options={tablesOptions} />
                </div>
            </div>
        );
    };

    return (
        <div className="Access">
            { table === TableEnum.DEPARTMENS && <DepartmentsTable 
                header={tableHeader}
                handleAddRow={addDepartment}
                onRowAdded={resetAddDepartment}
            />}
            { table === TableEnum.ROLES &&
            <RolesTable header={tableHeader} />}
        </div>
    );
};

export default Access;