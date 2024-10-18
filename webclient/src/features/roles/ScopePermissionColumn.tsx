import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SelectButton, SelectButtonChangeEvent } from "primereact/selectbutton";
import {
    ActionScope,
    Permission,
    ScopePermission,
    SimplePermission,
} from "../../types/ActionType";
import { ColumnEditorOptions } from "primereact/column";

interface ScopePermissionColumnProps {
    permission: ScopePermission;
    scopes: ActionScope[];
}

interface ScopePermissionColumnEditorProps {
    permission: SimplePermission;
    scopes: ActionScope[];
    options: ColumnEditorOptions;
}

const ScopePermissionColumn: React.FC<ScopePermissionColumnProps> & {
    Editor: React.FC<ScopePermissionColumnEditorProps>;
} = ({ permission, scopes }) => {
    const { t } = useTranslation("types");

    const options = scopes
        .filter((s) => s !== ActionScope.None)
        .map((s) => ({
            label: t(`permissions.scope.${s}`),
            value: s,
        }));
    const scope = permission[1];

    if (scope === ActionScope.None) return null;

    return (
        <div className="flex align-items-center gap-3">
            <label htmlFor="chooseActionLevel">
                {t(`permissions.type.${permission[0]}`)}:
            </label>
            <SelectButton
                disabled
                className="chooseActionLevel"
                options={options}
                value={scope}
            />
        </div>
    );
};

const Editor: React.FC<ScopePermissionColumnEditorProps> = ({
    permission,
    scopes,
    options,
}) => {
    const { t } = useTranslation("types");

    const scopeOptions = scopes.map((s) => ({
        label: t(`permissions.scope.${s}`),
        value: s,
    }));
    const [scope, setScope] = useState<ActionScope>(ActionScope.None);

    useEffect(() => {
        const curr = options.value.find((p) => p.startsWith(permission));
        setScope(curr ? curr.replace(permission, "") : ActionScope.None);
    }, [options.value]);

    const handleChangeAction = (event: SelectButtonChangeEvent) => {
        const newScope: ActionScope = event.value || ActionScope.None;
        const newAction = `${permission}${newScope}` as Permission;

        if (newScope === ActionScope.None) {
            options.editorCallback!(
                options.value.filter((p) => !p.startsWith(permission))
            );
        } else {
            options.editorCallback!([
                ...options.value.filter((p) => !p.startsWith(permission)),
                newAction,
            ]);
        }

        setScope(newScope);
    };

    return (
        <div className="flex align-items-center gap-3">
            <label htmlFor="chooseActionLevel">
                {t(`permissions.type.${permission}`)}:
            </label>
            <SelectButton
                className="chooseActionLevel"
                options={scopeOptions}
                value={scope}
                onChange={handleChangeAction}
            />
        </div>
    );
};

ScopePermissionColumn.Editor = Editor;

export default ScopePermissionColumn;
