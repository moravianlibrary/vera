import React, { useRef, useState } from "react";
import { Badge } from "primereact/badge";

interface RequiredValueBadgeProps {
    children: React.ReactNode;
    isValueSelected: boolean;
    infoMessage: string;
}

const RequiredValueBadge: React.FC<RequiredValueBadgeProps> = ({
    children,
    isValueSelected,
    infoMessage,
}) => {
    if (isValueSelected) {
        return (
            <div className="flex gap-1">
                {children}
                <Badge
                    className="fadeout animation-duration-400 animation-fill-forwards"
                    value={`<- ${infoMessage}`}
                    severity="warning"
                />
            </div>
        );
    }

    return (
        <div className="flex gap-1">
            {children}
            <Badge
                className="fadein animation-duration-400"
                value={`<- ${infoMessage}`}
                severity="warning"
            />
        </div>
    );
};

export default RequiredValueBadge;
