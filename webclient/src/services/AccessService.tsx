import { Outlet } from "react-router-dom";
import { useToast } from "../contexts/toast/ToastContext";
import { useTranslation } from "react-i18next";
import { ReactNode, useEffect } from "react";
import { useUser } from "../contexts/user/UserContext";
import ApiUser from "../adapters/ApiUser";
import { ActionType } from "../types/ActionType";
import React from "react";
import { UserModel } from "../contexts/user/UserModel";

class AccessService {
    async getCurrentUser() {
        try {
            return (await ApiUser.getCurrentUser()).data;
        } catch (error) {
            console.error('Error loading current user:', error.message);
        }
        return null;
    }
    
    isAllowedTo(user, action) {
        return user?.actions.includes(action);
    }

    isAllowedToEditDocument(user, document) {
        return user && user.actions && (
                user.actions.includes(ActionType.EditDatatableAll)
                || (user.actions.includes(ActionType.EditDatatableDepartment)
                    && user.department_id === document.creator_department_id)
                || (user.actions.includes(ActionType.EditDatatableOwn)
                    && user.id === document.creator_id));
    }
};

export const ActionAccessRoute = ({ action = null }) => {
    const { user } = useUser();

    return !action || (user?.actions && user.actions.includes(action))
        ? <Outlet />
        // : <Navigate to="/unauthorized" replace />;
        : null;
};


interface ActionAccessComponentProps {
    action?: ActionType;
    evaluate?: (user: UserModel) => boolean;
    children: ReactNode;
}

export const ActionAccessComponent: React.FC<ActionAccessComponentProps> = (props) => {
    const { action, evaluate, children } = props;
    const { user } = useUser();

    if (!user) {
        return null;
    }

    if (action && user.actions?.includes(action)) {
        return <>{children}</>;
    }
    if (evaluate && evaluate(user)) {
        return <>{children}</>;
    }

    return null;

};

export const accessService = new AccessService();
