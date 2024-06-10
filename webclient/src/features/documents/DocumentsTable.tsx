import {
    DataTable,
    DataTableSelectionMultipleChangeEvent,
    DataTableValueArray,
} from "primereact/datatable";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { useDocuments } from "../../contexts/documents/DocumentsContext";
import DocumentModel from "../../contexts/documents/DocumentModel";
import { ConfirmDialog } from "primereact/confirmdialog";
import { useToast } from "../../contexts/toast/ToastContext";
import { Dialog } from "primereact/dialog";
import { useDocumentsSelection } from "../../contexts/documents/DocumentsSelectionContext";
import { useDocumentsActions } from "../../contexts/documents/DocumentsActionsContext";
import DataTablePaginator from "../../components/DataTablePaginator";
import { PaginatorPageChangeEvent } from "primereact/paginator";
import AssignableCategoryPicker from "../../components/pickers/AssignableCategoryPicker";
import LabeledComponent from "../../components/LabeledComponent";
import { InputNumber } from "primereact/inputnumber";
import ApiDocuments from "../../adapters/ApiDocuments";
import ActionAccessComponent from "../../components/ActionAccessComponent";
import { ActionType } from "../../types/ActionType";
import { accessService } from "../../services/AccessService";

interface DocumentsTableProps {}

interface DocumentDetailsProps {
    document: DocumentModel;
}

interface DocumentDetailsBodyProps {
    document: DocumentModel;
}

const DocumentsTable: React.FC<DocumentsTableProps> = (props) => {
    const { t } = useTranslation();

    const { documents, numFound, offset, setOffset, limit, setLimit, refresh } =
        useDocuments();
    const { selectedDocuments, selectDocuments } = useDocumentsSelection();

    const handleSelectionChange = (
        event: DataTableSelectionMultipleChangeEvent<DataTableValueArray>
    ) => {
        const selectedDocuments: DocumentModel[] = event.value.map(
            (selectedItem) => {
                return selectedItem as DocumentModel;
            }
        );
        selectDocuments(selectedDocuments);
    };

    const handlePageChange = (e: PaginatorPageChangeEvent) => {
        if (e.first !== offset) {
            setOffset(e.first);
        }
        if (e.rows !== limit) {
            setLimit(e.rows);
        }
    };

    const pagesCountBody = (document: DocumentModel) => {
        const counts = [
            document.pages_count_catalog,
            document.pages_count_manual,
            document.pages_count_predicted,
        ].filter((x) => x);
        if (counts.length === 1) {
            return counts[0];
        } else if (counts.length === 0) {
            return null;
        }
        const countsJoined: string[] = [];
        if (document.pages_count_catalog) {
            countsJoined.push(
                `${t("from catalog")}: ${document.pages_count_catalog}`
            );
        }
        if (document.pages_count_manual) {
            countsJoined.push(
                `${t("set manually")}: ${document.pages_count_manual}`
            );
        }
        if (document.pages_count_predicted) {
            countsJoined.push(
                `${t("predicted")}: ${document.pages_count_predicted}`
            );
        }
        return countsJoined.join(", ");
    };

    const titleBody = (document: DocumentModel) => {
        const titleStyle: any = {
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
        };
        return (
            <span style={titleStyle} className="overflow-ellipsis">
                {document.title}
            </span>
        );
    };

    const typeBody = (document: DocumentModel) => {
        return document.issuance_type
            ? `${t(document.material_type)} - ${t(document.issuance_type)}`
            : t(document.material_type);
    };

    const descriptionBody = (document: DocumentModel) => {
        return [document.year, document.volume, document.bundle]
            .filter((x) => x)
            .join(" ");
    };

    return (
        <div>
            <DataTable
                className="documents-table"
                value={documents}
                scrollable
                scrollHeight="calc(100vh - 170px)"
                selectionMode="checkbox"
                selection={selectedDocuments}
                onSelectionChange={handleSelectionChange}
            >
                <Column
                    field="details"
                    body={(document) => (
                        <DocumentDetailsBody
                            key={document.id}
                            document={document}
                        />
                    )}
                />
                <Column field="sysno" header={t("sysno")} />
                <Column field="type" header={t("Type")} body={typeBody} />
                <Column
                    field="description"
                    header={t("Description")}
                    body={descriptionBody}
                />
                <Column field="category_name" header={t("category")} />
                <Column field="title" header={t("title")} body={titleBody} />
                <Column
                    field="pages_count"
                    body={pagesCountBody}
                    header={t("pages_count")}
                />
                <Column
                    className="pointer-events-none"
                    field="signature"
                    header={t("Signature")}
                />
                <Column field="barcode" header={t("Barcode")} />
                <Column field="cnb" header={t("CNB")} />
                <Column field="creator" header={t("creator")} />
                <Column field="created_at" header={t("created_at")} />

                <Column
                    selectionMode="multiple"
                    headerStyle={{ width: "3rem" }}
                />
            </DataTable>
            <DataTablePaginator
                offset={offset}
                limit={limit}
                numFound={numFound}
                onPageChange={handlePageChange}
                onRefresh={() => refresh()}
            />
        </div>
    );
};

const DocumentDetailsBody: React.FC<DocumentDetailsBodyProps> = ({
    document: doc,
}) => {
    const { t } = useTranslation();
    const { deleteDocument } = useDocumentsActions();

    const [documentId, setDocumentId] = useState<number>(doc.id);
    const [panelVisible, setPanelVisible] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [dialogPosition, setDialogPosition] = useState({ top: 0, left: 0 });

    const handleAcceptDelete = () => {
        setPanelVisible(false);
        deleteDocument(doc);
    };

    useEffect(() => {
        setPanelVisible(panelVisible && documentId === doc.id);
        setDocumentId(doc.id);
    }, [doc]);

    return (
        <div
            className="document-details-body flex"
            style={{ position: "relative" }}
        >
            <Button
                className="details-button"
                text={!panelVisible}
                onClick={() => setPanelVisible(!panelVisible)}
            >
                <i className="pi pi-book" />
            </Button>
            <Dialog
                id={`document-details-${doc.id}`}
                style={{
                    maxWidth: "600px",
                    marginLeft: "96px",
                    marginTop: "48px",
                    // top: dialogPosition.top,
                    // left: dialogPosition.left,
                }}
                visible={panelVisible}
                onHide={() => setPanelVisible(false)}
                modal={false}
                position="left"
                // minX={96}
                // minY={48}
            >
                <div className="flex flex-column gap-3 align-items-start">
                    {!editMode && (
                        <div>
                            {" "}
                            <DocumentDetailsTooltip document={doc} />
                            <div className="flex gap-3">
                                <Button
                                    icon="pi pi-trash"
                                    severity="danger"
                                    outlined
                                    label={t("Delete")}
                                    onClick={() => setConfirmVisible(true)}
                                />
                                <ActionAccessComponent
                                    evaluate={(user) =>
                                        accessService.isAllowedToEditDocument(
                                            user,
                                            doc
                                        )
                                    }
                                >
                                    <Button
                                        icon="pi pi-pencil"
                                        outlined
                                        label={t("Edit")}
                                        onClick={() => setEditMode(true)}
                                    />
                                </ActionAccessComponent>
                            </div>
                        </div>
                    )}
                    {editMode && (
                        <DocumentDetailsEditor
                            document={doc}
                            onEditComplete={() => setEditMode(false)}
                            onEditCancel={() => setEditMode(false)}
                        />
                    )}
                    <ConfirmDialog
                        // group="declarative"
                        visible={confirmVisible}
                        onHide={() => setConfirmVisible(false)}
                        header={t("Delete document")}
                        message={t(
                            "Are you sure you want to delete this document?"
                        )}
                        icon="pi pi-exclamation-triangle"
                        acceptLabel={t("Delete")}
                        acceptClassName="p-button-danger"
                        rejectLabel={t("Cancel")}
                        accept={handleAcceptDelete}
                    />
                </div>
            </Dialog>
        </div>
    );
};

const DocumentDetailsTooltip: React.FC<DocumentDetailsProps> = ({
    document,
}) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const copyToClipboard = (value: string) => {
        navigator.clipboard.writeText(value);
        showToast("info", t("Copied to clipboard"), "");
    };

    return (
        <div className="flex flex-column gap-1">
            {document.getTooltipFieldList(t).map((field) => {
                return (
                    <div
                        key={field.label}
                        className="flex justify-content-between gap-5 m-1"
                    >
                        <label>{t(field.label)}:</label>
                        <div className="flex gap-1">
                            <span className="p-0 max-w-23rem">
                                {field.value as string}
                            </span>
                            {field.uri && (
                                <Button
                                    className="p-0 text-xs align-content-center"
                                    severity="info"
                                    text
                                    onClick={() =>
                                        window.open(
                                            field.uri as string,
                                            "_blank"
                                        )
                                    }
                                >
                                    <i className="pi pi-external-link p-0" />
                                </Button>
                            )}
                            <Button
                                className="p-0 text-xs align-content-center"
                                severity="info"
                                text
                                onClick={() =>
                                    copyToClipboard(field.value as string)
                                }
                            >
                                <i className="pi pi-copy p-0" />
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

interface DocumentDetailsEditorProps {
    document: DocumentModel;
    onEditComplete: () => void;
    onEditCancel: () => void;
}

const DocumentDetailsEditor: React.FC<DocumentDetailsEditorProps> = ({
    document,
    onEditComplete,
    onEditCancel,
}) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { refreshDocumentsInResults } = useDocuments();

    const [categoryId, setCategoryId] = useState<number | null>(
        document.category_id
    );
    const [pagesCount, setPagesCount] = useState<number | null>(
        document.pages_count_manual
    );

    const handleUpdateDocument = () => {
        if (categoryId) {
            const updateDocument = {
                ...document,
                category_id: categoryId,
                pages_count_manual: pagesCount,
            };
            ApiDocuments.updateDocument(updateDocument)
                .then((response) => {
                    refreshDocumentsInResults([
                        new DocumentModel(response.data),
                    ]);
                    showToast(
                        "success",
                        t("Document updated successfully"),
                        ""
                    );
                })
                .catch((error) => {
                    showToast(
                        "error",
                        t("Document update failed"),
                        error.message
                    );
                });
            onEditComplete();
        }
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="flex flex-column gap-1">
                <LabeledComponent
                    label={t("Category")}
                    className="justify-content-between"
                >
                    <AssignableCategoryPicker
                        category_id={categoryId}
                        callback={setCategoryId}
                    />
                </LabeledComponent>
                <LabeledComponent
                    label={t("Pages count")}
                    className="justify-content-between"
                >
                    <InputNumber
                        value={pagesCount}
                        onChange={(e) => setPagesCount(e.value)}
                    />
                </LabeledComponent>
            </div>
            <div className="flex gap-3">
                <Button
                    className="p-button-success"
                    outlined
                    label={t("Save")}
                    onClick={handleUpdateDocument}
                />
                <Button
                    className="p-button-danger"
                    outlined
                    label={t("Cancel")}
                    onClick={() => onEditCancel()}
                />
            </div>
        </div>
    );
};

export default DocumentsTable;
