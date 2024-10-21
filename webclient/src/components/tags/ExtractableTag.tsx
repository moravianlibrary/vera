import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { IndexDocument } from "../../adapters/ApiDocuments";

interface ExtractableTagProps {
    document: IndexDocument;
}

const ExtractableTag: React.FC<ExtractableTagProps> = ({ document }) => {
    const { t } = useTranslation("types");

    if (document.is_extractable) {
        return (
            <Tag
                value={t(`extractable.is-extractable`)}
                className="extractable-is-extractable"
            />
        );
    }
    if (document.digitization_list_id) {
        return (
            <Tag
                value={t(`extractable.extracted`)}
                className="extractable-extracted"
            />
        );
    }
    if (!document.has_valid_main_record) {
        return (
            <Tag
                value={t(`extractable.invalid-main-record`)}
                className="extractable-invalid-main-record"
            />
        );
    }
    if (!document.has_valid_cnb) {
        return (
            <Tag
                value={t(`extractable.invalid-cnb`)}
                className="extractable-invalid-cnb"
            />
        );
    }
    if (document.page_count === undefined || document.page_count === 0) {
        return (
            <Tag
                value={t(`extractable.missing-page-count`)}
                className="extractable-missing-pages"
            />
        );
    }

    return (
        <Tag
            value={t(`extractable.not-extractable`)}
            className="extractable-not-extractable"
        />
    );
};

export default ExtractableTag;
