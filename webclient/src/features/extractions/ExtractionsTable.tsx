import { DataTable } from "primereact/datatable";
import React from "react";
import { useExtractions } from "../../contexts/extractions/ExtractionsContext";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import ExtractionModel from "../../contexts/extractions/ExtractionModel";

const ExtractionsTable: React.FC = () => {
    const { t } = useTranslation();

    const { extractions } = useExtractions();

    const documentsButton = (extraction: ExtractionModel) => {
        return (
            <Link to={`/documents?extractionId=${extraction.id}`}>
                <Button
                    text
                    label={t("Show in documents")}
                />
            </Link>
        );
    };

    const categoriesButton = (extraction: ExtractionModel) => {
        return (
            <Link to={`/categories?extractionId=${extraction.id}`}>
                <Button
                    text
                    label={t("Show in categories")}
                />
            </Link>
        );
    };

    return (
        <DataTable
            value={extractions}
        >
            <Column field="id" header={t('id')} />
            <Column field="extractor" header={t('Extractor')} />
            <Column field='extracted_at' header={t('Extracted at')} />
            <Column field="target_pages" header={t('Target pages count')} />
            <Column field="documents_count" header={t('Documents count')} />
            <Column body={documentsButton} />
            <Column body={categoriesButton} />
        </DataTable>
    )
};

export default ExtractionsTable;
