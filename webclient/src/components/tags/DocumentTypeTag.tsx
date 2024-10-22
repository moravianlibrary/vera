import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { MaterialType } from "../../types/MaterialType";
import { IssuanceType } from "../../types/IssuanceType";
import { IndexDocument } from "../../adapters/ApiDocuments";
import IssuanceTypeTag from "./IssuanceTypeTag";
import MaterialTypeTag from "./MaterialTypeTag";

interface DocumentTypeTagProps {
    document: IndexDocument;
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

const DocumentTypeTag: React.FC<DocumentTypeTagProps> = ({ document }) => {
    const { t } = useTranslation("types");

    // A lot of monographs does not have information about being a Book in MZK catalog
    if (
        document.material_type === MaterialType.Other &&
        document.issuance_type === IssuanceType.Unit
    ) {
        return (
            <IssuanceTypeTag
                issuanceType={IssuanceType.Unit}
                includeMaterialType
            />
        );
    }

    if (isInvalidCombination(document.material_type, document.issuance_type)) {
        return (
            <Tag
                value={t("document-type.invalid")}
                className="dt-invalid-tag"
            />
        );
    }

    if (document.issuance_type) {
        return (
            <IssuanceTypeTag
                issuanceType={document.issuance_type}
                includeMaterialType
            />
        );
    }

    return <MaterialTypeTag materialType={document.material_type} />;
};

export default DocumentTypeTag;
