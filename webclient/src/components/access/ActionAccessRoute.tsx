import React from "react";
import { Outlet } from "react-router-dom";
import { useAccess } from "../../contexts/AccessContext";
import { ActionType } from "../../types/ActionType";

interface ActionAccessRouteProps {
    action: ActionType;
}

const ActionAccessRoute: React.FC<ActionAccessRouteProps> = ({ action }) => {
    const { hasPermission } = useAccess();

    return hasPermission(action) ? (
        <Outlet />
    ) : // : <Navigate to="/unauthorized" replace />;
    null;
};

export default ActionAccessRoute;
