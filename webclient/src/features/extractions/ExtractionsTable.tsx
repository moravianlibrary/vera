import { DataTable } from "primereact/datatable";
import React from "react";
import { useExtractions } from "../../contexts/extractions/ExtractionsContext";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";

const ExtractionsTable: React.FC = () => {
    const { t } = useTranslation();

    const { extractions } = useExtractions();

    const categoriesButton = () => {
        return (
            <Button
                text
                label={t("Show in categories")}
            />
        );
    }

    return (
        <DataTable
            value={extractions}
        >
            <Column field="id" header={t('id')} />
            <Column field="extractor" header={t('Extractor')} />
            <Column field='extracted_at' header={t('Extracted at')} />
            <Column field="documents_count" header={t('Documents count')} />
            <Column body={categoriesButton} />
        </DataTable>
    )
};

export default ExtractionsTable;
