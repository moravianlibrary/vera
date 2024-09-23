import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Column,
    ColumnBodyOptions,
    ColumnEditorOptions,
} from "primereact/column";
import {
    DataTable,
    DataTableEditingRows,
    DataTableRowEditEvent,
    DataTableValueArray,
} from "primereact/datatable";
import { textEditor } from "../../services/Editors";
import { Button } from "primereact/button";
import { useDepartments } from "../../contexts/departments/DepartmentsContext";
import React from "react";
import { Chips, ChipsChangeEvent } from "primereact/chips";
import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { Chip } from "primereact/chip";
import { Department } from "../../adapters/ApiDepartments";

interface DepartmentsTableProps {
    header: () => React.JSX.Element;
}

const DepartmentsTable: React.FC<DepartmentsTableProps> = (props) => {
    const { t } = useTranslation();

    const {
        departments,
        editingDepartments,
        users,
        handleEditDepartment,
        handleAcceptEdit,
        handleCancelEdit,
        handleDeleteDepartment,
    } = useDepartments();

    const handleRowEditChange = (event: DataTableRowEditEvent) => {
        const changeEditDepartment = departments[event.index];
        if (editingDepartments.includes(changeEditDepartment)) {
            handleCancelEdit(changeEditDepartment);
        } else {
            handleEditDepartment(changeEditDepartment);
        }
    };

    const deleteButton = (department: Department) => {
        if (department.id) {
            return (
                <Button
                    className="p-button-rounded p-button-text p-button-danger"
                    icon="pi pi-trash"
                    onClick={() => handleDeleteDepartment(department)}
                />
            );
        }
    };

    const usersColumnBody = (data: Department, option: ColumnBodyOptions) => {
        return (
            <div className="flex gap-1">
                {data.usernames.map((u, index) => (
                    <Chip key={index} label={u} />
                ))}
            </div>
        );
    };

    return (
        <DataTable
            value={departments}
            editMode="row"
            onRowEditChange={handleRowEditChange}
            editingRows={
                (editingDepartments as
                    | DataTableValueArray
                    | DataTableEditingRows) || []
            }
            onRowEditComplete={(e) => handleAcceptEdit(e.newData as Department)}
            scrollable
            scrollHeight="flex"
            header={props.header}
        >
            <Column field="name" header={t("Name")} editor={textEditor} />
            <Column
                field="abbreviation"
                header={t("Abbreviation")}
                editor={textEditor}
            />
            <Column
                header={t("Users")}
                field="users"
                body={usersColumnBody}
                editor={(options) => <UsersEditor options={options} />}
            />
            <Column rowEditor />
            <Column body={deleteButton} />
        </DataTable>
    );
};

interface UsersEditorProps {
    options: ColumnEditorOptions;
}

export const UsersEditor: React.FC<UsersEditorProps> = ({ options }) => {
    const { t } = useTranslation();
    const { rowData, editorCallback } = options;
    const [selectedUsers, setSelectedUsers] = useState<string[]>(
        rowData.users || []
    );
    const { users } = useDepartments();

    useEffect(() => {
        setSelectedUsers(rowData.users || []);
    }, [rowData]);

    const handleChipsChange = (e: ChipsChangeEvent) => {
        editorCallback!(e.value ? e.value : []);
    };

    const handleDropdownChange = (e: DropdownChangeEvent) => {
        editorCallback!([...selectedUsers, e.value]);
    };

    return (
        <div>
            <Chips
                value={selectedUsers.sort((a: string, b: string) =>
                    a.localeCompare(b)
                )}
                allowDuplicate={false}
                onChange={handleChipsChange}
            />
            <Dropdown
                disabled={
                    users.filter((u) => !selectedUsers.includes(u)).length === 0
                }
                placeholder={t("Add user")}
                options={users.filter((u) => !selectedUsers.includes(u))}
                multiple
                onChange={handleDropdownChange}
            />
        </div>
    );
};

export default DepartmentsTable;
