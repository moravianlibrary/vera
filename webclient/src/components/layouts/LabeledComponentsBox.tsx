import React, { Fragment } from "react";

interface LabeledComponentsBoxProps {
    labels: string[];
    components: React.ReactNode[];
    ignoreNotProvided?: boolean;
    center?: boolean;
}

function isEmptyValue(value) {
    return (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0)
    );
}

const LabeledComponentsBox: React.FC<LabeledComponentsBoxProps> = ({
    labels,
    components,
    ignoreNotProvided,
    center,
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
                alignItems: center ? "center" : "start",
            }}
        >
            {labels.map((label, index) =>
                ignoreNotProvided && !components[index] ? null : (
                    <Fragment key={index}>
                        <label key={`${index}_label`} className="font-bold">
                            {label}:
                        </label>
                        {isEmptyValue(components[index])
                            ? "-"
                            : components[index] || "-"}
                    </Fragment>
                )
            )}
        </div>
    );
};

export default LabeledComponentsBox;
