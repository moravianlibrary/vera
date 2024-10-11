import { Messages, MessagesMessage } from "primereact/messages";
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
    areOnlySuccessfulResults,
    getResultSeverity,
    isSingleSuccessfulResult,
    messageSeverityToActionSeverity,
    parseResultsToLocalizedMessages,
} from "./InsertDocumentsFunctions";
import {
    AddDocumentResponse,
    CatalogDocumentResponse,
    CatalogIssueResponse,
    Document,
} from "../../adapters/ApiDocuments";
import { InputNumber } from "primereact/inputnumber";
import AddDocumentResultsMessages from "./ResultsMessages";
import AddDocumentsSetPageCount from "./SetPageCount";

interface InsertDocumentsResultProps {
    onRestart: () => void;
    onClose: () => void;
}

const InsertDocumentsResult: React.FC<InsertDocumentsResultProps> = (props) => {
    const { t } = useTranslation();
    const { settings, responses, withoutPageCount } = useInsertDocuments();

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
            props.onRestart();
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
                    onClick={() => props.onRestart()}
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
                    onClick={() => props.onClose()}
                />
                <Dialog
                    visible={detailsVisible}
                    onHide={() => setDetailsVisible(false)}
                >
                    {/* <InsertResultDetails results={results} /> */}
                </Dialog>
            </div>
        </div>
    );
};

interface InsertResultDetailsProps {
    results: AddDocumentResponse[];
}

const InsertResultDetails: React.FC<InsertResultDetailsProps> = ({
    results,
}) => {
    const { t } = useTranslation();
    const datatableRef = useRef<DataTable<DataTableValueArray>>(null);

    // const descriptionBody = (document: InsertResultDetail) => {
    //     return document.description;
    // };

    // const resultBody = (document: InsertResultDetail) => {
    //     const severity = getResultSeverity(document.result);
    //     return (
    //         <Tag
    //             value={document.result_localized}
    //             severity={messageSeverityToActionSeverity(severity)}
    //         ></Tag>
    //     );
    // };

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
            // value={getResultsDetails(t, results)}
            scrollable
            scrollHeight="calc(100vh - 290px)"
            header={header}
            exportFilename="insert_documents_details"
        >
            <Column field="sysno" header={t("System number")} />
            <Column field="type" header={t("Type")} />
            {/* <Column
                field="description"
                header={t("Description")}
                body={descriptionBody}
            /> */}
            <Column field="barcode" header={t("Barcode")} />
            {/* <Column
                field="result_localized"
                header={t("Result")}
                body={resultBody}
            /> */}
        </DataTable>
    );
};

export default InsertDocumentsResult;
