import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import React, { useEffect, useRef, useState } from "react";
import AdvancedSearch from "./AdvancedSearch";
import { OverlayPanel } from "primereact/overlaypanel";
import { useDocuments } from "../../../contexts/documents/DocumentsContext";
import { useTranslation } from "react-i18next";
import AssignableCategoryPicker from "../../../components/pickers/AssignableCategoryPicker";
import { useDocumentsQuery } from "../../../contexts/documents/search/DocumentsQueryContext";
import DigitizationListBox from "../../../components/DigitizationListBox";

const DocumentsSearchBar = () => {
    const { t } = useTranslation();
    const { numFound } = useDocuments();
    const {
        queryAll,
        isQueryAll,
        categoryId,
        searchByCategoryId,
        digitizationListId,
        searchByDigitizationListId,
        searchPhrase,
        searchBySearchPhrase,
    } = useDocumentsQuery();

    const advancedSearchRef = useRef<OverlayPanel | null>(null);
    const categorySelectorRef = useRef<OverlayPanel | null>(null);
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
            searchBySearchPhrase(e.target.value);
        }, 1000);
        setTriggerSearchTimer(timer);
    };

    // TODO: implement search by taskId and extractionId
    return (
        <div className="flex flex-column">
            <div className="p-inputgroup flex">
                <Button
                    className={
                        categoryId
                            ? "bg-yellow-600 border-yellow-700"
                            : "p-button-outlined"
                    }
                    icon="pi pi-tags"
                    onClick={(e) => categorySelectorRef.current!.toggle(e)}
                    tooltip={t("Filter by category")}
                    tooltipOptions={{ position: "top", showDelay: 500 }}
                />
                <OverlayPanel ref={categorySelectorRef}>
                    <AssignableCategoryPicker
                        category_id={categoryId}
                        callback={searchByCategoryId}
                    />
                </OverlayPanel>
                {/* <Button icon="pi pi-play-circle" outlined /> */}
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
                    placeholder={t("Search")}
                    value={searchPhrase_}
                    onChange={handleSearchPhraseChange}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            searchBySearchPhrase(searchPhrase_);
                        }
                    }}
                />
                <Button
                    icon="pi pi-search"
                    onClick={() => searchBySearchPhrase(searchPhrase_)}
                />
                <OverlayPanel ref={advancedSearchRef}>
                    <AdvancedSearch />
                </OverlayPanel>
                <Button
                    icon="pi pi-ellipsis-v"
                    outlined
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
                <span className="text-gray-700">
                    {t("Number of found documents")}: {numFound}
                </span>
                {!isQueryAll && (
                    <span className="text-yellow-700">
                        {t("Active filtering")}
                    </span>
                )}
            </div>
        </div>
    );
};

export default DocumentsSearchBar;
