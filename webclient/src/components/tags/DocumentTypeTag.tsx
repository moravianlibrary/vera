import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { MaterialType } from "../../types/MaterialType";
import { IssuanceType } from "../../types/IssuanceType";
import { IndexDocument } from "../../adapters/ApiDocuments";

interface DocumentTypeTagProps {
    document: IndexDocument;
}

const DocumentTypeTag: React.FC<DocumentTypeTagProps> = ({ document }) => {
    const { t } = useTranslation();

    switch (document.material_type) {
        case MaterialType.ContinuingResource:
            switch (document.issuance_type) {
                case IssuanceType.Volume:
                    return (
                        <Tag
                            value={t(`document.periodical-volume`)}
                            className="periodical-volume-tag"
                        />
                    );
                case IssuanceType.Bundle:
                    return (
                        <Tag
                            value={t(`document.periodical-bundle`)}
                            className="periodical-bundle-tag"
                        />
                    );
                default:
                    return (
                        <Tag
                            value={t(`document.periodical`)}
                            className="periodical-tag"
                        />
                    );
            }

        case MaterialType.Book:
            switch (document.issuance_type) {
                case IssuanceType.Unit:
                    return (
                        <Tag
                            value={t(`document.monograph-unit`)}
                            className="monograph-unit-tag"
                        />
                    );
                default:
                    return (
                        <Tag
                            value={t(`document.monograph`)}
                            className="monograph-tag"
                        />
                    );
            }

        case MaterialType.Map:
            return <Tag value={t(`document.map`)} className="map-tag" />;

        case MaterialType.Music:
            return <Tag value={t(`document.music`)} className="music-tag" />;

        default:
            return (
                <Tag
                    value={t(`document.type-other`)}
                    className="document-type-other-tag"
                />
            );
    }
};

export default DocumentTypeTag;
