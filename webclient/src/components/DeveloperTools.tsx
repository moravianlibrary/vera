import { Sidebar } from "primereact/sidebar";
import React, { forwardRef, useImperativeHandle, useState } from "react";
import EmulateActionsForm from "./forms/EmulateActionsForm";
import { ActionType } from "../types/ActionType";
import ApiUsers from "../adapters/ApiUsers";
import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { useAccess } from "../contexts/AccessContext";

interface DeveloperToolsProps {}

interface DeveloperToolsRef {
    toggle: () => void;
}

const DeveloperTools: React.ForwardRefRenderFunction<
    unknown,
    DeveloperToolsProps
> = ({}, ref) => {
    const [visible, setVisible] = useState(false);

    useImperativeHandle(
        ref,
        () => ({
            toggle() {
                setVisible(!visible);
            },
        }),
        [visible]
    );

    return (
        <Sidebar
            className="w-min"
            visible={visible}
            onHide={() => setVisible(false)}
            position="right"
        >
            <div className="flex flex-column gap-3">
                <span className="font-bold text-xl">Developer tools</span>
                <DeveloperAccessEmulation />
            </div>
        </Sidebar>
    );
};

interface DeveloperAccessEmulationProps {}

const DeveloperAccessEmulation: React.FC<
    DeveloperAccessEmulationProps
> = () => {
    const api = new ApiUsers();

    const { t } = useTranslation();
    const { fetchCurrentUser, hasPermission } = useAccess();

    const handleSubmitEmulate = (actions: ActionType[]) => {
        api.emulateAccess(actions).then((response) => fetchCurrentUser());
    };

    const handleStopAccessEmulation = () => {
        api.endAccessEmulation().then((response) => fetchCurrentUser());
    };

    return (
        <div className="flex flex-column gap-2">
            <span className="font-bold text-lg">
                Developer access emulation
            </span>
            <EmulateActionsForm onSubmit={handleSubmitEmulate} />
            <Button
                label={t("Stop access emulation")}
                disabled={hasPermission(ActionType.StopEmulatingAccess)}
                onClick={handleStopAccessEmulation}
            />
        </div>
    );
};

export default forwardRef(DeveloperTools);
export type { DeveloperToolsRef };
