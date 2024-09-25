import React from "react";
import { ListBox } from "primereact/listbox";
import { useTranslation } from "react-i18next";
import { useExtractions } from "../contexts/extractions/GeneratedExtractionsContext";

interface ExtractionsBoxProps {
    callback: (digitizationId: number) => void;
}

const ExtractionsBox: React.FC<ExtractionsBoxProps> = ({ callback }) => {
    const { t } = useTranslation();
    const { extractions } = useExtractions();
    return (
        <ListBox
            className="overflow-auto"
            style={{ maxHeight: "calc(100vh - 200px)" }}
            options={extractions.map((e) => ({
                label: `${e.id}: ${e.generated_by}, ${e.generated_at}, ${
                    e.selected_pages
                } ${t("pages")}, ${e.document_ids.length} ${t("documents")}`,
                value: e.id,
            }))}
            onChange={(e) => callback(e.value as number)}
        />
    );
};

export default ExtractionsBox;
