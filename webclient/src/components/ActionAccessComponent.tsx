import React, { ReactNode } from "react";
import { UserModel } from "../contexts/user/UserModel";
import { ActionType } from "../types/ActionType";
import { useUser } from "../contexts/user/UserContext";

interface ActionAccessComponentProps {
    action?: ActionType;
    evaluate?: (user: UserModel) => boolean;
    children: ReactNode;
}

const ActionAccessComponent: React.FC<ActionAccessComponentProps> = ({
    action,
    evaluate,
    children,
}) => {
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

export default ActionAccessComponent;
