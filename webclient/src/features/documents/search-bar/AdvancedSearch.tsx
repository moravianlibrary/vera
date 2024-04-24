import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import AdvancedSearchNode from "./AdvancedSearchNode";
import React from "react";
import { useAdvancedSearch } from "../../../contexts/documents/search/AdvancedSearchContext";

interface AdvancedSearchProps {
    onApplyFilter?: () => void;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onApplyFilter }) => {
    const { t } = useTranslation();
    const {
        rootSearchGroup,
        // TODO: rename, drop prefix handle
        handleApplyFilter,
        handleSaveFilter,
        handleClearFilter,
    } = useAdvancedSearch();

    const handleApplyFilterClick = () => {
        handleApplyFilter();
        if (onApplyFilter) {
            onApplyFilter();
        }
    };

    return (
        <div className="flex flex-column gap-1 flex-grow-0">
            <div className="overflow-auto" style={{ maxHeight: "75vh" }}>
                <AdvancedSearchNode data={rootSearchGroup} />
            </div>
            <div className="flex justify-content-between gap-1">
                <div className="flex gap-1">
                    <Button
                        label={t("Clear filter")}
                        outlined
                        onClick={handleClearFilter}
                    />
                    <Button
                        label={t("Save filter")}
                        outlined
                        onClick={handleSaveFilter}
                    />
                </div>
                <Button
                    label={t("Apply filter")}
                    outlined
                    onClick={handleApplyFilterClick}
                />
            </div>
        </div>
    );
};

export default AdvancedSearch;
