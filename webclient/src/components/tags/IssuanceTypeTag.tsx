import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { IssuanceType } from "../../types/IssuanceType";

interface IssuanceTypeTagProps {
    issuanceType: IssuanceType;
    includeMaterialType?: boolean;
}

const IssuanceTypeTag: React.FC<IssuanceTypeTagProps> = ({
    issuanceType,
    includeMaterialType,
}) => {
    const { t } = useTranslation("types");

    switch (issuanceType) {
        case IssuanceType.Volume:
            return (
                <Tag
                    value={t(
                        includeMaterialType
                            ? "document-type.periodical-volume"
                            : "document-type.volume"
                    )}
                    className="dt-volume-tag"
                />
            );
        case IssuanceType.Bundle:
            return (
                <Tag
                    value={t(
                        includeMaterialType
                            ? "document-type.periodical-bundle"
                            : "document-type.bundle"
                    )}
                    className="dt-bundle-tag"
                />
            );
        case IssuanceType.Unit:
            return (
                <Tag
                    value={t(
                        includeMaterialType
                            ? "document-type.monograph-unit"
                            : "document-type.unit"
                    )}
                    className="dt-unit-tag"
                />
            );
    }
};

const valueToIssuanceTypeTag = (value: string) => {
    return <IssuanceTypeTag issuanceType={value as IssuanceType} />;
};

export default IssuanceTypeTag;
export { valueToIssuanceTypeTag };
