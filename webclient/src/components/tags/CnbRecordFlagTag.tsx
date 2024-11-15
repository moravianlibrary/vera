import React from "react";
import MarcFieldDifferenceType from "../../types/MarcFieldDifferenceType";
import CnbRecordFlag from "../../types/CnbRecordFlag";
import { useTranslation } from "react-i18next";
import ValidityTag from "./ValidityTag";
import NotFoundTag from "./NotFoundTag";
import MarcFieldDifferenceTypeTag from "./MarcFieldDifferenceTypeTag";

interface CnbRecordFlagTagProps {
    value: CnbRecordFlag | MarcFieldDifferenceType;
}

const CnbRecordFlagTag: React.FC<CnbRecordFlagTagProps> = ({ value }) => {
    const { t } = useTranslation("types");

    if (
        value === CnbRecordFlag.Valid ||
        value === CnbRecordFlag.ShouldNotHaveCnb
    ) {
        return (
            <ValidityTag
                label={t(`cnb-record-flags.${value}`)}
                isValid={true}
            />
        );
    }
    if (value === CnbRecordFlag.NotFound) {
        return <NotFoundTag label={t(`cnb-record-flags.${value}`)} />;
    }

    return (
        <MarcFieldDifferenceTypeTag
            differenceType={value as MarcFieldDifferenceType}
        />
    );
};

export default CnbRecordFlagTag;
