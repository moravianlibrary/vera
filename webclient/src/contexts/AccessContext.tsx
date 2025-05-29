import React, { createContext, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionType } from "../types/ActionType";
import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak, { keycloakInitOptions } from "../adapters/Keycloak";
import ApiUsers, { CurrentUser } from "../adapters/ApiUsers";
import { BaseProviderProps } from "./BaseContext";
import { Category } from "../adapters/ApiCategories";
import { IndexDocument } from "../adapters/ApiDocuments";
import { DigitizationList } from "../adapters/ApiDigitizationLists";
import { Extraction } from "../adapters/ApiExtractions";
import { Task } from "../adapters/ApiTasks";
import { useNotification } from "./NotificationContext";
import { Toast } from "primereact/toast";

type OwnedItem =
    | Category
    | IndexDocument
    | DigitizationList
    | Extraction
    | Task;

export enum OwnedItemType {
    IndexDocument,
    Category,
    DigitizationList,
    Extraction,
    Task,
}

interface AccessContextProps {
    login: () => void;
    logout: () => void;
    fetchCurrentUser: () => Promise<void>;
    hasPermission: (action: ActionType) => boolean;
    hasOwnerPermission: (
        action: ActionType,
        itemType: OwnedItemType,
        item: OwnedItem
    ) => boolean;
    currentUser: CurrentUser | undefined;
    getSettings: (name: string) => Object | null;
    updateSettings: (name: string, value: Object) => void;
}

const AccessContext = createContext<AccessContextProps | undefined>(undefined);

export const AccessProvider: React.FC<BaseProviderProps> = ({ children }) => {
    const api = new ApiUsers();

    const { t } = useTranslation("app");
    const [currentUser, setCurrentUser] = useState<CurrentUser | undefined>(
        undefined
    );
    const toast = useRef<Toast>(null);

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
                    (toast.current as Toast).show({
                        severity: "error",
                        summary: t(error.response.data.detail),
                        life: 5000,
                        sticky: false,
                    });
                }
            } else if (error.code === "ERR_NETWORK") {
                (toast.current as Toast).show({
                    severity: "error",
                    summary: t("app-not-available"),
                    life: 5000,
                    sticky: false,
                });
            }
        }
    };

    const handleKeycloakEvent = (eventType, error) => {
        console.info("Keycloak event:", eventType, error);
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

    const hasOwnerPermission = (
        action: ActionType,
        itemType: OwnedItemType,
        item: OwnedItem
    ) => {
        if (!hasPermission(action) || !currentUser) return false;

        switch (itemType) {
            case OwnedItemType.Category:
                return (
                    currentUser.department_id !== null &&
                    (item as Category).departments.includes(
                        currentUser.department_id
                    )
                );
            case OwnedItemType.IndexDocument:
                // TODO: fix
                // return currentUser?.department_id && item.department_id === currentUser.department_id;
                return (
                    currentUser.username === (item as IndexDocument).added_by
                );
            case OwnedItemType.DigitizationList:
                return (
                    currentUser.username ===
                    (item as DigitizationList).created_by
                );
            case OwnedItemType.Extraction:
                return (
                    currentUser.username === (item as Extraction).generated_by
                );
            case OwnedItemType.Task:
                return currentUser.username === (item as Task).owner;
            default:
                throw new Error(
                    "Unsupported item type for owner permission check"
                );
        }
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
        hasOwnerPermission,
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
                <Toast
                    className="mt-6 max-w-screen w-auto"
                    ref={toast}
                    position="top-center"
                />
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
