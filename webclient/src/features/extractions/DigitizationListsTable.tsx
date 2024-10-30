import { DataTable } from "primereact/datatable";
import React from "react";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { useDigitizationLists } from "../../contexts/DigitizationListsContext";
import ActionAccessComponent from "../../components/access/ActionAccessComponent";
import { ActionType } from "../../types/ActionType";
import DeleteButton from "../../components/buttons/DeleteButton";
import DataTablePaginator from "../../components/views/DataTablePaginator";
import InternalLinkButton from "../../components/buttons/InternalLinkButton";
import { formatDatetime } from "../../data/factories/DateFactory";

interface DigitizationListsTableProps {}

const DigitizationListsTable: React.FC<DigitizationListsTableProps> & {
    Paginator: React.FC;
} = ({}) => {
    const { t } = useTranslation("digitization-lists");

    const { digitizationLists, deleteDigitizationList } =
        useDigitizationLists();

    return (
        <DataTable value={digitizationLists} scrollable scrollHeight="flex">
            <Column field="id" header={t("table.columns.id")} />
            <Column field="created_by" header={t("table.columns.created-by")} />
            <Column
                field="created_at"
                header={t("table.columns.created-at")}
                body={(dl) => formatDatetime(dl.created_at)}
            />
            <Column field="page_count" header={t("table.columns.page-count")} />
            <Column
                field="documents_count"
                header={t("table.columns.documents-count")}
                body={(dl) => dl.document_ids.length}
            />
            <Column
                field="intention_id"
                header={t("table.columns.intention")}
            />
            <Column
                body={(dl) => (
                    <InternalLinkButton.ShowInDocuments digitizationList={dl} />
                )}
            />
            <Column
                body={(dl) => (
                    <InternalLinkButton.ShowInCategories
                        digitizationList={dl}
                    />
                )}
            />
            <Column
                body={(digitizationList) => (
                    <ActionAccessComponent action={ActionType.AdminExtractions}>
                        <DeleteButton
                            itemId={digitizationList.id}
                            onDeleteItem={deleteDigitizationList}
                        />
                    </ActionAccessComponent>
                )}
            />
        </DataTable>
    );
};

const DigitizationListsTablePaginator: React.FC = () => {
    const { t } = useTranslation("digitization-lists");
    const { numFound, page, setPage, pageSize, setPageSize } =
        useDigitizationLists();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            numFoundText={t("num-found", { count: numFound })}
        />
    );
};

DigitizationListsTable.Paginator = DigitizationListsTablePaginator;

export default DigitizationListsTable;
