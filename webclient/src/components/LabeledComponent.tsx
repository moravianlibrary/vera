import { classNames } from "primereact/utils";
import React from "react";

interface LabeledComponentProps {
    label: string;
    children: React.ReactNode;
    column?: boolean;
    className?: string;
}

const LabeledComponent: React.FC<LabeledComponentProps> = (props) => {
    let className = props.column
            ? "flex flex-column"
            : "flex align-items-baseline gap-2";

    if (props.className) {
        className += ` ${props.className}`;
    }

    return (
        <div className={className}>
            <label>{props.label}:</label>
            <div>{props.children}</div>
        </div>
    );
}

export default LabeledComponent;
