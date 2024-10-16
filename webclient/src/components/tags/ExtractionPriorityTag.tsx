import { Tag } from "primereact/tag";
import React from "react";
import { useTranslation } from "react-i18next";

interface ExtractionPriorityTagProps {
    priority: number | null;
}

const ExtractionPriorityTag: React.FC<ExtractionPriorityTagProps> = ({
    priority,
}) => {
    const { t } = useTranslation("types");

    if (priority) {
        return (
            <Tag
                value={t(`extraction-priority.${priority}`)}
                className={`extraction-priority-${priority}`}
            />
        );
    }

    return <Tag value="?" className="extraction-priority-?" />;
};

export default ExtractionPriorityTag;
