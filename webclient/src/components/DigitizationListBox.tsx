import React from "react";
import { ListBox } from "primereact/listbox";
import { useDigitizationLists } from "../contexts/DigitizationListsContext";
import { useTranslation } from "react-i18next";

interface DigitizationListBoxProps {
    callback: (digitizationId: number) => void;
}

const DigitizationListBox: React.FC<DigitizationListBoxProps> = ({
    callback,
}) => {
    const { t } = useTranslation();
    const { digitizationLists } = useDigitizationLists();
    return (
        <ListBox
            className="overflow-auto"
            style={{ maxHeight: "calc(100vh - 200px)" }}
            options={digitizationLists.map((l) => ({
                label: `${l.id}: ${l.created_by}, ${l.created_at}, ${
                    l.page_count
                } ${t("pages")}`,
                value: l.id,
            }))}
            onChange={(e) => callback(e.value as number)}
        />
    );
};

export default DigitizationListBox;
