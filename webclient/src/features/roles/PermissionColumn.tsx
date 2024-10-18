import React from "react";
import { useTranslation } from "react-i18next";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { ColumnEditorOptions } from "primereact/column";
import { SimplePermission } from "../../types/ActionType";

interface PermissionColumnProps {
    permission: SimplePermission;
}

interface PermissionColumnEditorProps {
    options: ColumnEditorOptions;
    permission: SimplePermission;
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
    options,
    permission,
}) => {
    const { t } = useTranslation("types");

    const handleChangePermission = (event: CheckboxChangeEvent) => {
        if (event.checked) {
            options.editorCallback!([...options.value, event.value]);
        } else {
            options.editorCallback!(
                options.value.filter((action) => action !== event.value)
            );
        }
    };

    return (
        <div>
            <Checkbox
                value={permission}
                onChange={handleChangePermission}
                checked={options.value.includes(permission)}
            />
            <label className="ml-2">
                {t(`permissions.type.${permission}`)}
            </label>
        </div>
    );
};

PermissionColumn.Editor = Editor;

export default PermissionColumn;
