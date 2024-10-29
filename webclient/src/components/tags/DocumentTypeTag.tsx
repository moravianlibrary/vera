import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { MaterialType } from "../../types/MaterialType";
import { IssuanceType } from "../../types/IssuanceType";
import IssuanceTypeTag from "./IssuanceTypeTag";
import MaterialTypeTag from "./MaterialTypeTag";

interface DocumentTypeTagProps {
    materialType: MaterialType;
    issuanceType?: IssuanceType;
}

function isInvalidCombination(
    materialType: MaterialType,
    issuanceType?: IssuanceType
) {
    if (!issuanceType) return false;

    const isUnitInvalid =
        issuanceType === IssuanceType.Unit &&
        materialType !== MaterialType.Book;
    const isVolumeOrBundleInvalid =
        [IssuanceType.Volume, IssuanceType.Bundle].includes(issuanceType) &&
        materialType !== MaterialType.ContinuingResource;

    return isUnitInvalid || isVolumeOrBundleInvalid;
}

const DocumentTypeTag: React.FC<DocumentTypeTagProps> = ({
    materialType,
    issuanceType,
}) => {
    const { t } = useTranslation("types");

    // A lot of monographs does not have information about being a Book in MZK catalog
    if (
        materialType === MaterialType.Other &&
        issuanceType === IssuanceType.Unit
    ) {
        return (
            <IssuanceTypeTag
                issuanceType={IssuanceType.Unit}
                includeMaterialType
            />
        );
    }

    if (isInvalidCombination(materialType, issuanceType)) {
        return (
            <Tag
                value={t("document-type.invalid")}
                className="dt-invalid-tag"
            />
        );
    }

    if (issuanceType) {
        return (
            <IssuanceTypeTag issuanceType={issuanceType} includeMaterialType />
        );
    }

    return <MaterialTypeTag materialType={materialType} />;
};

export default DocumentTypeTag;
