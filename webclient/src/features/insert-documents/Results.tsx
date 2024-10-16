import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import { DataTable, DataTableValueArray } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Column } from "primereact/column";
import {
    areOnlySuccessfulResults,
    getResultSeverity,
    messageSeverityToActionSeverity,
} from "./InsertDocumentsFunctions";
import AddDocumentResultsMessages from "./ResultsMessages";
import AddDocumentsSetPageCount from "./SetPageCount";
import { MaterialType } from "../../types/MaterialType";
import { IssuanceType } from "../../types/IssuanceType";
import AddDocumentResponseStatus from "../../types/AddDocumentResponseStatus";
import DocumentTypeColumnBody from "../documents/table_columns/DocumentTypeColumnBody";
import DescriptionColumnBody from "../documents/table_columns/DescriptionColumnBody";
import { Tag } from "primereact/tag";

interface InsertDocumentsResultProps {
    onClose: () => void;
}

const InsertDocumentsResult: React.FC<InsertDocumentsResultProps> = ({
    onClose,
}) => {
    const { t } = useTranslation();
    const { settings, goToPrevStep, responses, withoutPageCount } =
        useInsertDocuments();

    const [countdown, setCountdown] = useState(2);
    const [detailsVisible, setDetailsVisible] = useState(false);

    useEffect(() => {
        if (
            settings.insertAnother &&
            withoutPageCount.length === 0 &&
            areOnlySuccessfulResults(responses)
        ) {
            const timer = setInterval(() => {
                setCountdown((prevCountdown) => prevCountdown - 1);
            }, 1000);
        }
    }, [responses, settings, withoutPageCount]);

    useEffect(() => {
        if (countdown <= 0) {
            goToPrevStep();
        }
    }, [countdown]);

    const getInsertAnotherLabel = () => {
        return settings.insertAnother &&
            withoutPageCount.length === 0 &&
            areOnlySuccessfulResults(responses)
            ? `${t("documents.add.results.insert-another")} (${countdown}s)`
            : t("documents.add.results.insert-another");
    };

    return (
        <div className="flex flex-column gap-3">
            <AddDocumentResultsMessages />
            {withoutPageCount.length > 0 && <AddDocumentsSetPageCount />}
            <div className="flex justify-content-between gap-3">
                <Button
                    icon="pi pi-replay"
                    outlined
                    label={getInsertAnotherLabel()}
                    onClick={goToPrevStep}
                />
                <Button
                    icon="pi pi-question"
                    outlined
                    label={t("documents.add.results.show-details")}
                    onClick={() => setDetailsVisible(true)}
                />
                <Button
                    icon="pi pi-times"
                    iconPos="left"
                    outlined
                    label={t("documents.add.results.finish")}
                    onClick={onClose}
                />
                <Dialog
                    visible={detailsVisible}
                    onHide={() => setDetailsVisible(false)}
                >
                    <InsertResultDetails />
                </Dialog>
            </div>
        </div>
    );
};

interface InsertResultDetailsProps {}

interface AddDocumentDetails {
    sysno: string;
    material_type: MaterialType;
    issuance_type: IssuanceType;
    volume: string;
    volume_year: string;
    bundle: string;
    page_count: number;
    barcode: string;
    status: AddDocumentResponseStatus;
}

const InsertResultDetails: React.FC<InsertResultDetailsProps> = ({}) => {
    const { t } = useTranslation();
    const { responses } = useInsertDocuments();
    const datatableRef = useRef<DataTable<DataTableValueArray>>(null);

    const parseResponses = () => {
        return responses.flatMap((response) => {
            return (
                response.document?.issues.map((issue) => ({
                    ...issue,
                    ...response.document,
                    status: response.status,
                })) || []
            );
        });
    };

    const ResultBody = (document: AddDocumentDetails) => {
        const severity = getResultSeverity(document.status);
        return (
            <Tag
                value={t(`documents.add.results.status.${document.status}`)}
                severity={messageSeverityToActionSeverity(severity)}
            ></Tag>
        );
    };

    const exportCsv = () => {
        if (datatableRef.current) {
            datatableRef.current.exportCSV();
        }
    };

    const header = () => {
        return (
            <div className="flex flex-wrap align-items-center justify-content-between gap-2">
                <span className="text-900 font-bold">{t("Details")}</span>
                <Button icon="pi pi-download" raised onClick={exportCsv} />
            </div>
        );
    };

    return (
        <DataTable
            ref={datatableRef}
            value={parseResponses()}
            scrollable
            scrollHeight="calc(100vh - 290px)"
            header={header}
            exportFilename="insert_documents_details"
        >
            <Column field="sysno" header={t("System number")} />
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
            <Column field="barcode" header={t("Barcode")} />
            <Column
                field="result_localized"
                header={t("Result")}
                body={ResultBody}
            />
        </DataTable>
    );
};

export default InsertDocumentsResult;
