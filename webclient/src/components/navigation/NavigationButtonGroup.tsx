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
        <div className="navigation-group">
            {navigationButtons.map((button) => (
                <NavigationButton
                    key={button.to}
                    {...button}
                    className={`${button.className ? button.className : ""}
                        ${
                            button.to !== "/" &&
                            location.pathname.startsWith(
                                button.to.match(/(\/[^/]+)/)[1]
                            )
                                ? "active"
                                : ""
                        }`}
                />
            ))}
        </div>
    );
};

export default NavigationButtonGroup;
export type { NavigationButtonGroupProps };
