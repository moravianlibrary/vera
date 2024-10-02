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
import { useToast } from "../../contexts/ToastContext";
import { Dialog } from "primereact/dialog";
import { useDocumentsSelection } from "../../contexts/documents/DocumentsSelectionContext";
import DataTablePaginator from "../../components/DataTablePaginator";
import AssignableCategoryPicker from "../../components/pickers/AssignableCategoryPicker";
import LabeledComponent from "../../components/LabeledComponent";
import { InputNumber } from "primereact/inputnumber";
import ApiDocuments, { IndexDocument } from "../../adapters/ApiDocuments";
import { TableViewType } from "./DocumentsHeader";
import ApiCatalogRecords, {
    Marc21DiffRecord,
} from "../../adapters/ApiCatalogRecords";
import MarcRecordsDiffView from "../../components/views/MarcRecordsDiffView";
import { ActionType } from "../../types/ActionType";
import {
    useHitsPerPage,
    useInstantSearch,
    usePagination,
} from "react-instantsearch";
import DigitizationStateColumnBody from "./table_columns/DigitizationStateColumnBody";
import DescriptionColumnBody from "./table_columns/DescriptionColumnBody";
import PageCountColumnBody from "./table_columns/PageCountColumnBody";
import TitleColumnBody from "./table_columns/TitleColumnBody";
import DocumentTypeColumnBody from "./table_columns/DocumentTypeColumnBody";
import CategoryColumnBody from "./table_columns/CategoryColumnBody";
import DocumentDetails from "./DocumentDetailsDialog";
import DocumentDetailsColumnBody from "./table_columns/DocumentDetailsColumnBody";
import DocumentStateColumnBody from "./table_columns/DocumentStateColumnBody";
import ExtractionPriorityColumnBody from "./table_columns/ExtractionPriorityColumnBody";

// TODO: move
function isAllowedToEditDocument(user, document) {
    return (
        user &&
        user.actions &&
        (user.actions.includes(ActionType.EditDatatableAll) ||
            (user.actions.includes(ActionType.EditDatatableDepartment) &&
                user.department_id === document.creator_department_id) ||
            (user.actions.includes(ActionType.EditDatatableOwn) &&
                user.id === document.creator_id))
    );
}

interface DocumentsTableProps {
    tableViewType: TableViewType;
}

interface DocumentDetailsBodyProps {
    document: DocumentModel;
}

const DocumentsTable: React.FC<DocumentsTableProps> & {
    Paginator: React.FC;
} = ({ tableViewType }) => {
    const { t } = useTranslation();

    const { results, refresh } = useInstantSearch();
    const { currentRefinement, nbHits, refine: setPage } = usePagination();
    const { items: pageSizeOptions, refine: setPageSize } = useHitsPerPage({
        items: [
            { value: 10, label: "10" },
            { value: 15, label: "15" },
            { value: 20, label: "20", default: true },
            { value: 25, label: "25" },
            { value: 50, label: "50" },
            { value: 100, label: "100" },
        ],
    });

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

    if (tableViewType === TableViewType.DatatableVisual) {
        return (
            <DataTable
                value={results.hits}
                scrollable
                scrollHeight="flex"
                selectionMode="checkbox"
                selection={selectedDocuments}
                onSelectionChange={handleSelectionChange}
            >
                <Column field="details" body={DocumentDetailsColumnBody} />

                <Column
                    field="category_path"
                    header={t("category")}
                    body={CategoryColumnBody}
                />
                <Column
                    field="type"
                    header={t("Type")}
                    body={DocumentTypeColumnBody}
                />
                <Column
                    field="title"
                    header={t("title")}
                    body={TitleColumnBody}
                />
                <Column
                    field="description"
                    header={t("Description")}
                    body={DescriptionColumnBody}
                />
                <Column
                    field="pages_count"
                    body={PageCountColumnBody}
                    header={t("pages_count")}
                />
                <Column
                    field="digitization_state"
                    header={t("Digitization state")}
                    body={DigitizationStateColumnBody}
                />
                <Column
                    field="extraction_priority"
                    header={t("Extraction priority")}
                    body={ExtractionPriorityColumnBody}
                />
                <Column
                    field="extractable"
                    header={t("documents.table.extraction")}
                    body={DocumentStateColumnBody}
                />
                <Column field="added_by" header={t("creator")} />

                <Column
                    selectionMode="multiple"
                    headerStyle={{ width: "3rem" }}
                />
            </DataTable>
        );
    }

    return (
        <DataTable
            value={results.hits}
            scrollable
            scrollHeight="flex"
            selectionMode="checkbox"
            selection={selectedDocuments}
            onSelectionChange={handleSelectionChange}
        >
            {/* <Column
                    field="details"
                    body={(document) => (
                        <DocumentDetailsBody
                            key={document.id}
                            document={document}
                        />
                    )}
                /> */}

            <Column field="sysno" header={t("sysno")} />
            <Column
                field="type"
                header={t("Type")}
                body={DocumentTypeColumnBody}
            />
            <Column
                field="description"
                header={t("Description")}
                body={DescriptionColumnBody}
            />
            <Column field="category_name" header={t("category")} />
            <Column field="title" header={t("title")} body={TitleColumnBody} />
            <Column
                field="pages_count"
                body={PageCountColumnBody}
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

            <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
        </DataTable>
    );
};

const DocumentsTablePaginator: React.FC = () => {
    const { results, refresh } = useInstantSearch();
    const { currentRefinement, nbHits, refine: setPage } = usePagination();
    const { items: pageSizeOptions, refine: setPageSize } = useHitsPerPage({
        items: [
            { value: 10, label: "10" },
            { value: 15, label: "15" },
            { value: 20, label: "20", default: true },
            { value: 25, label: "25" },
            { value: 50, label: "50" },
            { value: 100, label: "100" },
        ],
    });

    return (
        <DataTablePaginator
            numFound={nbHits}
            page={currentRefinement + 1}
            pageSize={results.hitsPerPage}
            onPageChangeNew={(page) => setPage(page - 1)}
            onPageSizeChange={setPageSize}
            onRefresh={refresh}
            numFoundText="documents.numFound"
        />
    );
};

DocumentsTable.Paginator = DocumentsTablePaginator;

const DocumentDetailsTooltip: React.FC<DocumentDetailsBodyProps> = ({
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

const CatalogsFunctionality: React.FC<DocumentDetailsBodyProps> = ({
    document,
}) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const [diffRecord, setDiffRecord] = useState<Marc21DiffRecord | null>(null);
    const [record2Name, setRecord2Name] = useState<string>(
        t("catalog.record.skc")
    );

    const loadMzkSkcDiffRecord = () => {
        // ApiCatalogRecords.getMzkSkcDiff(document.sysno)
        //     .then((response) => {
        //         setDiffRecord(response.data);
        //         setRecord2Name(t("catalog.record.skc"));
        //     })
        //     .catch((error) => {
        //         if (error.response.status === 404) {
        //             showToast("warn", t("catalog.record.skc-not-found"), "");
        //         } else {
        //             console.error(error);
        //         }
        //     });
    };

    const loadMzkCnbDiffRecord = () => {
        // ApiCatalogRecords.getMzkCnbDiff(document.sysno)
        //     .then((response) => {
        //         setDiffRecord(response.data);
        //         setRecord2Name(t("catalog.record.cnb"));
        //     })
        //     .catch((error) => {
        //         if (error.response.status === 404) {
        //             showToast("warn", t("catalog.record.cnb-not-found"), "");
        //         } else {
        //             console.error(error);
        //         }
        //     });
    };

    return (
        <div className="flex flex-column gap-1">
            <Dialog visible={!!diffRecord} onHide={() => setDiffRecord(null)}>
                <MarcRecordsDiffView
                    record1Label={t("catalog.record.mzk")}
                    record2Label={record2Name}
                    diffRecord={diffRecord}
                />
            </Dialog>
            <Button
                severity="info"
                outlined
                label={t("document.record.diff-mzk-skc")}
                onClick={loadMzkSkcDiffRecord}
            />
            <Button
                severity="info"
                outlined
                label={t("document.record.diff-mzk-cnb")}
                onClick={loadMzkCnbDiffRecord}
            />
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
