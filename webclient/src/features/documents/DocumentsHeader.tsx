import { Button } from "primereact/button";
import React, { useEffect, useRef, useState } from "react";
import DocumentsSearchBar from "../../documents/components/DocumentsSearchBar";
import { SelectButton } from "primereact/selectbutton";
import { Toolbar } from "primereact/toolbar";
import { useTranslation } from "react-i18next";
import { useDocuments } from "../../contexts/documents/DocumentsContext";
import { OverlayPanel } from "primereact/overlaypanel";
import { Menu } from "primereact/menu";
import { TaskType } from "../../types/TaskType";

const DocumentsHeader = (props) => {
    const { t } = useTranslation();
    const { selectedDocuments, handleStartTask } = useDocuments();

    const [advancedSearch, setAdvancedSearch] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);
    const [displayOption, setDisplayOption] = useState("datatable");
    const displayOptions = [
        { name: 'Option 1', icon: 'pi pi-table', value: "datatable" },
        { name: 'Option 2', icon: 'pi pi-chart-bar', value: "graph", disabled: true },
    ];

    const taskSelectorMenuRef = useRef(null);
    const taskSelectorItems = [{items: [
        { label: t(TaskType.PredictVolumePages), command: () => handleStartTask(TaskType.PredictVolumePages), },
        // { label: 'Export', }
    ]}];

    const handleSetDisplayOption = (e) => {
        if (e.value !== null) {
            setDisplayOption(e.value);
        }
    };

    useEffect(() => {
        setHasSelection(selectedDocuments.length > 0);
    }, [selectedDocuments]);

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

    const toggleTaskSelectorMenu = (event) => {
        if (taskSelectorMenuRef.current) {
            (taskSelectorMenuRef.current as OverlayPanel).toggle(event);
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
                label={t('insert_document')}
                icon="pi pi-plus"
                outlined
                onClick={handleInsert}
            />
            <i className="pi pi-bars p-toolbar-separator m-1" />
            <SelectButton value={displayOption}
                onChange={handleSetDisplayOption}
                itemTemplate={displayOptionTemplate}
                options={displayOptions}
            />
        </React.Fragment>
    );

    const centerContent = (
        <React.Fragment>
            <DocumentsSearchBar categories={props.categories} />
        </React.Fragment>
    );

    const categorySelector = (
        <React.Fragment>
            <DocumentsSearchBar />
        </React.Fragment>
    );

    const endContent = (
        <React.Fragment>
            <Menu model={taskSelectorItems} popup ref={taskSelectorMenuRef} id="popup_menu_left" />
            <Button icon="pi pi-th-large"
                className="p-button-rounded p-button-text"
                severity={hasSelection ? "help" : "secondary"}
                disabled={!hasSelection}
                onClick={toggleTaskSelectorMenu}
                aria-controls="popup_menu_left"
                aria-haspopup
            />
            <Button icon="pi pi-pencil"
                className="p-button-rounded p-button-text"
                severity={hasSelection ? "info" : "secondary"}
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
                severity={hasSelection ? "info" : "secondary"}
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
