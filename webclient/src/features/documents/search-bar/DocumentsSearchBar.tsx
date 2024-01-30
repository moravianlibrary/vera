import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import React, { useRef } from "react";
import AdvancedSearch from "./AdvancedSearch";
import { OverlayPanel } from "primereact/overlaypanel";

const DocumentsSearchBar = () => {
    const advancedSearchRef = useRef<OverlayPanel | null>(null);

    const handleSearch = () => {
    };

    return (
        <div className="flex">
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
            </div>
        </div>
    );
};

export default DocumentsSearchBar;