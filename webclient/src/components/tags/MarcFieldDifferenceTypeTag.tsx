import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import MarcFieldDifferenceType from "../../types/MarcFieldDifferenceType";

interface MarcFieldDifferenceTypeTagProps {
    differenceType: MarcFieldDifferenceType;
    approved?: boolean;
    value?: string;
}

const MarcFieldDifferenceTypeTag: React.FC<MarcFieldDifferenceTypeTagProps> = ({
    differenceType,
    approved,
    value,
}) => {
    const { t } = useTranslation();

    return (
        <Tag
            className={
                approved
                    ? "difft-approved-tag"
                    : `difft-${differenceType.toLowerCase()}-tag`
            }
            value={value || t(`catalog-records.difference.${differenceType}`)}
        />
    );
};

export default MarcFieldDifferenceTypeTag;
