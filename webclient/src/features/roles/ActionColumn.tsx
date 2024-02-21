import React, { useEffect, useState } from "react";
import { LabeledAction } from "./RolesTable";
import { useTranslation } from "react-i18next";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { RoleModel } from "../../contexts/user/RoleModel";
import { ColumnEditorOptions } from "primereact/column";

interface ActionColumnProps {
    role: RoleModel;
    action: LabeledAction;
}

interface ActionColumnEditorProps {
    options: ColumnEditorOptions;
    action: LabeledAction;
}

const ActionColumn: React.FC<ActionColumnProps> = ({ role, action }) => {
    const { t } = useTranslation();

    return (
        <div>
            <Checkbox
                disabled
                checked={role.actions.includes(action.action)}
            />
            <label className="ml-2">{t(action.label)}</label>
        </div>
    );
};

export const ActionColumnEditor: React.FC<ActionColumnEditorProps> = ({ options, action }) => {
    const { t } = useTranslation();


    const handleChangeAction = (event: CheckboxChangeEvent) => {
        if (event.checked) {
            options.editorCallback!([...options.value, event.value]);
        } else {
            options.editorCallback!(options.value.filter(action => action !== event.value));
        }
    };

    return (
        <div>
            <Checkbox
                value={action.action!}
                onChange={handleChangeAction}
                checked={options.value.includes(action.action!)}
            />
            <label className="ml-2">{t(action.label)}</label>
        </div>
    );
};

export default ActionColumn;
