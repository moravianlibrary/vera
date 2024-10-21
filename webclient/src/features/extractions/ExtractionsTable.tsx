import { DataTable } from "primereact/datatable";
import React from "react";
import { useExtractions } from "../../contexts/GeneratedExtractionsContext";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import DeleteButton from "../../components/buttons/DeleteButton";
import { OwnedItemType, useAccess } from "../../contexts/AccessContext";
import DataTablePaginator from "../../components/views/DataTablePaginator";
import { ActionType } from "../../types/ActionType";
import InternalLinkButton from "../../components/buttons/InternalLinkButton";
import { formatDatetime } from "../../data/factories/DateFactory";

interface ExtractionsTableProps {}

const ExtractionsTable: React.FC<ExtractionsTableProps> & {
    Paginator: React.FC;
} = ({}) => {
    const { t } = useTranslation("extractions");
    const { hasPermission, hasOwnerPermission } = useAccess();

    const { extractions, deleteExtraction } = useExtractions();

    return (
        <DataTable value={extractions} scrollable scrollHeight="flex">
            <Column field="id" header={t("table.columns.id")} />
            <Column
                field="generated_by"
                header={t("table.columns.generated-by")}
            />
            <Column
                field="generated_at"
                header={t("table.columns.generated-at")}
                body={(e) => formatDatetime(e.generated_at)}
            />
            <Column
                field="target_pages"
                header={t("table.columns.target-page-count")}
            />
            <Column
                field="selected_pages"
                header={t("table.columns.selected-page-count")}
            />
            <Column
                field="documents_count"
                header={t("table.columns.documents-count")}
                body={(e) => e.document_ids.length}
            />
            <Column
                body={(e) => (
                    <InternalLinkButton.ShowInDocuments extraction={e} />
                )}
            />
            <Column
                body={(e) => (
                    <InternalLinkButton.ShowInCategories extraction={e} />
                )}
            />
            <Column
                body={(extraction) => (
                    <DeleteButton
                        itemId={extraction.id}
                        disabled={
                            !(
                                hasPermission(ActionType.AdminExtractions) ||
                                hasOwnerPermission(
                                    ActionType.Extract,
                                    OwnedItemType.Extraction,
                                    extraction
                                )
                            )
                        }
                        onDeleteItem={deleteExtraction}
                    />
                )}
            />
        </DataTable>
    );
};

const ExtractionsTablePaginator: React.FC = () => {
    const { t } = useTranslation("extractions");
    const { numFound, page, setPage, pageSize, setPageSize } = useExtractions();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChangeNew={setPage}
            onPageSizeChange={setPageSize}
            numFoundText={t("num-found", { count: numFound })}
        />
    );
};

ExtractionsTable.Paginator = ExtractionsTablePaginator;

export default ExtractionsTable;
