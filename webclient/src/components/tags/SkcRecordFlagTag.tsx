import React from "react";
import MarcFieldDifferenceType from "../../types/MarcFieldDifferenceType";
import SkcRecordFlag from "../../types/SkcRecordFlag";
import { useTranslation } from "react-i18next";
import ValidityTag from "./ValidityTag";
import NotFoundTag from "./NotFoundTag";
import MarcFieldDifferenceTypeTag from "./MarcFieldDifferenceTypeTag";

interface SkcRecordFlagTagProps {
    value: SkcRecordFlag | MarcFieldDifferenceType;
}

const SkcRecordFlagTag: React.FC<SkcRecordFlagTagProps> = ({ value }) => {
    const { t } = useTranslation("types");

    if (value === SkcRecordFlag.Valid) {
        return (
            <ValidityTag
                label={t(`skc-record-flags.${value}`)}
                isValid={true}
            />
        );
    }
    if (value === SkcRecordFlag.NotFound) {
        return <NotFoundTag label={t(`skc-record-flags.${value}`)} />;
    }

    return (
        <MarcFieldDifferenceTypeTag
            differenceType={value as MarcFieldDifferenceType}
        />
    );
};

export default SkcRecordFlagTag;
