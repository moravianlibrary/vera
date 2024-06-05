import React, { useEffect, useState } from "react";
import { ActionType } from "../../types/ActionType";
import { SelectButton } from "primereact/selectbutton";
import { useTranslation } from "react-i18next";
import { useUser } from "../../contexts/user/UserContext";
import {
    OwnershipActionType,
    OwnershipType,
    RoleActions,
} from "../../data/RoleAction";
import { Checkbox } from "primereact/checkbox";
import { Divider } from "primereact/divider";
import { Button } from "primereact/button";
import RoleFactory from "../../data/factories/RoleFactory";

interface EmulateActionsFormProps {
    onSubmit: (actions: ActionType[]) => void;
}

const EmulateActionsForm: React.FC<EmulateActionsFormProps> = ({
    onSubmit,
}) => {
    const { t } = useTranslation();
    const { user } = useUser();

    const [readDatatableAction, setReadDatatableAction] =
        useState<OwnershipActionType | null>(null);
    const [editDatatableAction, setEditDatatableAction] =
        useState<OwnershipActionType | null>(null);
    const [readCategoriesAction, setReadCategoriesAction] =
        useState<OwnershipActionType | null>(null);
    const [editCategoriesAction, setEditCategoriesAction] =
        useState<OwnershipActionType | null>(null);
    const [simpleActions, setSimpleActions] = useState<
        { action: ActionType; included: boolean }[]
    >([]);

    useEffect(() => {
        const roleActions = new RoleActions(user.actions || []);
        setReadDatatableAction(roleActions.readDatatable);
        setEditDatatableAction(roleActions.editDatatable);
        setReadCategoriesAction(roleActions.readCategories);
        setEditCategoriesAction(roleActions.editCategories);

        setSimpleActions(
            [
                ActionType.InsertDatatable,
                ActionType.WriteDatatable,
                ActionType.CommentOnDatatable,
                ActionType.PlanTasks,
                ActionType.AdminTasks,
                ActionType.EditAccess,
                ActionType.Extract,
                ActionType.AdminExtractions,
                ActionType.AdminDatabase,
            ].map((action) => {
                return {
                    action: action,
                    included: user.actions && user.actions.includes(action),
                };
            }) as { action: ActionType; included: boolean }[]
        );
    }, [user]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const actions = simpleActions
            .filter((action) => action.included)
            .map((action) => action.action);
        let action =
            RoleFactory.parseReadDatatableOwnershipAction(readDatatableAction);
        if (action !== null) {
            actions.push(action);
        }
        action =
            RoleFactory.parseEditDatatableOwnershipAction(editDatatableAction);
        if (action !== null) {
            actions.push(action);
        }
        action =
            RoleFactory.parseReadCategoriesOwnershipAction(
                readCategoriesAction
            );
        if (action !== null) {
            actions.push(action);
        }
        action =
            RoleFactory.parseEditCategoriesOwnershipAction(
                editCategoriesAction
            );
        if (action !== null) {
            actions.push(action);
        }
        onSubmit(actions);
    };

    const changeSimpleAction = (action: ActionType, included: boolean) => {
        setSimpleActions(
            simpleActions.map((simpleAction) =>
                simpleAction.action === action
                    ? { action: action, included: included }
                    : simpleAction
            )
        );
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-column w-max gap-2">
            <ReadDatatableAction
                action={readDatatableAction}
                onChange={setReadDatatableAction}
            />
            <EditDatatableAction
                action={editDatatableAction}
                onChange={setEditDatatableAction}
            />
            <ReadCategoriesAction
                action={readCategoriesAction}
                onChange={setReadCategoriesAction}
            />
            <EditCategoriesAction
                action={editCategoriesAction}
                onChange={setEditCategoriesAction}
            />
            {simpleActions.map((action) => (
                <div className="flex flex-column">
                    <Divider className="my-3" />
                    <SimpleAction
                        key={action.action}
                        action={action.action}
                        included={action.included}
                        onChange={(included) =>
                            changeSimpleAction(action.action, included)
                        }
                    />
                </div>
            ))}
            <Button label={t("Apply")} type="submit" className="mt-3" />
        </form>
    );
};

interface SimpleActionProps {
    action: ActionType;
    included: boolean;
    onChange: (included: boolean) => void;
}

const SimpleAction: React.FC<SimpleActionProps> = ({
    action,
    included,
    onChange,
}) => {
    const { t } = useTranslation();

    return (
        <div
            className="flex align-items-center gap-3 justify-content-between"
            style={{ cursor: "pointer" }}
            onClick={() => onChange(!included)}
        >
            <label htmlFor="chooseActionLevel">{t(action)}</label>
            <Checkbox checked={included} onChange={() => onChange(!included)} />
        </div>
    );
};

interface OwnershipActionProps {
    action: OwnershipActionType | null;
    onChange: (action: OwnershipActionType | null) => void;
}

const ReadDatatableAction: React.FC<OwnershipActionProps> = ({
    action,
    onChange,
}) => {
    const { t } = useTranslation();
    return (
        <OwnershipBasedAction
            actionLabel={t("Allowed to read documents")}
            options={[
                {
                    actionType: [ActionType.ReadDatatable, OwnershipType.Own],
                    label: t("Own"),
                },
                {
                    actionType: [
                        ActionType.ReadDatatable,
                        OwnershipType.Department,
                    ],
                    label: t("Department's"),
                },
                {
                    actionType: [ActionType.ReadDatatable, OwnershipType.All],
                    label: t("All"),
                },
            ]}
            action={action}
            onChange={onChange}
        />
    );
};

const EditDatatableAction: React.FC<OwnershipActionProps> = ({
    action,
    onChange,
}) => {
    const { t } = useTranslation();
    return (
        <OwnershipBasedAction
            actionLabel={t("Allowed to edit documents")}
            options={[
                {
                    actionType: [ActionType.EditDatatable, OwnershipType.Own],
                    label: t("Own"),
                },
                {
                    actionType: [
                        ActionType.EditDatatable,
                        OwnershipType.Department,
                    ],
                    label: t("Department's"),
                },
                {
                    actionType: [ActionType.EditDatatable, OwnershipType.All],
                    label: t("All"),
                },
            ]}
            action={action}
            onChange={onChange}
        />
    );
};

const ReadCategoriesAction: React.FC<OwnershipActionProps> = ({
    action,
    onChange,
}) => {
    const { t } = useTranslation();
    return (
        <OwnershipBasedAction
            actionLabel={t("Allowed to read categories")}
            options={[
                {
                    actionType: [
                        ActionType.ReadCategories,
                        OwnershipType.Department,
                    ],
                    label: t("Department's"),
                },
                {
                    actionType: [ActionType.ReadCategories, OwnershipType.All],
                    label: t("All"),
                },
            ]}
            action={action}
            onChange={onChange}
        />
    );
};

const EditCategoriesAction: React.FC<OwnershipActionProps> = ({
    action,
    onChange,
}) => {
    const { t } = useTranslation();
    return (
        <OwnershipBasedAction
            actionLabel={t("Allowed to edit categories")}
            options={[
                {
                    actionType: [
                        ActionType.EditCategories,
                        OwnershipType.Department,
                    ],
                    label: t("Department's"),
                },
                {
                    actionType: [ActionType.EditCategories, OwnershipType.All],
                    label: t("All"),
                },
            ]}
            action={action}
            onChange={onChange}
        />
    );
};

interface OwnershipBasedActionProps {
    actionLabel: string;
    options: { actionType: OwnershipActionType; label: string }[];
    action: OwnershipActionType | null;
    onChange: (action: OwnershipActionType | null) => void;
}

const OwnershipBasedAction: React.FC<OwnershipBasedActionProps> = ({
    actionLabel,
    options,
    action,
    onChange,
}) => {
    const { t } = useTranslation();

    useEffect(() => {
        console.log(action);
    }, [action]);

    return (
        <div className="flex align-items-center gap-3 justify-content-between">
            <label htmlFor="chooseActionLevel">{t(actionLabel)}:</label>
            <SelectButton
                className="chooseActionLevel"
                options={options}
                optionValue="actionType"
                value={action}
                onChange={(e) => onChange(e.value)}
            />
        </div>
    );
};

export default EmulateActionsForm;
