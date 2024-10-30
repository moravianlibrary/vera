import React from "react";

interface LabeledComponentProps {
    label: string;
    children: React.ReactNode;
    column?: boolean;
    className?: string;
    boldLabel?: boolean;
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
            <label className={props.boldLabel ? "font-bold" : ""}>
                {props.label}:
            </label>
            <div>{props.children}</div>
        </div>
    );
};

export default LabeledComponent;
