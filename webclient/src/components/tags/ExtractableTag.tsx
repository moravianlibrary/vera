import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import DocumentModel from "../../contexts/documents/DocumentModel";

interface ExtractableTagProps {
    document: DocumentModel;
}

const ExtractableTag: React.FC<ExtractableTagProps> = ({ document }) => {
    const { t } = useTranslation();

    if (document.is_extractable) {
        return (
            <Tag
                value={t(`document.extractable.isExtractable`)}
                className="extractable-is-extractable"
            />
        );
    }
    if (document.extraction_id) {
        return (
            <Tag
                value={t(`document.extractable.extracted`)}
                className="extractable-extracted"
            />
        );
    }
    if (document.cnb === null) {
        return (
            <Tag
                value={t(`document.extractable.missingCnb`)}
                className="extractable-missing-cnb"
            />
        );
    }
    if (document.page_count === 0) {
        return (
            <Tag
                value={t(`document.extractable.missingPages`)}
                className="extractable-missing-pages"
            />
        );
    }

    return (
        <Tag
            value={t(`document.extractable.notExtractable`)}
            className="extractable-not-extractable"
        />
    );
};

export default ExtractableTag;
