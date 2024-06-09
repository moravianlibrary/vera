import { Sidebar } from "primereact/sidebar";
import React, { forwardRef, useImperativeHandle, useState } from "react";
import EmulateActionsForm from "./forms/EmulateActionsForm";
import { ActionType } from "../types/ActionType";
import ApiUser from "../adapters/ApiUser";
import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { useUser } from "../contexts/user/UserContext";

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
    const { t } = useTranslation();
    const { user, setUserData } = useUser();

    const handleSubmitEmulate = (actions: ActionType[]) => {
        ApiUser.emulateAccess(actions).then((response) => {
            console.log(response.data);

            setUserData(response.data);
        });
    };

    const handleStopAccessEmulation = () => {
        ApiUser.endAccessEmulation().then((response) =>
            setUserData(response.data)
        );
    };

    return (
        <div className="flex flex-column gap-2">
            <span className="font-bold text-lg">
                Developer access emulation
            </span>
            <EmulateActionsForm onSubmit={handleSubmitEmulate} />
            <Button
                label={t("Stop access emulation")}
                disabled={
                    !user.actions?.includes(ActionType.StopEmulatingAccess)
                }
                onClick={handleStopAccessEmulation}
            />
        </div>
    );
};

export default forwardRef(DeveloperTools);
export type { DeveloperToolsRef };
