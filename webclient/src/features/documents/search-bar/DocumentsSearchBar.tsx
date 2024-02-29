import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import React, { useRef } from "react";
import AdvancedSearch from "./AdvancedSearch";
import { OverlayPanel } from "primereact/overlaypanel";
import { useDocuments } from "../../../contexts/documents/DocumentsContext";
import { useTranslation } from "react-i18next";
import { useDocumentsSearch } from "../../../contexts/documents/search/DocumentsSearchContext";

const DocumentsSearchBar = () => {
    const { t } = useTranslation();
    const { numFound } = useDocuments();
    const { activeQuery, handleCancelFilter } = useDocumentsSearch();

    const advancedSearchRef = useRef<OverlayPanel | null>(null);

    const handleSearch = () => {
    };
    console.log(activeQuery);

    return (
        <div className="flex flex-column">
            <div className="p-inputgroup flex">
                <InputText placeholder="Search" disabled />
                <Button icon="pi pi-search" disabled />
                <OverlayPanel ref={advancedSearchRef} >
                    <AdvancedSearch/>   
                </OverlayPanel>
                <Button icon="pi pi-ellipsis-v"
                    disabled
                    outlined
                    onClick={(e) => (advancedSearchRef.current as OverlayPanel).toggle(e)}
                />
                <Button icon="pi pi-times"
                    severity="danger"
                    disabled={activeQuery === undefined}
                    outlined={activeQuery === undefined}
                    onClick={handleCancelFilter}
                    tooltip={t('Cancel filtering')}
                    tooltipOptions={{ position: 'top', showDelay: 500 }}
                />
            </div>
            <div className="flex mt-1 text-sm justify-content-between">
                <span className="text-gray-700">{t('Number of found documents')}: {numFound}</span>
                {activeQuery &&
                <span className="text-yellow-700">{t('Active filtering')}</span>}
            </div>
        </div>
    );
};

export default DocumentsSearchBar;