import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { ColumnGroup } from "primereact/columngroup";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Role } from "../models/Role.js";
import { Row } from "primereact/row";
import { SelectButton } from "primereact/selectbutton";

import './Access.css';
import { api } from '../services/Api.js';
import { departmentEditor, roleEditor } from "../services/Editors.js";
import RolesTable from "../components/RolesTable.js";
import DepartmentsTable from "../components/DepartmentsTable.js";
import UsersTable from "../components/UsersTable.js";

const TableEnum = {
    USERS: 'users',
    DEPARTMENS: 'departments',
    ROLES: 'roles'
};

const Access = () => {
    const { t } = useTranslation();

    const [table, setTable] = useState(TableEnum.USERS);
    const [tablesOptions] = useState([
        { label: t('users'), value: TableEnum.USERS },
        { label: t('departmens'), value: TableEnum.DEPARTMENS },
        { label: t('roles'), value: TableEnum.ROLES }
    ]);

    const [addDepartment, setAddDepartment] = useState(false);
    const [addRole, setAddRole] = useState(false);

    const handleInsert = (event) => {
        if (table == TableEnum.DEPARTMENS) {
            setAddDepartment(true);
        } else if (table == TableEnum.ROLES) {
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
                <Button severity={table === TableEnum.USERS && "secondary"} className="add-button" icon="pi pi-plus" rounded onClick={handleInsert} />
                <div className="middle-container">
                    <SelectButton className="select-button" value={table} onChange={(e) => setTable(e.value ? e.value : table)} options={tablesOptions} />
                </div>
            </div>
        );
    };

    return (
        <div className="Access">
            { table === TableEnum.USERS && <UsersTable
                header={tableHeader}
            />}
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