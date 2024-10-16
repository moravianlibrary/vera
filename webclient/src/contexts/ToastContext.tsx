import React, { ReactNode, createContext, useContext, useRef } from "react";
import { Toast } from "primereact/toast";
import { ActionSeverity } from "../types/PrimeReactTypes";
import { useTranslation } from "react-i18next";

interface ToastContextProps {
    (
        severity: ActionSeverity,
        summary: string,
        detail?: string,
        life?: number,
        sticky?: boolean
    ): void;
}

const ToastContext = createContext<ToastContextProps>(() => {});

export function useToast(): ToastContextProps {
    return useContext(ToastContext);
}

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): JSX.Element {
    const { t } = useTranslation();
    const toast = useRef(null);

    const showToast = (
        severity: ActionSeverity,
        summary: string,
        detail: string = "",
        life = 5000,
        sticky = false
    ) => {
        if (!toast.current) {
            return;
        }
        (toast.current as Toast).show({
            severity: severity,
            summary: summary,
            detail: detail,
            life: life,
            sticky: sticky,
        });
    };

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <Toast
                className="mt-6 max-w-screen w-auto"
                ref={toast}
                position="top-center"
            />
        </ToastContext.Provider>
    );
}
