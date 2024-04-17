import { DataTable } from "primereact/datatable";
import React from "react";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import { useDigitizationLists } from "../../contexts/extractions/DigitizationListsContext";
import DigitizationListModel from "../../contexts/extractions/DigitizationListModel";
import ActionAccessComponent from "../../components/ActionAccessComponent";
import { ActionType } from "../../types/ActionType";
import DeleteButton from "../../components/buttons/DeleteButton";

const DigitizationListsTable: React.FC = () => {
    const { t } = useTranslation();

    const { digitizationLists, deleteDigitizationList } =
        useDigitizationLists();

    const documentsButton = (digitizationList: DigitizationListModel) => {
        return (
            <Link to={`/documents?digitizationListId=${digitizationList.id}`}>
                <Button outlined label={t("Show in documents")} />
            </Link>
        );
    };

    const categoriesButton = (digitizationList: DigitizationListModel) => {
        return (
            <Link to={`/categories?digitizationListId=${digitizationList.id}`}>
                <Button outlined label={t("Show in categories")} />
            </Link>
        );
    };

    return (
        <DataTable value={digitizationLists}>
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

export default DigitizationListsTable;
