import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useRef } from "react";
import AdvancedSearch from "../pages/AdvancedSearch";
import { OverlayPanel } from "primereact/overlaypanel";

const DocumentsSearchBar = (props) => {
    const advancedSearchRef = useRef(null);

    const handleSearch = () => {
        if (props.onSearch) {
            props.onSearch();
        }
    };

    return (
        <div className="flex">
            <div className="p-inputgroup flex">
                <InputText placeholder="Search" />
                <Button icon="pi pi-search" />
                <Button outlined icon="pi pi-ellipsis-v" onClick={(e) => advancedSearchRef.current.toggle(e)}/>
                <OverlayPanel ref={advancedSearchRef} >
                    <AdvancedSearch
                        categories={props.categories}
                    />   
                </OverlayPanel>
            </div>
        </div>
    );
};

export default DocumentsSearchBar;