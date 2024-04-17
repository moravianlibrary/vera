import { useTranslation } from "react-i18next";
import { Column, ColumnEditorOptions } from "primereact/column";
import {
    DataTable,
    DataTableEditingRows,
    DataTableRowEditEvent,
    DataTableValueArray,
} from "primereact/datatable";

import React from "react";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";
import { textEditor } from "../../services/Editors.js";
import { Button } from "primereact/button";
import { RoleModel } from "../../contexts/user/RoleModel";
import ActionGroupColumn, {
    ActionGroupColumnEditor,
} from "./ActionGroupColumn";
import { ActionType } from "../../types/ActionType";
import ActionColumn, { ActionColumnEditor } from "./ActionColumn";
import { useRoles } from "../../contexts/roles/RolesContext";

export interface LabeledAction {
    action: ActionType;
    label: string;
}

interface RolesTableProps {
    header: () => React.JSX.Element;
}

const RolesTable: React.FC<RolesTableProps> = (props) => {
    const { t } = useTranslation();
    const {
        roles,
        editingRoles,
        handleEditRole,
        handleAcceptEdit,
        handleCancelEdit,
        handleDeleteRole,
    } = useRoles();

    const handleRowEditChange = (event: DataTableRowEditEvent) => {
        const changeEditRole = roles[event.index];
        if (editingRoles.includes(changeEditRole)) {
            handleCancelEdit(changeEditRole);
        } else {
            handleEditRole(changeEditRole);
        }
    };

    const deleteButton = (role: RoleModel) => {
        if (role.id) {
            return (
                <Button
                    className="p-button-rounded p-button-text"
                    icon="pi pi-trash"
                    severity={role.id === 1 ? "secondary" : "danger"}
                    disabled={role.id === 1}
                    onClick={() => handleDeleteRole(role)}
                />
            );
        }
    };

    const headerColumnGroup = (
        <ColumnGroup>
            <Row>
                <Column header={t("Role")} />
                <Column header={t("Actions")} />
                <Column header={t("Operations")} colSpan={2} />
            </Row>
        </ColumnGroup>
    );

    const readDatatableActions = [
        { action: ActionType.ReadDatatableOwn, label: t("Own") },
        {
            action: ActionType.ReadDatatableDepartment,
            label: t("Department's"),
        },
        { action: ActionType.ReadDatatableAll, label: t("All") },
    ];

    const editDatatableActions = [
        { action: ActionType.EditDatatableOwn, label: t("Own") },
        {
            action: ActionType.EditDatatableDepartment,
            label: t("Department's"),
        },
        { action: ActionType.EditDatatableAll, label: t("All") },
    ];

    const insertDatatableAction = {
        action: ActionType.InsertDatatable,
        label: "Document insertion allowed",
    };
    const writeDatatableAction = {
        action: ActionType.WriteDatatable,
        label: "Document creation allowed",
    };
    const commentOnDatatableAction = {
        action: ActionType.CommentOnDatatable,
        label: "Commenting on documents allowed",
    };

    const readCategoriesActions = [
        {
            action: ActionType.ReadCategoriesDepartment,
            label: t("Department's"),
        },
        { action: ActionType.ReadCategoriesAll, label: t("All") },
    ];

    const editCategoriesActions = [
        {
            action: ActionType.EditCategoriesDepartment,
            label: t("Department's"),
        },
        { action: ActionType.EditCategoriesAll, label: t("All") },
    ];

    const planTasksAction = {
        action: ActionType.PlanTasks,
        label: "Planning tasks allowed",
    };
    const adminTasksAction = {
        action: ActionType.AdminTasks,
        label: "Administrating tasks allowed",
    };

    const editAccessAction = {
        action: ActionType.EditAccess,
        label: "Editing access settings allowed",
    };
    const extractAction = {
        action: ActionType.Extract,
        label: "Extraction allowed",
    };
    const adminExtractionsAction = {
        action: ActionType.AdminExtractions,
        label: "Administrating extractions allowed",
    };
    const adminDatabaseAction = {
        action: ActionType.AdminDatabase,
        label: "Administrating database allowed",
    };

    const actionsColumn = (role: RoleModel) => {
        return (
            <div className="flex flex-wrap gap-3 align-items-center">
                <ActionGroupColumn
                    actions={readDatatableActions}
                    role={role}
                    label="Allowed to read documents"
                />
                <ActionGroupColumn
                    actions={editDatatableActions}
                    role={role}
                    label="Allowed to edit documents"
                />
                <ActionColumn action={insertDatatableAction} role={role} />
                <ActionColumn action={writeDatatableAction} role={role} />
                <ActionColumn action={commentOnDatatableAction} role={role} />
                <ActionColumn action={planTasksAction} role={role} />
                <ActionColumn action={adminTasksAction} role={role} />
                <ActionGroupColumn
                    actions={readCategoriesActions}
                    role={role}
                    label="Allowed to read categories"
                />
                <ActionGroupColumn
                    actions={editCategoriesActions}
                    role={role}
                    label="Allowed to edit categories"
                />
                <ActionColumn action={extractAction} role={role} />
                <ActionColumn action={adminExtractionsAction} role={role} />
                <ActionColumn action={editAccessAction} role={role} />
                <ActionColumn action={adminDatabaseAction} role={role} />
            </div>
        );
    };

    const actionsEditor = (options: ColumnEditorOptions) => {
        return (
            <div className="flex flex-wrap gap-3 align-items-center">
                <ActionGroupColumnEditor
                    actions={readDatatableActions}
                    options={options}
                    label="Allowed to read documents"
                />
                <ActionGroupColumnEditor
                    actions={editDatatableActions}
                    options={options}
                    label="Allowed to edit documents"
                />
                <ActionColumnEditor
                    action={insertDatatableAction}
                    options={options}
                />
                <ActionColumnEditor
                    action={writeDatatableAction}
                    options={options}
                />
                <ActionColumnEditor
                    action={commentOnDatatableAction}
                    options={options}
                />
                <ActionColumnEditor
                    action={planTasksAction}
                    options={options}
                />
                <ActionColumnEditor
                    action={adminTasksAction}
                    options={options}
                />
                <ActionGroupColumnEditor
                    actions={readCategoriesActions}
                    options={options}
                    label="Allowed to read categories"
                />
                <ActionGroupColumnEditor
                    actions={editCategoriesActions}
                    options={options}
                    label="Allowed to edit categories"
                />
                <ActionColumnEditor action={extractAction} options={options} />
                <ActionColumnEditor
                    action={adminExtractionsAction}
                    options={options}
                />
                <ActionColumnEditor
                    action={editAccessAction}
                    options={options}
                />
                <ActionColumnEditor
                    action={adminDatabaseAction}
                    options={options}
                />
            </div>
        );
    };

    return (
        <DataTable
            value={roles}
            editMode="row"
            onRowEditChange={handleRowEditChange}
            editingRows={
                (editingRoles as DataTableValueArray | DataTableEditingRows) ||
                []
            }
            onRowEditComplete={(e) => handleAcceptEdit(e.newData as RoleModel)}
            headerColumnGroup={headerColumnGroup}
            scrollable
            scrollHeight="flex"
            header={props.header}
        >
            <Column field="name" editor={textEditor} />
            <Column
                field="actions"
                body={(role) => actionsColumn(role)}
                editor={actionsEditor}
            />
            <Column rowEditor />
            <Column body={deleteButton} />
        </DataTable>
    );
};

export default RolesTable;
