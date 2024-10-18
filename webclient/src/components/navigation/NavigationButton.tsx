import React, { startTransition } from "react";
import { ActionType } from "../../types/ActionType";
import ActionAccessComponent from "../access/ActionAccessComponent";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";

interface NavigationButtonProps {
    label?: string;
    icon?: string;
    to: string;
    action?: ActionType;
    className?: string;
    imageSource?: string;
}

const NavigationButton: React.FC<NavigationButtonProps> = ({
    to,
    action,
    imageSource,
    className,
    ...rest
}) => {
    const navigate = useNavigate();

    const getButton = () => {
        return imageSource ? (
            <Button
                className={`image-button ${className}`}
                onClick={(e) => startTransition(() => navigate(to))}
                {...rest}
                text
            >
                <img src={imageSource} />
            </Button>
        ) : (
            <Button
                className={`button ${className}`}
                onClick={(e) => startTransition(() => navigate(to))}
                {...rest}
                text
            />
        );
    };

    return action ? (
        <ActionAccessComponent action={action}>
            {getButton()}
        </ActionAccessComponent>
    ) : (
        getButton()
    );
};

export default NavigationButton;
export type { NavigationButtonProps };
