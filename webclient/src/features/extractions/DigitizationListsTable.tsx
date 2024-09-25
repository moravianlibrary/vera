import { DataTable } from "primereact/datatable";
import React, { useState } from "react";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import { useDigitizationLists } from "../../contexts/extractions/DigitizationListsContext";
import ActionAccessComponent from "../../components/access/ActionAccessComponent";
import { ActionType } from "../../types/ActionType";
import DeleteButton from "../../components/buttons/DeleteButton";
import { PaginatorPageChangeEvent } from "primereact/paginator";
import DataTablePaginator from "../../components/DataTablePaginator";
import { DigitizationList } from "../../adapters/ApiDigitizationLists";

const DigitizationListsTable: React.FC = () => {
    const { t } = useTranslation();

    const {
        digitizationLists,
        numFound,
        loadExtractions,
        deleteDigitizationList,
    } = useDigitizationLists();

    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(25);

    const documentsButton = (digitizationList: DigitizationList) => {
        return (
            <Link to={`/documents?digitizationListId=${digitizationList.id}`}>
                <Button outlined label={t("Show in documents")} />
            </Link>
        );
    };

    const categoriesButton = (digitizationList: DigitizationList) => {
        return (
            <Link to={`/categories?digitizationListId=${digitizationList.id}`}>
                <Button outlined label={t("Show in categories")} />
            </Link>
        );
    };

    const handlePageChange = (e: PaginatorPageChangeEvent) => {
        setOffset(e.first);
        setLimit(e.rows);
        loadExtractions(e.first, e.rows);
    };

    return (
        <div>
            <DataTable
                value={digitizationLists}
                scrollable
                scrollHeight="calc(100vh - 210px)"
            >
                <Column field="id" header={t("id")} />
                <Column field="extractor" header={t("Created by")} />
                <Column field="extracted_at" header={t("Created at")} />
                <Column field="extracted_pages" header={t("Pages count")} />
                <Column field="documents_count" header={t("Documents count")} />
                <Column field="intention_id" header={t("Intention")} />
                <Column body={documentsButton} />
                <Column body={categoriesButton} />
                <Column
                    body={(digitizationList) => (
                        <ActionAccessComponent
                            action={ActionType.AdminExtractions}
                        >
                            <DeleteButton
                                itemId={digitizationList.id}
                                onDeleteItem={deleteDigitizationList}
                            />
                        </ActionAccessComponent>
                    )}
                />
            </DataTable>
            <DataTablePaginator
                offset={offset}
                limit={limit}
                numFound={numFound}
                onPageChange={handlePageChange}
            />
        </div>
    );
};

export default DigitizationListsTable;
