import React, {
    createContext,
    useContext,
    ReactNode,
    useRef,
    useEffect,
    useState,
} from "react";
import { ActionSeverity } from "../types/PrimeReactTypes";
import { Toast } from "primereact/toast";
import { useTranslation } from "react-i18next";
import { confirmDialog } from "primereact/confirmdialog";
import { useAccess } from "./AccessContext";
import { Dialog } from "primereact/dialog";
import Markdown from "react-markdown";
import { RENDERERS } from "../pages/Home";
import { Button } from "primereact/button";
import InternalLinkButton from "../components/buttons/InternalLinkButton";

interface NotificationContextProps {
    showToast: (
        severity: ActionSeverity,
        summary: string,
        detail?: string,
        life?: number,
        sticky?: boolean
    ) => void;
    showSuccess: (summary: string, detail?: string) => void;
    showFailure: (summary: string, detail?: string) => void;
    showInfo: (summary: string, detail?: string) => void;
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

const LATEST_VERSION_MD = `${process.env.PUBLIC_URL}/wiki/cs/Version_2024_11.md`;

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
    children,
}) => {
    const { t } = useTranslation("notifications");
    const toast = useRef(null);
    const { currentUser, getSettings, updateSettings } = useAccess();

    const [notificationContent, setNotificationContent] =
        useState<React.ReactNode | null>(null);

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

    const showFailure = (summary: string, detail: string = "") => {
        showToast("error", summary, detail);
    };

    const showInfo = (summary: string, detail: string = "") => {
        showToast("info", summary, detail);
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

    useEffect(() => {
        const loadVersionNotification = async () => {
            const response = await fetch(LATEST_VERSION_MD);
            const md = await response.text();
            setNotificationContent(
                <Markdown components={RENDERERS}>{md}</Markdown>
            );
        };

        if (currentUser && getSettings("newVersion") === true) {
            updateSettings("newVersion", false);
            loadVersionNotification();
        }
    }, [getSettings, updateSettings, currentUser]);

    const contextValue: NotificationContextProps = {
        showToast,
        showSuccess,
        showFailure,
        showInfo,
        showConfirmDialog,
        showConfirmDangerDialog,
    };

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
            {notificationContent && (
                <Dialog
                    visible={notificationContent !== null}
                    onHide={() => setNotificationContent(null)}
                    header={
                        <div className="flex justify-content-center align-items-center gap-2">
                            <span className="text-6xl">{t("new-version")}</span>
                            <div>
                                <img
                                    src={`${process.env.PUBLIC_URL}/partyy.png`}
                                    alt="Partyy"
                                />
                                <img
                                    src={`${process.env.PUBLIC_URL}/partyy.png`}
                                    alt="Partyy"
                                />
                            </div>
                        </div>
                    }
                    footer={
                        <div className="flex justify-content-start">
                            <Button
                                className="p-2 text-blue-600"
                                text
                                label={t("learn-more")}
                                icon="pi pi-external-link"
                                iconPos="right"
                                onClick={() => window.open("/")}
                            />
                        </div>
                    }
                >
                    {notificationContent}
                </Dialog>
            )}
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
