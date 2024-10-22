import React from "react";
import { Button, ButtonProps } from "primereact/button";
import { Badge } from "primereact/badge";

interface RequiredValuesButtonProps extends ButtonProps {
    requiredValues: any[];
}

const RequiredValuesButton: React.FC<RequiredValuesButtonProps> = ({
    requiredValues,
    ...props
}) => {
    const nullValues = requiredValues.filter(
        (v) => v === undefined || v === null
    ).length;

    if (nullValues === 0) {
        return (
            <div className="relative">
                <Badge
                    className="fadeout animation-duration-400 animation-fill-forwards"
                    value="1"
                    severity="warning"
                    style={{
                        position: "absolute",
                        top: "-10px",
                        left: "-10px",
                        zIndex: 10,
                    }}
                />
                <Button {...props}>{props.children}</Button>
            </div>
        );
    }

    return (
        <div className="relative">
            <Badge
                className="fadein animation-duration-400"
                value={nullValues}
                severity="warning"
                style={{
                    position: "absolute",
                    top: "-10px",
                    left: "-10px",
                    zIndex: 10,
                }}
            />
            <Button {...props} disabled>
                {props.children}
            </Button>
        </div>
    );
};

export default RequiredValuesButton;
