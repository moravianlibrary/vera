import React, { useEffect, useState } from "react";
import { LabeledAction } from "./RolesTable";
import { useTranslation } from "react-i18next";
import { RoleModel } from "../../contexts/user/RoleModel";
import { SelectButton, SelectButtonChangeEvent } from "primereact/selectbutton";

interface ActionGroupColumnProps {
    role: RoleModel;
    actions: LabeledAction[];
    label: string;
    disabled?: boolean;
}

const ActionGroupColumn: React.FC<ActionGroupColumnProps> = ({ role, actions, label, disabled }) => {
    const { t } = useTranslation();

    const [selected, setSelected] = useState<LabeledAction | null>(null);

    const handleSelect = (event: SelectButtonChangeEvent) => {
        const labeledAction: LabeledAction | null = event.value;

        if (selected !== null) {
            role.removeAction(selected.action);
        }
        if (labeledAction !== null) {
            role.addAction(labeledAction.action);
        }
    
        setSelected(labeledAction);
    }

    useEffect(() => {
        const maxIndex = Math.max(...(actions
            .map((action, index) => role.actions.includes(action.action) ? index : -1)));
        if (maxIndex >= 0) {
            setSelected(actions[maxIndex]);
        }
    }, [role.actions]);

    return (
        <div className="flex align-items-center gap-3">
            <label htmlFor="chooseActionLevel" >{t(label)}:</label>
            <SelectButton
                disabled={disabled}
                className="chooseActionLevel"
                options={actions}
                value={selected}
                onChange={handleSelect}
            />
        </div>
    );
};

export default ActionGroupColumn;
