import React, { Fragment } from "react";

interface LabeledComponentsBoxProps {
    labels: string[];
    components: React.ReactNode[];
    ignoreNotProvided?: boolean;
}

const LabeledComponentsBox: React.FC<LabeledComponentsBoxProps> = ({
    labels,
    components,
    ignoreNotProvided,
}) => {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "auto auto",
                minWidth: "fit-content",
                maxWidth: "fit-content",
                rowGap: "3px",
                columnGap: "1rem",
                alignItems: "center",
            }}
        >
            {labels.map((label, index) =>
                ignoreNotProvided && !components[index] ? null : (
                    <Fragment key={`${label}_${index}`}>
                        <label className="font-bold">{label}:</label>
                        {components[index] || "-"}
                    </Fragment>
                )
            )}
        </div>
    );
};

export default LabeledComponentsBox;
