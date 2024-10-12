import { DataTable } from "primereact/datatable";
import React, { useState } from "react";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import { useDigitizationLists } from "../../contexts/DigitizationListsContext";
import ActionAccessComponent from "../../components/access/ActionAccessComponent";
import { ActionType } from "../../types/ActionType";
import DeleteButton from "../../components/buttons/DeleteButton";
import DataTablePaginator from "../../components/DataTablePaginator";
import { DigitizationList } from "../../adapters/ApiDigitizationLists";
import InternalLinkButton from "../../components/buttons/InternalLinkButton";
import { formatDatetime } from "../../data/factories/DateFactory";

interface DigitizationListsTableProps {}

const DigitizationListsTable: React.FC<DigitizationListsTableProps> & {
    Paginator: React.FC;
} = ({}) => {
    const { t } = useTranslation();

    const { digitizationLists, deleteDigitizationList } =
        useDigitizationLists();

    const documentsLink = (digitizationList: DigitizationList) => {
        return `/documents?digitizationListId=${digitizationList.id}`;
    };

    const categoriesLink = (digitizationList: DigitizationList) => {
        return `/categories?digitizationListId=${digitizationList.id}`;
    };

    return (
        <DataTable value={digitizationLists} scrollable scrollHeight="flex">
            <Column field="id" header={t("id")} />
            <Column field="created_by" header={t("Created by")} />
            <Column
                field="created_at"
                header={t("Created at")}
                body={(dl) => formatDatetime(dl.created_at)}
            />
            <Column field="page_count" header={t("Pages count")} />
            <Column
                field="documents_count"
                header={t("Documents count")}
                body={(dl) => dl.document_ids.length}
            />
            <Column field="intention_id" header={t("Intention")} />
            <Column
                body={(e) => (
                    <InternalLinkButton
                        label={t("Show in documents")}
                        link={documentsLink(e)}
                    />
                )}
            />
            <Column
                body={(e) => (
                    <InternalLinkButton
                        label={t("Show in categories")}
                        link={categoriesLink(e)}
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
    const { numFound, page, setPage, pageSize, setPageSize } =
        useDigitizationLists();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChangeNew={setPage}
            onPageSizeChange={setPageSize}
            numFoundText="digitization-lists.num-found"
        />
    );
};

DigitizationListsTable.Paginator = DigitizationListsTablePaginator;

export default DigitizationListsTable;
