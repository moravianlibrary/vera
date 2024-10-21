import React, { useEffect, useState } from "react";
import {
    ActionType,
    PermissionTypes,
    ScopePermissions,
    ValidScopesDispatcher,
} from "../../types/ActionType";
import { useTranslation } from "react-i18next";
import { useAccess } from "../../contexts/AccessContext";
import { Button } from "primereact/button";
import ScopePermissionColumn from "../../features/roles/ScopePermissionColumn";
import PermissionColumn from "../../features/roles/PermissionColumn";

interface EmulateActionsFormProps {
    onSubmit: (actions: ActionType[]) => void;
}

const EmulateActionsForm: React.FC<EmulateActionsFormProps> = ({
    onSubmit,
}) => {
    const { t } = useTranslation("app");
    const { currentUser } = useAccess();

    const [permissions, setPermissions] = useState<ActionType[]>(
        currentUser.actions
    );

    useEffect(() => {
        if (!currentUser) return;

        setPermissions(currentUser.actions);
    }, [currentUser]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(permissions.filter((p) => !ScopePermissions.includes(p)));
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-column w-max gap-2">
            {PermissionTypes.map((permission, index) => {
                return ScopePermissions.includes(permission) ? (
                    <ScopePermissionColumn.Editor
                        key={index}
                        permission={permission}
                        scopes={ValidScopesDispatcher(permission)}
                        permissions={permissions}
                        editorCallback={setPermissions}
                    />
                ) : (
                    <PermissionColumn.Editor
                        key={index}
                        permission={permission}
                        permissions={permissions}
                        editorCallback={setPermissions}
                    />
                );
            })}
            <Button label={t("submit")} type="submit" className="mt-3" />
        </form>
    );
};

export default EmulateActionsForm;
