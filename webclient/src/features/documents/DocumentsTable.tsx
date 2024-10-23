import { DataTable } from "primereact/datatable";
import React from "react";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import DataTablePaginator from "../../components/views/DataTablePaginator";
import DigitizationStateColumnBody from "./table_columns/DigitizationStateColumnBody";
import DescriptionColumnBody from "./table_columns/DescriptionColumnBody";
import PageCountColumnBody from "./table_columns/PageCountColumnBody";
import TitleColumnBody from "./table_columns/TitleColumnBody";
import DocumentTypeColumnBody from "./table_columns/DocumentTypeColumnBody";
import CategoryColumnBody from "./table_columns/CategoryColumnBody";
import DocumentDetailsColumnBody from "./table_columns/DocumentDetailsColumnBody";
import DocumentStateColumnBody from "./table_columns/DocumentFlagsColumnBody";
import ExtractionPriorityColumnBody from "./table_columns/ExtractionPriorityColumnBody";
import { useDocuments } from "../../contexts/DocumentsContext";

interface DocumentsTableProps {}

const DocumentsTable: React.FC<DocumentsTableProps> & {
    Paginator: React.FC;
} = ({}) => {
    const { t } = useTranslation("documents");
    const { items, currentPageSelected, handleDataTableSelectionChange } =
        useDocuments();

    return (
        <DataTable
            value={items}
            scrollable
            scrollHeight="flex"
            dataKey={"id"}
            selectionMode="checkbox"
            selection={currentPageSelected}
            onSelectionChange={handleDataTableSelectionChange}
        >
            <Column field="details" body={DocumentDetailsColumnBody} />

            <Column
                field="category_path"
                header={t("table.columns.category")}
                body={CategoryColumnBody}
            />
            <Column
                field="type"
                header={t("table.columns.type")}
                body={DocumentTypeColumnBody}
            />
            <Column
                field="title"
                header={t("table.columns.title")}
                body={TitleColumnBody}
            />
            <Column
                field="description"
                header={t("table.columns.description")}
                body={DescriptionColumnBody}
            />
            <Column
                field="pages_count"
                body={PageCountColumnBody}
                header={t("table.columns.page-count")}
            />
            <Column
                field="digitization_state"
                header={t("table.columns.digitization-state")}
                body={DigitizationStateColumnBody}
            />
            <Column
                field="extraction_priority"
                header={t("table.columns.extraction-priority")}
                body={ExtractionPriorityColumnBody}
            />
            <Column
                field="document_flags"
                header={t("table.columns.document-flags")}
                body={DocumentStateColumnBody}
            />
            <Column field="added_by" header={t("table.columns.added-by")} />

            <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
        </DataTable>
    );
};

const DocumentsTablePaginator: React.FC = () => {
    const { t } = useTranslation("documents");
    const { numFound, refresh, page, setPage, pageSize, setPageSize } =
        useDocuments();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChangeNew={setPage}
            onPageSizeChange={setPageSize}
            onRefresh={refresh}
            numFoundText={t("num-found", { count: numFound })}
        />
    );
};

DocumentsTable.Paginator = DocumentsTablePaginator;

export default DocumentsTable;
