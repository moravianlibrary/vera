import React, { createContext, useContext, ReactNode, useRef } from "react";
import { ActionSeverity } from "../types/PrimeReactTypes";
import { Toast } from "primereact/toast";
import { useTranslation } from "react-i18next";
import { confirmDialog } from "primereact/confirmdialog";

interface NotificationContextProps {
    showToast: (
        severity: ActionSeverity,
        summary: string,
        detail?: string,
        life?: number,
        sticky?: boolean
    ) => void;
    showSuccess: (summary: string, detail?: string) => void;
    showConfirmDialog: (message: string, acceptCallback: () => void) => void;
    showConfirmDangerDialog: (
        message: string,
        acceptCallback: () => void
    ) => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(
    undefined
);

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
    children,
}) => {
    const { t } = useTranslation("notifications");
    const toast = useRef(null);

    const showToast = (
        severity: ActionSeverity,
        summary: string,
        detail: string = "",
        life = 5000,
        sticky = false
    ) => {
        if (!toast.current) return;
        (toast.current as Toast).show({
            severity: severity,
            summary: summary,
            detail: detail,
            life: life,
            sticky: sticky,
        });
    };

    const showSuccess = (summary: string, detail: string = "") => {
        showToast("success", summary, detail);
    };

    const showConfirmDialog = (message: string, acceptCallback: () => void) => {
        confirmDialog({
            message: message,
            header: t("confirm-action"),
            icon: "pi pi-question",
            acceptLabel: t("yes"),
            rejectLabel: t("no"),
            accept: acceptCallback,
        });
    };

    const showConfirmDangerDialog = (
        message: string,
        acceptCallback: () => void
    ) => {
        confirmDialog({
            message: message,
            header: t("confirm-danger-action"),
            icon: "pi pi-exclamation-triangle",
            acceptLabel: t("yes"),
            rejectLabel: t("no"),
            accept: acceptCallback,
        });
    };

    const contextValue: NotificationContextProps = {
        showToast,
        showSuccess,
        showConfirmDialog,
        showConfirmDangerDialog,
    };

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
            <Toast
                className="mt-6 max-w-screen w-auto"
                ref={toast}
                position="top-center"
            />
        </NotificationContext.Provider>
    );
};

export const useNotification = (): NotificationContextProps => {
    const context = useContext(NotificationContext);

    if (!context) {
        throw new Error(
            "useNotification must be used within a NotificationProvider"
        );
    }

    return context;
};
