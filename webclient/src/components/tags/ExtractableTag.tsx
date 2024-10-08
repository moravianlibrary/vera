import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { IndexDocument } from "../../adapters/ApiDocuments";

interface ExtractableTagProps {
    document: IndexDocument;
}

const ExtractableTag: React.FC<ExtractableTagProps> = ({ document }) => {
    const { t } = useTranslation();

    if (document.is_extractable) {
        return (
            <Tag
                value={t(`documents.extractable.isExtractable`)}
                className="extractable-is-extractable"
            />
        );
    }
    if (document.digitization_list_id) {
        return (
            <Tag
                value={t(`documents.extractable.extracted`)}
                className="extractable-extracted"
            />
        );
    }
    if (document.cnb === null) {
        return (
            <Tag
                value={t(`documents.extractable.missingCnb`)}
                className="extractable-missing-cnb"
            />
        );
    }
    if (document.page_count === 0) {
        return (
            <Tag
                value={t(`documents.extractable.missingPages`)}
                className="extractable-missing-pages"
            />
        );
    }

    return (
        <Tag
            value={t(`documents.extractable.notExtractable`)}
            className="extractable-not-extractable"
        />
    );
};

export default ExtractableTag;
