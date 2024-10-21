import React from "react";
import { useTranslation } from "react-i18next";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { ColumnEditorOptions } from "primereact/column";
import { ActionType, SimplePermission } from "../../types/ActionType";

interface PermissionColumnProps {
    permission: SimplePermission;
}

interface PermissionColumnEditorProps {
    permission: SimplePermission;
    permissions: ActionType[];
    editorCallback: (permissions: ActionType[]) => void;
}

const PermissionColumn: React.FC<PermissionColumnProps> & {
    Editor: React.FC<PermissionColumnEditorProps>;
} = ({ permission }) => {
    const { t } = useTranslation("types");

    return (
        <div>
            <Checkbox disabled checked={true} />
            <label className="ml-2">
                {t(`permissions.type.${permission}`)}
            </label>
        </div>
    );
};

const Editor: React.FC<PermissionColumnEditorProps> = ({
    permission,
    permissions,
    editorCallback,
}) => {
    const { t } = useTranslation("types");
    const handleChangePermission = (event: CheckboxChangeEvent) => {
        if (event.checked) {
            editorCallback([...permissions, event.value]);
        } else {
            editorCallback(
                permissions.filter((action) => action !== event.value)
            );
        }
    };

    return (
        <div>
            <Checkbox
                value={permission}
                onChange={handleChangePermission}
                checked={permissions.includes(permission)}
            />
            <label className="ml-2">
                {t(`permissions.type.${permission}`)}
            </label>
        </div>
    );
};

PermissionColumn.Editor = Editor;

export default PermissionColumn;
