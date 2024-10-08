import { Tag } from "primereact/tag";
import React from "react";
import { useTranslation } from "react-i18next";

interface ExtractionPriorityTagProps {
    priority: number | null;
}

const ExtractionPriorityTag: React.FC<ExtractionPriorityTagProps> = ({
    priority,
}) => {
    const { t } = useTranslation();

    if (priority) {
        return (
            <Tag
                value={t(`documents.extraction-priority.${priority}`)}
                className={`extraction-priority-${priority}`}
            />
        );
    }

    return <Tag value="?" className="extraction-priority-?" />;
};

export default ExtractionPriorityTag;
