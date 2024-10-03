import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";

import "../styles/Access.css";
import RolesTable from "../features/roles/RolesTable";
import DepartmentsTable from "../features/departments/DepartmentsTable";
import { RolesProvider, useRoles } from "../contexts/roles/RolesContext";
import {
    DepartmentsProvider,
    useDepartments,
} from "../contexts/DepartmentsContext";
import { useLocation } from "react-router-dom";
import DataTableLayout from "../components/layouts/DataTableLayout";

const TableEnum = {
    DEPARTMENS: "departments",
    ROLES: "roles",
};

const Access = () => {
    return (
        <DepartmentsProvider>
            <RolesProvider>
                <AccessDiv />
            </RolesProvider>
        </DepartmentsProvider>
    );
};

const AccessDiv = () => {
    const { t } = useTranslation();
    const { handleAddDepartment } = useDepartments();
    const { handleAddRole } = useRoles();
    const location = useLocation();

    const [table, setTable] = useState(TableEnum.DEPARTMENS);
    const [tablesOptions] = useState([
        { label: t("departments"), value: TableEnum.DEPARTMENS },
        { label: t("roles"), value: TableEnum.ROLES },
    ]);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tableParam = searchParams.get("tab");
        const tableFromParam =
            tableParam === "roles" ? TableEnum.ROLES : TableEnum.DEPARTMENS;
        setTable(tableFromParam);
    }, [location.search]);

    const handleInsert = (event) => {
        if (table === TableEnum.DEPARTMENS) {
            handleAddDepartment();
        } else if (table === TableEnum.ROLES) {
            handleAddRole();
        }
    };

    const tableHeader = () => {
        return (
            <div className="table-header">
                <Button
                    className="add-button"
                    icon="pi pi-plus"
                    rounded
                    onClick={handleInsert}
                />
                <div className="middle-container">
                    <SelectButton
                        className="select-button"
                        value={table}
                        onChange={(e) => setTable(e.value ? e.value : table)}
                        options={tablesOptions}
                    />
                </div>
            </div>
        );
    };

    return (
        <DataTableLayout
            header={tableHeader()}
            datatable={
                table === TableEnum.DEPARTMENS ? (
                    <DepartmentsTable />
                ) : (
                    <RolesTable />
                )
            }
        />
    );
};

export default Access;
