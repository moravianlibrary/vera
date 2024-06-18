import { Button } from "primereact/button";
import React, { useState } from "react";
import DocumentsSearchBar from "./search-bar/DocumentsSearchBar";
import { Toolbar } from "primereact/toolbar";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "primereact/confirmdialog";
import DocumentsActionsMenu from "./ActionsMenu";
import { useDocumentsSelection } from "../../contexts/documents/DocumentsSelectionContext";
import { useDocumentsActions } from "../../contexts/documents/DocumentsActionsContext";
import { Badge } from "primereact/badge";
import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";

export enum TableViewType {
    DatatableVisual,
    DatatableData,
    DataChart,
}

interface DocumentsHeaderProps {
    onInsert: () => void;
    onCreate: () => void;
    tableViewType: TableViewType;
    onTableViewTypeChange: (option: TableViewType) => void;
}

const DocumentsHeader: React.FC<DocumentsHeaderProps> = ({
    onInsert,
    onCreate,
    tableViewType,
    onTableViewTypeChange,
}) => {
    const { t } = useTranslation();
    const { numSelected, cancelSelection, isSelectAll, selectAllDocuments } =
        useDocumentsSelection();
    const { deleteDocuments } = useDocumentsActions();

    const tableViewTypes = [
        {
            icon: "table",
            label: t("documents.datatable-visual"),
            value: TableViewType.DatatableVisual,
        },
        {
            icon: "pi-table",
            label: t("documents.datatable-data"),
            value: TableViewType.DatatableData,
        },
        {
            icon: "pi-chart-bar",
            label: t("documents.chart"),
            value: TableViewType.DataChart,
            disabled: true,
        },
    ];

    const [confirmDeletionVisible, setConfirmDeletionVisible] = useState(false);

    const handleSetTableViewType = (e: DropdownChangeEvent) => {
        if (e.value !== null) {
            onTableViewTypeChange(e.value as TableViewType);
        }
    };

    const startContent = (
        <React.Fragment>
            <Button
                label={t("insert_document")}
                icon="pi pi-plus"
                outlined
                onClick={onInsert}
            />
            <i className="pi pi-bars p-toolbar-separator m-1" />
            <Dropdown
                value={tableViewType}
                onChange={handleSetTableViewType}
                options={tableViewTypes}
                optionLabel="label"
                optionValue="value"
            />
        </React.Fragment>
    );

    const centerContent = (
        <React.Fragment>
            <DocumentsSearchBar />
        </React.Fragment>
    );

    const endContent = (
        <React.Fragment>
            <div className="flex flex-column align-items-end">
                <div className="flex align-items-center gap-2">
                    <DocumentsActionsMenu />
                    <Button
                        icon="pi pi-trash"
                        className="p-button-rounded p-button-text"
                        severity={numSelected > 0 ? "danger" : "secondary"}
                        disabled={numSelected === 0}
                        onClick={() => setConfirmDeletionVisible(true)}
                        tooltip={t("Delete selected documents")}
                        tooltipOptions={{ position: "top", showDelay: 500 }}
                    />
                    <Button
                        icon="pi pi-expand"
                        className="p-button-rounded p-button-text"
                        severity={!isSelectAll ? "info" : "secondary"}
                        disabled={isSelectAll}
                        onClick={() => selectAllDocuments(true)}
                        tooltip={t(
                            "Select all documents that match the specified search criteria"
                        )}
                        tooltipOptions={{ position: "top", showDelay: 500 }}
                    />
                    <Button
                        icon="pi pi-times"
                        className="p-button-rounded p-button-text"
                        severity={numSelected > 0 ? "info" : "secondary"}
                        disabled={numSelected === 0}
                        onClick={cancelSelection}
                        tooltip={t("Cancel document selection")}
                        tooltipOptions={{ position: "top", showDelay: 500 }}
                    />
                    <ConfirmDialog
                        visible={confirmDeletionVisible}
                        onHide={() => setConfirmDeletionVisible(false)}
                        header={t("Delete documents")}
                        message={t(
                            "Are you sure you want to delete all selected documents?"
                        )}
                        icon="pi pi-exclamation-triangle"
                        acceptLabel={t("Delete")}
                        acceptClassName="p-button-danger"
                        rejectLabel={t("Cancel")}
                        accept={deleteDocuments}
                    />
                </div>
                <Badge
                    className="surface-50 text-gray-600"
                    value={`${t(
                        "Number of selected documents"
                    )}: ${numSelected}`}
                />
            </div>
        </React.Fragment>
    );

    return (
        <Toolbar start={startContent} center={centerContent} end={endContent} />
    );
};

export default DocumentsHeader;
