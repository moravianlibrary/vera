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
    const { t } = useTranslation("types");

    return (
        <Tag
            className={`diff-tag 
                ${approved
                    ? "difft-approved-tag"
                    : `difft-${differenceType.toLowerCase()}-tag`}`
            }
            value={value || t(`marc-difference.${differenceType}`)}
        />
    );
};

export default MarcFieldDifferenceTypeTag;
