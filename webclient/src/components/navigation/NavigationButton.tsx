import React from "react";
import { ActionType } from "../../types/ActionType";
import ActionAccessComponent from "../access/ActionAccessComponent";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";

interface NavigationButtonProps {
    label: string;
    icon?: string;
    to: string;
    action?: ActionType;
    className?: string;
}

const NavigationButton: React.FC<NavigationButtonProps> = ({
    label,
    icon,
    to,
    action,
    className,
}) => {
    const navigate = useNavigate();

    const buttonProps = {
        className: `navigation-button ${className}`,
        label,
        icon,
        text: true,
        onClick: () => navigate(to),
    };

    return action ? (
        <ActionAccessComponent action={action}>
            <Button {...buttonProps} />
        </ActionAccessComponent>
    ) : (
        <Button {...buttonProps} />
    );
};

export default NavigationButton;
export type { NavigationButtonProps };
