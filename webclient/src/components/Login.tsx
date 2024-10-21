import React, { useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { useAccess } from "../contexts/AccessContext";
import { ActionType } from "../types/ActionType";
import DeveloperTools, { DeveloperToolsRef } from "./DeveloperTools";

interface LoginProps {}

const Login: React.FC<LoginProps> = () => {
    const { t } = useTranslation("navigation");
    const { currentUser, login, logout } = useAccess();
    // const [isLoggedIn, setIsLoggedIn] = useState(false);

    const developerToolsRef = useRef<DeveloperToolsRef | null>(null);

    // useEffect(() => {
    //     setIsLoggedIn(currentUser.isLoggedIn);
    // }, [currentUser.isLoggedIn]);

    if (!currentUser) {
        return (
            <div>
                <Button
                    className="text-gray-700"
                    text
                    label={t("login")}
                    onClick={login}
                />
            </div>
        );
    }

    const logoutButton = (
        <Button
            className="text-gray-700"
            text
            label={t("logout")}
            onClick={logout}
        />
    );

    const usernameElement = (
        <span className="text-gray-400 font-bold align-content-center">
            {currentUser.username}
        </span>
    );

    if (
        currentUser.actions &&
        (currentUser.actions.includes(ActionType.EditAccess) ||
            currentUser.actions.includes(ActionType.EmulateAccess))
    ) {
        return (
            <div className="flex gap-2">
                <DeveloperTools ref={developerToolsRef} />
                <Button
                    className="text-red-700 p-0"
                    text
                    icon="pi pi-wave-pulse"
                    size="large"
                    onClick={() => developerToolsRef.current?.toggle()}
                />
                <div className="flex">
                    {usernameElement}
                    {logoutButton}
                </div>
            </div>
        );
    }

    return (
        <div className="flex">
            {usernameElement}
            {logoutButton}
        </div>
    );
};

export default Login;
