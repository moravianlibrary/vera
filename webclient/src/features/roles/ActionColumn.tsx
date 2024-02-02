import React, { useEffect, useState } from "react";
import { LabeledAction } from "./RolesTable";
import { useTranslation } from "react-i18next";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { RoleModel } from "../../contexts/user/RoleModel";
import { Card } from "primereact/card";

interface ActionColumnProps {
    role: RoleModel;
    action: LabeledAction;
    disabled?: boolean;
}

const ActionColumn: React.FC<ActionColumnProps> = ({ role, action, disabled }) => {
    const { t } = useTranslation();

    const [checked, setChecked] = useState(false);

    const handleChangeAction = (event: CheckboxChangeEvent) => {
        if (event.checked) {
            role.addAction(event.value);
        } else {
            role.removeAction(event.value);
        }
        setChecked(event.checked ? event.checked : false);
    };

    useEffect(() => {
        setChecked(role.actions.includes(action.action));
    }, [role]);

    return (
        <div>
            <Checkbox
                disabled={disabled}
                value={action.action!}
                onChange={handleChangeAction}
                checked={checked}
            />
            <label className="ml-2">{t(action.label)}</label>
        </div>
    );
};

export default ActionColumn;
