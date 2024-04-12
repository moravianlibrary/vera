import React, { ReactNode, createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../toast/ToastContext";
import { useUser } from "../user/UserContext";
import { GeneratedExtraction } from "../../adapters/ApiGeneratedExtractions";
import { ActionType } from "../../types/ActionType";

interface AccessContextProps {
    canDeleteExtraction: (extraction: GeneratedExtraction) => boolean;
}

const AccessContext = createContext<AccessContextProps | undefined>(undefined);

interface AccessProviderProps {
    children: ReactNode;
}

export const AccessProvider: React.FC<AccessProviderProps> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { user } = useUser();

    const canDeleteExtraction = (extraction: GeneratedExtraction) => {
        const userActions = user.actions || [];
        return (
            (extraction.generated_by === user.username &&
                userActions.includes(ActionType.Extract)) ||
            userActions.includes(ActionType.AdminExtractions)
        );
    };

    const contextValue: AccessContextProps = {
        canDeleteExtraction,
    };

    return (
        <AccessContext.Provider value={contextValue}>
            {children}
        </AccessContext.Provider>
    );
};

export const useAccess = () => {
    const context = useContext(AccessContext);
    if (!context) {
        throw new Error("useAccess must be used within a AccessProvider");
    }
    return context;
};
