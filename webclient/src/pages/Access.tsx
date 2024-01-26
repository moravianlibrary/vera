import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";

import '../styles/Access.css';
import RolesTable from "../components/RolesTable.js";
import DepartmentsTable from "../components/DepartmentsTable.js";

const TableEnum = {
    DEPARTMENS: 'departments',
    ROLES: 'roles'
};

const Access = () => {
    const { t } = useTranslation();

    const [table, setTable] = useState(TableEnum.DEPARTMENS);
    const [tablesOptions] = useState([
        { label: t('departments'), value: TableEnum.DEPARTMENS },
        { label: t('roles'), value: TableEnum.ROLES }
    ]);

    const [addDepartment, setAddDepartment] = useState(false);
    const [addRole, setAddRole] = useState(false);

    const handleInsert = (event) => {
        if (table === TableEnum.DEPARTMENS) {
            setAddDepartment(true);
        } else if (table === TableEnum.ROLES) {
            setAddRole(true);
        }
    };

    const resetAddDepartment = () => {
        setAddDepartment(false);
    };

    const resetAddRole = () => {
        setAddRole(false);
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
            { table === TableEnum.ROLES && <RolesTable
                header={tableHeader}
                handleAddRow={addRole}
                onRowAdded={resetAddRole}
            />}
        </div>
    );
}

export default Access;