import { Messages } from "primereact/messages";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import { DataTable, DataTableValueArray } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Column } from "primereact/column";
import { Tag } from "primereact/tag";
import {
    InsertResultDetail,
    getResultSeverity,
    getResultSummary,
    getResultsDetails,
    isSingleSuccessfulResult,
    parseResultsToLocalizedMessages,
} from "./InsertDocumentsFunctions";
import { DocumentCreationResponse } from "../../adapters/ApiDocuments";

interface InsertDocumentsResultProps {
    onRestart: () => void;
    onClose: () => void;
}

const InsertDocumentsResult: React.FC<InsertDocumentsResultProps> = (props) => {
    const { t } = useTranslation();
    const { insertAnother, results } = useInsertDocuments();

    const messages = useRef<Messages>(null);
    const [countdown, setCountdown] = useState(3);
    const [detailsVisible, setDetailsVisible] = useState(false);

    useEffect(() => {
        if (messages.current) {
            messages.current.clear();
            messages.current.show(parseResultsToLocalizedMessages(t, results));
        }
        if (insertAnother && isSingleSuccessfulResult(results)) {
            const timer = setInterval(() => {
                setCountdown((prevCountdown) => prevCountdown - 1);
            }, 1000);
        }
    }, [results, insertAnother]);

    useEffect(() => {
        if (countdown <= 0) {
            props.onRestart();
        }
    }, [countdown]);

    const getInsertAnotherLabel = () => {
        return insertAnother && isSingleSuccessfulResult(results)
            ? `${t("insert_another")} (${countdown}s)`
            : t("insert_another");
    };

    return (
        <div>
            <Messages ref={messages} />
            <div className="flex justify-content-between gap-3">
                <Button
                    icon="pi pi-replay"
                    outlined
                    label={getInsertAnotherLabel()}
                    onClick={() => props.onRestart()}
                />
                <Button
                    icon="pi pi-question"
                    outlined
                    label={t("details")}
                    onClick={() => setDetailsVisible(true)}
                />
                <Button
                    icon="pi pi-times"
                    iconPos="left"
                    outlined
                    label={t("finish")}
                    onClick={() => props.onClose()}
                />
                <Dialog
                    visible={detailsVisible}
                    onHide={() => setDetailsVisible(false)}
                >
                    <InsertResultDetails results={results} />
                </Dialog>
            </div>
        </div>
    );
};

interface InsertResultDetailsProps {
    results: DocumentCreationResponse[];
}

const InsertResultDetails: React.FC<InsertResultDetailsProps> = ({
    results,
}) => {
    const { t } = useTranslation();
    const datatableRef = useRef<DataTable<DataTableValueArray>>(null);

    const descriptionBody = (document: InsertResultDetail) => {
        return document.description;
    };

    const resultBody = (document: InsertResultDetail) => {
        const severity = getResultSeverity(document.result);
        return (
            <Tag
                value={document.result_localized}
                severity={
                    severity === "warn"
                        ? "warning"
                        : severity === "error"
                        ? "danger"
                        : severity
                }
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
            value={getResultsDetails(t, results)}
            scrollable
            scrollHeight="calc(100vh - 290px)"
            header={header}
            exportFilename="insert_documents_details"
        >
            <Column field="sysno" header={t("System number")} />
            <Column field="type" header={t("Type")} />
            <Column
                field="description"
                header={t("Description")}
                body={descriptionBody}
            />
            <Column field="barcode" header={t("Barcode")} />
            <Column
                field="result_localized"
                header={t("Result")}
                body={resultBody}
            />
        </DataTable>
    );
};

export default InsertDocumentsResult;
