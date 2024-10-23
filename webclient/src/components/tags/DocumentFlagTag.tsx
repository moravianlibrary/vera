import React from "react";
import DocumentFlag, { orderBy } from "../../types/DocumentFlag";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";

interface DocumentFlagTagProps {
    flag: DocumentFlag;
}

interface DocumentFlagsListTagProps {
    flags: DocumentFlag[];
    column?: boolean;
}

function camelToDashCase(str) {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

const DocumentFlagTag: React.FC<DocumentFlagTagProps> & {
    List: React.FC<DocumentFlagsListTagProps>;
} = ({ flag }) => {
    const { t } = useTranslation("types");

    return (
        <Tag
            value={t(`document-flag.${flag}`)}
            className={`document-flag-${camelToDashCase(flag)}`}
        />
    );
};

const DocumentFlagsListTags: React.FC<DocumentFlagsListTagProps> = ({
    flags,
    column,
}) => {
    return (
        <div
            className={
                column ? "flex flex-column gap-1" : "flex flex-wrap gap-2"
            }
        >
            {flags.sort(orderBy).map((flag, index) => (
                <DocumentFlagTag key={index} flag={flag} />
            ))}
        </div>
    );
};

DocumentFlagTag.List = DocumentFlagsListTags;

export default DocumentFlagTag;
