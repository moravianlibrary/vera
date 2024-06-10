import React, { useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { useUser } from "../contexts/user/UserContext";
import { ActionType } from "../types/ActionType";
import DeveloperTools, { DeveloperToolsRef } from "./DeveloperTools";

interface LoginProps {}

const Login: React.FC<LoginProps> = () => {
    const { t } = useTranslation();
    const { user, login, logout } = useUser();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const developerToolsRef = useRef<DeveloperToolsRef | null>(null);

    useEffect(() => {
        setIsLoggedIn(user.isLoggedIn);
    }, [user.isLoggedIn]);

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
            {user.username}
        </span>
    );

    if (
        isLoggedIn &&
        user.actions &&
        (user.actions.includes(ActionType.EditAccess) ||
            user.actions.includes(ActionType.StopEmulatingAccess))
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

    if (isLoggedIn) {
        return (
            <div className="flex">
                {usernameElement}
                {logoutButton}
            </div>
        );
    }

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
};

export default Login;
