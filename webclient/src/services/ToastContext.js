import React, { createContext, useContext, useRef } from 'react';
import { Toast } from 'primereact/toast';

const ToastContext = createContext();

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }) {
    const toast = useRef(null);

    const showToast = (severity, summary, detail, life = 5000, sticky = false) => {
        if (!toast.current) {
            return;
        }
        toast.current.show({
            severity: severity,
            summary: summary,
            detail: detail,
            life: life,
            sticky: sticky
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
