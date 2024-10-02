import React from "react";

interface LabeledSectionProps {
    label: string;
    children: React.ReactNode;
}

const LabeledSection: React.FC<LabeledSectionProps> = (props) => {
    return (
        <div className="layout-labeled-section">
            <div className="legend">
                <label className="label">{props.label}</label>
            </div>
            <div className="content">{props.children}</div>
        </div>
    );
};

export default LabeledSection;
