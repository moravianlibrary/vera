import { Button } from "primereact/button";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface StringListDisplayProps {
    stringList: string[];
    maxItems: number;
    separator?: string;
}

const StringListDisplay: React.FC<StringListDisplayProps> = ({
    stringList,
    maxItems,
    separator = ", ",
}) => {
    const { t } = useTranslation();

    const [showMore, setShowMore] = useState<boolean>(false);

    if (stringList.length === 0) return <span>-</span>;

    if (stringList.length <= maxItems) {
        return (
            <div className="flex flex-column">
                {stringList.map((s, i) => (
                    <span key={i}>{s}</span>
                ))}
            </div>
        );
    }

    return (
        <div className="layout-string-list">
            <div className="flex flex-column">
                {(showMore ? stringList : stringList.slice(0, maxItems)).map(
                    (s, i) => (
                        <span key={i}>{s}</span>
                    )
                )}
            </div>
            <Button
                className="p-0 m-0"
                text
                label={showMore ? t("common.show-less") : t("common.show-more")}
                icon={showMore ? "pi pi-angle-up" : "pi pi-angle-down"}
                onClick={() => setShowMore(!showMore)}
            />
        </div>
    );
};

export default StringListDisplay;
