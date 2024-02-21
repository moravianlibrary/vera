import React, { useEffect, useState } from "react";
import { LabeledAction } from "./RolesTable";
import { useTranslation } from "react-i18next";
import { RoleModel } from "../../contexts/user/RoleModel";
import { SelectButton, SelectButtonChangeEvent } from "primereact/selectbutton";
import { ColumnEditorOptions } from "primereact/column";

interface ActionGroupColumnProps {
    role: RoleModel;
    actions: LabeledAction[];
    label: string;
}

interface ActionGroupColumnEditorProps {
    options: ColumnEditorOptions;
    actions: LabeledAction[];
    label: string;
}

const ActionGroupColumn: React.FC<ActionGroupColumnProps> = ({ role, actions, label }) => {
    const { t } = useTranslation();

    const [selected, setSelected] = useState<LabeledAction | null>(null);

    useEffect(() => {
        const maxIndex = Math.max(...(actions.map((action, index) => role.actions.includes(action.action) ? index : -1)));
        setSelected(maxIndex >= 0 ? actions[maxIndex] : null);
    }, [role.actions]);

    return (
        <div className="flex align-items-center gap-3">
            <label htmlFor="chooseActionLevel" >{t(label)}:</label>
            <SelectButton
                disabled
                className="chooseActionLevel"
                options={actions}
                value={selected}
            />
        </div>
    );
};

export const ActionGroupColumnEditor: React.FC<ActionGroupColumnEditorProps> = ({ options, actions, label }) => {
    const { t } = useTranslation();

    const [selected, setSelected] = useState<LabeledAction | null>(null);
    const actionTypes = actions.map(action => action.action);

    useEffect(() => {
        const maxIndex = Math.max(...(actions.map((action, index) => options.value.includes(action.action) ? index : -1)));
        setSelected(maxIndex >= 0 ? actions[maxIndex] : null);
    }, [options.value]);

    const handleChangeAction = (event: SelectButtonChangeEvent) => {
        const labeledAction: LabeledAction | null = event.value;

        if (selected !== null) {
            options.editorCallback!(options.value.filter(action => !actionTypes.includes(action)));
        }
        if (labeledAction !== null && !options.value.includes(labeledAction.action)) {
            options.editorCallback!([...options.value, event.value.action]);
        }
    
        setSelected(labeledAction);
    }

    return (
        <div className="flex align-items-center gap-3">
            <label htmlFor="chooseActionLevel" >{t(label)}:</label>
            <SelectButton
                className="chooseActionLevel"
                options={actions}
                value={selected}
                onChange={handleChangeAction}
            />
        </div>
    );
};

export default ActionGroupColumn;
