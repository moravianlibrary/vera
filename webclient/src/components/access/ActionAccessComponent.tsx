import React, { ReactNode } from "react";
import { ActionType } from "../../types/ActionType";
import { useAccess } from "../../contexts/AccessContext";
import { CurrentUser } from "../../adapters/ApiUsers";

interface ActionAccessComponentProps {
    action?: ActionType;
    evaluate?: (currentUser: CurrentUser) => boolean;
    children: ReactNode;
}

const ActionAccessComponent: React.FC<ActionAccessComponentProps> = ({
    action,
    evaluate,
    children,
}) => {
    const { currentUser, hasPermission } = useAccess();

    return (action &&
        evaluate &&
        currentUser &&
        evaluate(currentUser) &&
        hasPermission(action)) ||
        (action && hasPermission(action)) ||
        (evaluate && currentUser && evaluate(currentUser)) ? (
        <>{children}</>
    ) : null;
};

export default ActionAccessComponent;
