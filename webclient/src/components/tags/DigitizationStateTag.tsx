import React from "react";
import { DigitizationState } from "../../types/DigitizationState";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";

interface DigitizationStateTagProps {
    state: DigitizationState;
}

const DigitizationStateTag: React.FC<DigitizationStateTagProps> = ({
    state,
}) => {
    const { t } = useTranslation();

    if (state === DigitizationState.Finished) {
        return (
            <Tag
                value={t(`digitizationState.${state}`)}
                className="digitization-state-finished"
            />
        );
    }
    if (state === DigitizationState.InProgress) {
        return (
            <Tag
                value={t(`digitizationState.${state}`)}
                className="digitization-state-in-progress"
            />
        );
    }
    if (state === DigitizationState.Planned) {
        return (
            <Tag
                value={t(`digitizationState.${state}`)}
                className="digitization-state-planned"
            />
        );
    }

    return (
        <Tag
            value={t(`digitizationState.${DigitizationState.NotDigitized}`)}
            className="digitization-state-not-digitized"
        />
    );
};

export default DigitizationStateTag;
