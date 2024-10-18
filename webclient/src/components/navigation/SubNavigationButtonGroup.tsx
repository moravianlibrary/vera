import React from "react";
import { useLocation } from "react-router-dom";
import NavigationButton, { NavigationButtonProps } from "./NavigationButton";

interface SubNavigationButtonGroupProps {
    navigationButtons: NavigationButtonProps[];
}

const SubNavigationButtonGroup: React.FC<SubNavigationButtonGroupProps> = ({
    navigationButtons,
}) => {
    const location = useLocation();

    return (
        <div className="subnavigation-group">
            {navigationButtons.map((button) => (
                <NavigationButton
                    key={button.to}
                    {...button}
                    className={`${button.className ? button.className : ""}
                        ${location.pathname === button.to ? "active" : ""}`}
                />
            ))}
        </div>
    );
};

export default SubNavigationButtonGroup;
export type { SubNavigationButtonGroupProps };
