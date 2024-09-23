import React, { createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "./toast/ToastContext";
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

    const fetchCurrentUser = async () => {
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

    const contextValue: AccessContextProps = {
        login,
        logout,
        fetchCurrentUser,
        hasPermission,
        currentUser,
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
