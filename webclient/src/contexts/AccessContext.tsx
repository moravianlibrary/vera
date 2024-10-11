import React, { createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "./ToastContext";
import { ActionScope, ActionType } from "../types/ActionType";
import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak, { keycloakInitOptions } from "../services/Keycloak";
import ApiUsers, { CurrentUser } from "../adapters/ApiUsers";
import { BaseProviderProps } from "./BaseContext";

interface AccessContextProps {
    login: () => void;
    logout: () => void;
    fetchCurrentUser: () => Promise<void>;
    hasPermission: (action: ActionType) => boolean;
    currentUser: CurrentUser | undefined;
    getSettings: (name: string) => Object | null;
    updateSettings: (name: string, value: Object) => void;
}

const AccessContext = createContext<AccessContextProps | undefined>(undefined);

export const AccessProvider: React.FC<BaseProviderProps> = ({ children }) => {
    const api = new ApiUsers();

    const { t } = useTranslation();
    const showToast = useToast();
    const [currentUser, setCurrentUser] = useState<CurrentUser | undefined>(
        undefined
    );

    const login = () => {
        if (keycloak && !keycloak.authenticated) {
            keycloak.login();
        }
    };

    const logout = () => {
        if (keycloak && keycloak.authenticated) {
            keycloak.logout();
        }
    };

    const parseActions = (actions: ActionType[]): ActionType[] => {
        const parsedActions = actions;
        if (
            actions.some((action) =>
                [
                    ActionType.ReadDatatableAll,
                    ActionType.ReadDatatableDepartment,
                    ActionType.ReadDatatableOwn,
                ].includes(action)
            )
        ) {
            parsedActions.push(ActionType.ReadDatatable);
        }
        if (
            actions.some((action) =>
                [
                    ActionType.EditDatatableAll,
                    ActionType.EditDatatableDepartment,
                    ActionType.EditDatatableOwn,
                ].includes(action)
            )
        ) {
            parsedActions.push(ActionType.EditDatatable);
        }
        if (
            actions.some((action) =>
                [
                    ActionType.ReadCategoriesAll,
                    ActionType.ReadCategoriesDepartment,
                ].includes(action)
            )
        ) {
            parsedActions.push(ActionType.ReadCategories);
        }
        if (
            actions.some((action) =>
                [
                    ActionType.EditCategoriesAll,
                    ActionType.EditCategoriesDepartment,
                ].includes(action)
            )
        ) {
            parsedActions.push(ActionType.EditCategories);
        }
        return parsedActions;
    };

    const fetchCurrentUser = async () => {
        try {
            const user = await api.getCurrentUser();
            setCurrentUser({
                ...user.data,
                actions: parseActions(user.data.actions),
            });
        } catch (error) {
            setCurrentUser(undefined);
            if (error.response && error.response.status === 401) {
                if (error.response.data?.detail !== null) {
                    showToast("error", t(error.response.data.detail), "");
                }
            } else if (error.code === "ERR_NETWORK") {
                showToast("error", t("app_not_available"), "");
            }
        }
    };

    const handleKeycloakEvent = (eventType, error) => {
        if (eventType === "onReady" || eventType === "onAuthRefreshSuccess") {
            if (keycloak.authenticated && keycloak.token) {
                localStorage.setItem("token", keycloak.token);
                fetchCurrentUser();
            } else {
                localStorage.removeItem("token");
                setCurrentUser(undefined);
            }
        }
    };

    const hasPermission = (action: ActionType) => {
        return currentUser?.actions?.includes(action) || false;
    };

    const getSettings = (name: string) => {
        if (currentUser) {
            return currentUser.settings[name] || null;
        }
        return null;
    };

    const updateSettings = (name: string, value: Object) => {
        if (currentUser) {
            const currentSettings = currentUser.settings || {};
            api.setUserSettings({ ...currentSettings, [name]: value }).then(
                (response) => {
                    setCurrentUser({
                        ...response.data,
                        actions: parseActions(response.data.actions),
                    });
                }
            );
        }
    };

    const contextValue: AccessContextProps = {
        login,
        logout,
        fetchCurrentUser,
        hasPermission,
        currentUser,
        getSettings,
        updateSettings,
    };

    return (
        <ReactKeycloakProvider
            authClient={keycloak}
            initOptions={keycloakInitOptions}
            onEvent={handleKeycloakEvent}
        >
            <AccessContext.Provider value={contextValue}>
                {children}
            </AccessContext.Provider>
        </ReactKeycloakProvider>
    );
};

export const useAccess = () => {
    const context = useContext(AccessContext);
    if (!context) {
        throw new Error("useAccess must be used within a AccessProvider");
    }
    return context;
};
