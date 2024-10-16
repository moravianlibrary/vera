import React from "react";
import { DigitizationState } from "../../types/DigitizationState";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";

interface DigitizationStateTagProps {
    state: DigitizationState;
}

function camelToDashCase(str) {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

const DigitizationStateTag: React.FC<DigitizationStateTagProps> = ({
    state,
}) => {
    const { t } = useTranslation("types");

    return (
        <Tag
            value={t(`digitization-state.${state}`)}
            className={`digitization-state-${camelToDashCase(state)}`}
        />
    );
};

export default DigitizationStateTag;
