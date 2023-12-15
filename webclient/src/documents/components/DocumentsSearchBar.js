import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { useRef, useState } from "react";
import AdvancedSearch from "../pages/AdvancedSearch";
import { Dialog } from "primereact/dialog";

const DocumentsSearchBar = (props) => {
    const [advancedSearch, setAdvancedSearch] = useState(false);

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
                <Button outlined icon="pi pi-ellipsis-v" onClick={(e) => setAdvancedSearch(true)}/>
            </div>
            <Dialog
                className='w-3'
                visible={advancedSearch} 
                onHide={(e) => setAdvancedSearch(false)}
                // maximized={true}
            >
                <AdvancedSearch
                    // categories={categories}
                    onClose={() => setAdvancedSearch(false)}
                />   
            </Dialog>
        </div>
    );
};

export default DocumentsSearchBar;