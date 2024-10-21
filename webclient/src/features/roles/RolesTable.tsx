import { useTranslation } from "react-i18next";
import { Column, ColumnEditorOptions } from "primereact/column";
import {
    DataTable,
    DataTableEditingRows,
    DataTableValueArray,
} from "primereact/datatable";
import React from "react";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";
import { textEditor } from "../../services/Editors.js";
import {
    ActionType,
    PermissionTypes,
    ScopePermission,
    ScopePermissions,
    SimplePermission,
    SimplePermissions,
    ValidScopesDispatcher,
    compare,
} from "../../types/ActionType";
import { useRoles } from "../../contexts/RolesContext";
import { Role } from "../../adapters/ApiRoles";
import DeleteButton from "../../components/buttons/DeleteButton";
import RoleFactory from "../../data/factories/RoleFactory";
import PermissionColumn from "./PermissionColumn";
import ScopePermissionColumn from "./ScopePermissionColumn";

export interface LabeledAction {
    action: ActionType;
    label: string;
}

interface RolesTableProps {}

const RolesTable: React.FC<RolesTableProps> = (props) => {
    const { t } = useTranslation("roles");
    const { items, deleteItem, editingItems, onRowEditEvent, saveChanges } =
        useRoles();

    const headerColumnGroup = (
        <ColumnGroup>
            <Row>
                <Column header={t("table.columns.role")} />
                <Column header={t("table.columns.permissions")} />
                <Column header={t("table.columns.actions")} colSpan={2} />
            </Row>
        </ColumnGroup>
    );

    const actionsColumn = (role: Role) => {
        const rolePermissions = RoleFactory.parseActionsToPermissions(
            role.actions
        );
        return (
            <div className="flex flex-wrap gap-3 align-items-center">
                {rolePermissions.sort(compare).map((permission, index) => {
                    return SimplePermissions.includes(permission) ? (
                        <PermissionColumn
                            key={index}
                            permission={permission as SimplePermission}
                        />
                    ) : (
                        <ScopePermissionColumn
                            key={index}
                            permission={permission as ScopePermission}
                            scopes={ValidScopesDispatcher(
                                permission[0] as ActionType
                            )}
                        />
                    );
                })}
            </div>
        );
    };

    const actionsEditor = (options: ColumnEditorOptions) => {
        return (
            <div className="flex flex-wrap gap-3 align-items-center">
                {PermissionTypes.map((permission, index) => {
                    return ScopePermissions.includes(permission) ? (
                        <ScopePermissionColumn.Editor
                            key={index}
                            permission={permission}
                            scopes={ValidScopesDispatcher(permission)}
                            permissions={options.value}
                            editorCallback={options.editorCallback!}
                        />
                    ) : (
                        <PermissionColumn.Editor
                            key={index}
                            permission={permission}
                            permissions={options.value}
                            editorCallback={options.editorCallback!}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <DataTable
            value={items}
            editMode="row"
            editingRows={
                (editingItems as DataTableValueArray | DataTableEditingRows) ||
                []
            }
            onRowEditChange={onRowEditEvent}
            onRowEditComplete={(e) => saveChanges(e.data.id, e.newData as Role)}
            headerColumnGroup={headerColumnGroup}
            scrollable
            scrollHeight="flex"
        >
            <Column field="name" editor={textEditor} />
            <Column
                field="actions"
                body={(role) => actionsColumn(role)}
                editor={actionsEditor}
            />
            <Column rowEditor={(r, o) => r.name !== "Admin"} />
            <Column
                body={(r) => (
                    <DeleteButton
                        itemId={r.id}
                        disabled={r.name === "Admin"}
                        onDeleteItem={deleteItem}
                        hideWhenDisabled
                    />
                )}
            />
        </DataTable>
    );
};

export default RolesTable;
