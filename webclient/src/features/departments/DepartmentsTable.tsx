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
    DataTableValueArray,
} from "primereact/datatable";
import { useDepartments } from "../../contexts/DepartmentsContext";
import React from "react";
import { Chips, ChipsChangeEvent } from "primereact/chips";
import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { Chip } from "primereact/chip";
import { Department } from "../../adapters/ApiDepartments";
import DeleteButton from "../../components/buttons/DeleteButton";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";
import { textEditor } from "../../components/editors/ColumnEditors";

interface DepartmentsTableProps {}

const DepartmentsTable: React.FC<DepartmentsTableProps> = () => {
    const { t } = useTranslation("departments");

    const { items, deleteItem, editingItems, onRowEditEvent, saveChanges } =
        useDepartments();

    const usersColumnBody = (data: Department, option: ColumnBodyOptions) => {
        return (
            <div className="flex gap-1">
                {data.usernames.map((u, index) => (
                    <Chip key={index} label={u} />
                ))}
            </div>
        );
    };

    const headerColumnGroup = (
        <ColumnGroup>
            <Row>
                <Column header={t("table.columns.name")} />
                <Column header={t("table.columns.abbreviation")} />
                <Column header={t("table.columns.usernames")} />
                <Column header={t("table.columns.actions")} colSpan={2} />
            </Row>
        </ColumnGroup>
    );

    return (
        <DataTable
            value={items}
            editMode="row"
            onRowEditChange={onRowEditEvent}
            editingRows={
                (editingItems as DataTableValueArray | DataTableEditingRows) ||
                []
            }
            onRowEditComplete={(e) =>
                saveChanges(e.newData.id, e.newData as Department)
            }
            headerColumnGroup={headerColumnGroup}
            scrollable
            scrollHeight="flex"
        >
            <Column field="name" editor={textEditor} />
            <Column field="abbreviation" editor={textEditor} />
            <Column
                field="usernames"
                body={usersColumnBody}
                editor={(options) => <UsersEditor options={options} />}
            />
            <Column rowEditor />
            <Column
                body={(d) => (
                    <DeleteButton itemId={d.id} onDeleteItem={deleteItem} />
                )}
            />
        </DataTable>
    );
};

interface UsersEditorProps {
    options: ColumnEditorOptions;
}

const UsersEditor: React.FC<UsersEditorProps> = ({ options }) => {
    const { t } = useTranslation("departments");
    const { rowData, editorCallback } = options;
    const [selectedUsers, setSelectedUsers] = useState<string[]>(
        rowData.usernames || []
    );
    const { usernames } = useDepartments();

    useEffect(() => {
        setSelectedUsers(rowData.usernames || []);
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
                    usernames.filter((u) => !selectedUsers.includes(u))
                        .length === 0
                }
                placeholder={t("actions.placeholder.add-user")}
                options={usernames.filter((u) => !selectedUsers.includes(u))}
                multiple
                onChange={handleDropdownChange}
            />
        </div>
    );
};

export default DepartmentsTable;
