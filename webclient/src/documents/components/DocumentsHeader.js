import { Button } from "primereact/button";
import React, { useEffect, useState } from "react";
import DocumentsSearchBar from "./DocumentsSearchBar";
import { SelectButton } from "primereact/selectbutton";
import { Toolbar } from "primereact/toolbar";

const DocumentsHeader = (props) => {
    const [advancedSearch, setAdvancedSearch] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);
    const [displayOption, setDisplayOption] = useState("datatable");
    const displayOptions = [
        { name: 'Option 1', icon: 'pi pi-table', value: "datatable" },
        { name: 'Option 2', icon: 'pi pi-chart-bar', value: "graph" },
    ];

    useEffect(
        () => setHasSelection(props.hasSelection),
        [props.hasSelection]
    );

    const handleCreate = (e) => {
        if (props.onCreate) {
            props.onCreate();
        }
    };

    const handleInsert = (e) => {
        if (props.onInsert) {
            props.onInsert();
        }
    };

    const displayOptionTemplate = (option) => {
        return (
            <div>
                <i className={option.icon}></i>
                {/* <span>{option.name}</span> */}
            </div>
        );
    };

    const startContent = (
        <React.Fragment>
            <Button
                label="New"
                icon="pi pi-pencil"
                outlined
                onClick={handleCreate}
            />
            <Button
                label="Upload"
                icon="pi pi-plus"
                outlined
                onClick={handleInsert}
            />
            <i className="pi pi-bars p-toolbar-separator m-1" />
            <SelectButton value={displayOption}
                onChange={(e) => setDisplayOption(e.value)}
                itemTemplate={displayOptionTemplate}
                options={displayOptions}
            />
        </React.Fragment>
    );

    const centerContent = (
        <React.Fragment>
            <DocumentsSearchBar />
        </React.Fragment>
    );

    const categorySelector = (
        <React.Fragment>
            <DocumentsSearchBar />
        </React.Fragment>
    );

    const endContent = (
        <React.Fragment>
            <Button icon="pi pi-pencil"
                className="p-button-rounded p-button-text"
                severity={hasSelection ? "primary" : "secondary"}
                disabled={!hasSelection}
                // onClick={() => setSelectCategoryVisible(true)}
            />
            <Button icon="pi pi-trash" 
                className="p-button-rounded p-button-text"
                severity={hasSelection ? "danger" : "secondary"}
                disabled={!hasSelection}
                // onClick={handleDeleteSelectedDocuments}
            />
            <Button icon="pi pi-times" 
                className="p-button-rounded p-button-text"
                severity={hasSelection ? "primary" : "secondary"}
                disabled={!hasSelection}
                // onClick={handleCancelSelectedDocuments}
            />
        </React.Fragment>
    );

    if (advancedSearch) {
        return (
            <Toolbar start={startContent} center={centerContent} end={endContent} />
        );
    }

    return (
        <Toolbar start={startContent} center={centerContent} end={endContent} />
    );
};

export default DocumentsHeader;
