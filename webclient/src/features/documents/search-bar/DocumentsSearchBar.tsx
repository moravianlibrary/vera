import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import React, { useEffect, useRef, useState } from "react";
import AdvancedSearch from "./AdvancedSearch";
import { OverlayPanel } from "primereact/overlaypanel";
import { useDocuments } from "../../../contexts/documents/DocumentsContext";
import { useTranslation } from "react-i18next";
import { useDocumentsQuery } from "../../../contexts/documents/search/DocumentsQueryContext";
import DigitizationListBox from "../../../components/DigitizationListBox";
import CategoryPicker from "../../../components/pickers/CategoryPicker";
import { Badge } from "primereact/badge";
import ExtractionsBox from "../../../components/ExtractionsBox";

const DocumentsSearchBar = () => {
    const { t } = useTranslation();
    const { numFound } = useDocuments();
    const {
        queryAll,
        isQueryAll,
        categoryIds,
        searchByCategoryIds,
        extractionId,
        searchByExtractionId,
        digitizationListId,
        searchByDigitizationListId,
        searchPhrase,
        searchBySearchPhrase,
        searchGroup,
    } = useDocumentsQuery();

    const advancedSearchRef = useRef<OverlayPanel | null>(null);
    const categorySelectorRef = useRef<OverlayPanel | null>(null);
    const extractionSelectorRef = useRef<OverlayPanel | null>(null);
    const digitizationSelectorRef = useRef<OverlayPanel | null>(null);

    const [searchPhrase_, setSearchPhrase_] = useState<string>(
        searchPhrase || ""
    );
    const [triggerSearchTimer, setTriggerSearchTimer] = useState<
        NodeJS.Timeout | undefined
    >(undefined);

    useEffect(() => {
        setSearchPhrase_(searchPhrase || "");
    }, [searchPhrase]);

    const handleSearchPhraseChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setSearchPhrase_(e.target.value);
        if (triggerSearchTimer) {
            clearTimeout(triggerSearchTimer);
        }
        const timer = setTimeout(() => {
            if (e.target.value !== "") {
                searchBySearchPhrase(e.target.value);
            } else {
                queryAll();
            }
        }, 1000);
        setTriggerSearchTimer(timer);
    };

    const handleSearchByCategoryIds = (categoryIds: number[]) => {
        searchByCategoryIds(categoryIds);
        categorySelectorRef.current!.hide();
    };

    // TODO: implement search by taskId and extractionId
    return (
        <div className="flex flex-column">
            <div className="p-inputgroup flex">
                <Button
                    className={
                        categoryIds.length > 0
                            ? "bg-yellow-600 border-yellow-700"
                            : "p-button-outlined"
                    }
                    icon="pi pi-tags"
                    onClick={(e) => categorySelectorRef.current!.toggle(e)}
                    tooltip={t("Filter by category")}
                    tooltipOptions={{ position: "top", showDelay: 500 }}
                />
                <OverlayPanel ref={categorySelectorRef}>
                    <CategoryPicker
                        category_id={
                            categoryIds.length > 0 ? categoryIds[0] : null
                        }
                        callbackSubcategories={handleSearchByCategoryIds}
                    />
                </OverlayPanel>
                {/* <Button icon="pi pi-play-circle" outlined /> */}
                <Button
                    className={
                        extractionId
                            ? "bg-yellow-600 border-yellow-700"
                            : "p-button-outlined"
                    }
                    icon="pi pi-microchip"
                    onClick={(e) => extractionSelectorRef.current!.toggle(e)}
                    tooltip={t("Filter by generated extraction")}
                    tooltipOptions={{ position: "top", showDelay: 500 }}
                />
                <OverlayPanel ref={extractionSelectorRef}>
                    <ExtractionsBox callback={searchByExtractionId} />
                </OverlayPanel>
                <Button
                    className={
                        digitizationListId
                            ? "bg-yellow-600 border-yellow-700"
                            : "p-button-outlined"
                    }
                    icon="pi pi-receipt"
                    onClick={(e) => digitizationSelectorRef.current!.toggle(e)}
                    tooltip={t("Filter by digitization list")}
                    tooltipOptions={{ position: "top", showDelay: 500 }}
                />
                <OverlayPanel ref={digitizationSelectorRef}>
                    <DigitizationListBox
                        callback={searchByDigitizationListId}
                    />
                </OverlayPanel>
                <InputText
                    className={
                        searchPhrase !== null && searchPhrase !== ""
                            ? "border-yellow-600 border-3"
                            : "p-button-outlined"
                    }
                    placeholder={t("Search")}
                    value={searchPhrase_}
                    onChange={handleSearchPhraseChange}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            searchBySearchPhrase(searchPhrase_);
                        }
                    }}
                />
                <OverlayPanel ref={advancedSearchRef}>
                    <AdvancedSearch
                        onApplyFilter={() => advancedSearchRef.current!.hide()}
                    />
                </OverlayPanel>
                <Button
                    className={
                        searchGroup
                            ? "bg-yellow-600 border-yellow-700"
                            : "p-button-outlined"
                    }
                    icon="pi pi-ellipsis-v"
                    onClick={(e) =>
                        (advancedSearchRef.current as OverlayPanel).toggle(e)
                    }
                />
                <Button
                    icon="pi pi-times"
                    severity="danger"
                    disabled={isQueryAll}
                    outlined={isQueryAll}
                    onClick={queryAll}
                    tooltip={t("Cancel filtering")}
                    tooltipOptions={{ position: "top", showDelay: 500 }}
                />
            </div>
            <div className="flex mt-1 text-sm justify-content-between">
                <Badge
                    className="surface-50 text-gray-600"
                    value={`${t("Number of found documents")}: ${numFound}`}
                />
                {!isQueryAll && (
                    <Badge
                        className="bg-yellow-700"
                        value={t("Active filtering")}
                    />
                )}
            </div>
        </div>
    );
};

export default DocumentsSearchBar;
