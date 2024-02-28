import { Button } from "primereact/button";
import React, { useEffect, useRef, useState } from "react";
import DocumentsSearchBar from "./search-bar/DocumentsSearchBar";
import { SelectButton } from "primereact/selectbutton";
import { Toolbar } from "primereact/toolbar";
import { useTranslation } from "react-i18next";
import { useDocuments } from "../../contexts/documents/DocumentsContext";
import { OverlayPanel } from "primereact/overlaypanel";
import { Menu } from "primereact/menu";
import { TaskType } from "../../types/TaskType";

interface DocumentsHeaderProps {
    onInsert: () => void;
    onCreate: () => void;
}

const DocumentsHeader: React.FC<DocumentsHeaderProps> = (props) => {
    const { t } = useTranslation();
    const { selectedDocuments, handleStartTask, handleSelectDocuments } = useDocuments();

    const [advancedSearch, setAdvancedSearch] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);
    const [displayOption, setDisplayOption] = useState("datatable");
    const displayOptions = [
        { name: 'Option 1', icon: 'pi pi-table', value: "datatable" },
        { name: 'Option 2', icon: 'pi pi-chart-bar', value: "graph", disabled: true },
    ];

    const taskSelectorMenuRef = useRef(null);
    const taskSelectorItems = [{items: [
        { label: t("Predict volumes page counts"), command: () => handleStartTask(TaskType.PredictVolumePages), },
        { label: t("Sync from catalog"), command: () => handleStartTask(TaskType.SyncFromCatalog), },
        { label: t("Sync from digitization registry"), command: () => handleStartTask(TaskType.SyncFromDigitizationRegistry), },
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
                onClick={props.onInsert}
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
            <Menu model={taskSelectorItems} popup ref={taskSelectorMenuRef} id="popup_menu_left" />
            <Button 
                // icon="pi pi-th-large"
                icon="pi pi-list"
                className="p-button-rounded p-button-text"
                severity={hasSelection ? "help" : "secondary"}
                disabled={!hasSelection}
                onClick={toggleTaskSelectorMenu}
                aria-controls="popup_menu_left"
                aria-haspopup
            />
            <Button icon="pi pi-trash" 
                className="p-button-rounded p-button-text"
                severity={hasSelection ? "danger" : "secondary"}
                // disabled={!hasSelection}
                disabled
                // onClick={handleDeleteSelectedDocuments}
            />
            <Button icon="pi pi-times" 
                className="p-button-rounded p-button-text"
                severity={hasSelection ? "info" : "secondary"}
                disabled={!hasSelection}
                onClick={() => handleSelectDocuments([])}
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
