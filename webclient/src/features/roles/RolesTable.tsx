import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable, DataTableEditingRows, DataTableRowEditEvent, DataTableValueArray } from "primereact/datatable";

import React from "react";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";
import { textEditor } from '../../services/Editors.js';
import { Button } from "primereact/button";
import { RoleModel } from "../../contexts/user/RoleModel";
import ActionGroupColumn from "./ActionGroupColumn";
import { ActionType } from "../../types/ActionType";
import ActionColumn from "./ActionColumn";
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
    const { roles, editingRoles, handleEditRole,
        handleAcceptEdit, handleCancelEdit, handleDeleteRole } = useRoles();
    
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
                <Button className="p-button-rounded p-button-text"
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
                <Column header={t('Role')} />
                <Column header={t('Actions')} />
                <Column header={t('Operations')} colSpan={2} />
            </Row>
        </ColumnGroup>
    );

    const readDatatableActions = [
        { action: ActionType.ReadDatatableOwn, label: t("Own") },
        { action: ActionType.ReadDatatableDepartment, label: t("Department's") },
        { action: ActionType.ReadDatatableAll, label: t("All") }
    ];

    const editDatatableActions = [
        { action: ActionType.EditDatatableOwn, label: t("Own") },
        { action: ActionType.EditDatatableDepartment, label: t("Department's") },
        { action: ActionType.EditDatatableAll, label: t("All") }
    ];

    const insertDatatableAction = { action: ActionType.InsertDatatable, label: "Document insertion allowed" };
    const writeDatatableAction = { action: ActionType.WriteDatatable, label: "Document creation allowed" };
    const commentOnDatatableAction = { action: ActionType.CommentOnDatatable, label: "Commenting on documents allowed" };

    const readCategoriesActions = [
        { action: ActionType.ReadCategoriesDepartment, label: t("Department's") },
        { action: ActionType.ReadCategoriesAll, label: t("All") }
    ];

    const editCategoriesActions = [
        { action: ActionType.EditCategoriesDepartment, label: t("Department's") },
        { action: ActionType.EditCategoriesAll, label: t("All") }
    ];

    const planTasksAction = { action: ActionType.PlanTasks, label: "Planning tasks allowed" };
    const adminTasksAction = { action: ActionType.AdminTasks, label: "Administrating tasks allowed" };

    const editAccessAction = { action: ActionType.EditAccess, label: "Editing access settings allowed" };
    const extractAction = { action: ActionType.Extract, label: "Extraction allowed" };
    const adminDatabaseAction = { action: ActionType.AdminDatabase, label: "Administrating database allowed" };

    const getActionsColumn = (role: RoleModel) => {
        return (
            <div className="flex flex-wrap gap-3 align-items-center">
                    <ActionGroupColumn actions={readDatatableActions} role={role} disabled={!editingRoles.includes(role)} label="Allowed to read documents" />
                    <ActionGroupColumn actions={editDatatableActions} role={role} disabled={!editingRoles.includes(role)} label="Allowed to edit documents" />
                    <ActionColumn action={insertDatatableAction} role={role} disabled={!editingRoles.includes(role)} />
                    <ActionColumn action={writeDatatableAction} role={role} disabled={!editingRoles.includes(role)} />
                    <ActionColumn action={commentOnDatatableAction} role={role} disabled={!editingRoles.includes(role)} />
                    <ActionColumn action={planTasksAction} role={role} disabled={!editingRoles.includes(role)} />
                    <ActionColumn action={adminTasksAction} role={role} disabled={!editingRoles.includes(role)} />
                    <ActionGroupColumn actions={readCategoriesActions} role={role} disabled={!editingRoles.includes(role)} label="Allowed to read categories" />
                    <ActionGroupColumn actions={editCategoriesActions} role={role} disabled={!editingRoles.includes(role)} label="Allowed to edit categories" />
                    <ActionColumn action={extractAction} role={role} disabled={!editingRoles.includes(role)} />
                    <ActionColumn action={editAccessAction} role={role} disabled={!editingRoles.includes(role)} />
                    <ActionColumn action={adminDatabaseAction} role={role} disabled={!editingRoles.includes(role)} />
            </div>
        );
    }

    return (
        <DataTable
            value={roles}
            editMode="row"
            onRowEditChange={handleRowEditChange}
            editingRows={editingRoles as DataTableValueArray | DataTableEditingRows || []}
            onRowEditComplete={(e) => handleAcceptEdit(e.data as RoleModel)}
            headerColumnGroup={headerColumnGroup}
            scrollable
            scrollHeight="flex"
            header={props.header}
        >
            <Column field="name" editor={textEditor} />
            <Column body={role => getActionsColumn(role)} />
            <Column rowEditor />
            <Column body={deleteButton} />
        </DataTable> 
    );
};

export default RolesTable;