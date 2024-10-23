import React from "react";
import DocumentFlag from "../../types/DocumentFlag";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";

interface DocumentFlagTagProps {
    flag: DocumentFlag;
}

function camelToDashCase(str) {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

const DocumentFlagTag: React.FC<DocumentFlagTagProps> = ({ flag }) => {
    const { t } = useTranslation("types");

    return (
        <Tag
            value={t(`document-flag.${flag}`)}
            className={`document-flag-${camelToDashCase(flag)}`}
        />
    );
};

export default DocumentFlagTag;
