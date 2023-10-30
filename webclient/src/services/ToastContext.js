import React, { createContext, useContext, useRef } from 'react';
import { Toast } from 'primereact/toast';

const ToastContext = createContext();

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }) {
    const toast = useRef(null);

    const showToast = (severity, summary, detail) => {
        console.log(toast);
        if (!toast.current) {
            return;
        }
        toast.current.show({ severity, summary, detail });
    };

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <Toast position="top-center" ref={toast} />
        </ToastContext.Provider>
    );
}
