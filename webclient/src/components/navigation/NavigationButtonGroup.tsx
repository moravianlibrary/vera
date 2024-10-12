import React from "react";
import { useLocation } from "react-router-dom";
import NavigationButton, { NavigationButtonProps } from "./NavigationButton";

interface NavigationButtonGroupProps {
    navigationButtons: NavigationButtonProps[];
}

const NavigationButtonGroup: React.FC<NavigationButtonGroupProps> = ({
    navigationButtons,
}) => {
    const location = useLocation();

    return (
        <div className="navigation-button-group">
            {navigationButtons.map((button) => (
                <NavigationButton
                    key={button.to}
                    className={location.pathname === button.to ? "active" : ""}
                    label={button.label}
                    to={button.to}
                    action={button.action}
                />
            ))}
        </div>
    );
};

export default NavigationButtonGroup;
export type { NavigationButtonGroupProps };
