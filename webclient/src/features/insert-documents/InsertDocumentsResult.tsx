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
    InsertResultDetail,
    getResultSeverity,
    getResultsDetails,
    isSingleSuccessfulResult,
    messageSeverityToActionSeverity,
    parseResultsToLocalizedMessages,
} from "./InsertDocumentsFunctions";
import { DocumentCreationResponse } from "../../adapters/ApiDocuments";
import { Document } from "../../adapters/ApiDocuments";
import { InputNumber } from "primereact/inputnumber";

interface InsertDocumentsResultProps {
    onRestart: () => void;
    onClose: () => void;
}

const InsertDocumentsResult: React.FC<InsertDocumentsResultProps> = (props) => {
    const { t } = useTranslation();
    const { insertAnother, results, withoutPagesCount } = useInsertDocuments();

    const messages = useRef<Messages>(null);
    const [countdown, setCountdown] = useState(3);
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [withoutPagesCountVisible, setWithoutPagesCountVisible] =
        useState(false);

    useEffect(() => {
        if (messages.current) {
            const displayMessages: MessagesMessage[] =
                parseResultsToLocalizedMessages(t, results);
            if (messages.current && withoutPagesCount.length > 0) {
                displayMessages.push({
                    severity: "warn",
                    summary: `${t("Documents without pages count")}: ${
                        withoutPagesCount.length
                    }`,
                    sticky: true,
                    closable: false,
                });
            }
            messages.current.replace(displayMessages);
        }

        if (
            insertAnother &&
            withoutPagesCount.length === 0 &&
            isSingleSuccessfulResult(results)
        ) {
            const timer = setInterval(() => {
                setCountdown((prevCountdown) => prevCountdown - 1);
            }, 1000);
        }
    }, [results, insertAnother, withoutPagesCount]);

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
            {withoutPagesCount.length > 0 && (
                <Button
                    className="mb-3 w-full"
                    severity="warning"
                    icon="pi pi-pencil"
                    outlined
                    label={t("Set pages count manually")}
                    onClick={() => setWithoutPagesCountVisible(true)}
                />
            )}
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
                <Dialog
                    visible={withoutPagesCountVisible}
                    onHide={() => setWithoutPagesCountVisible(false)}
                    header={t("Set pages count manually")}
                >
                    <AddPagesCountManually
                        withoutPagesCount={withoutPagesCount}
                        onClose={() => setWithoutPagesCountVisible(false)}
                    />
                </Dialog>
            </div>
        </div>
    );
};

interface AddPagesCountManuallyProps {
    withoutPagesCount: Document[];
    onClose: () => void;
}

const AddPagesCountManually: React.FC<AddPagesCountManuallyProps> = ({
    withoutPagesCount,
    onClose,
}) => {
    const { t } = useTranslation();
    const { handleSetPagesCount } = useInsertDocuments();

    const [documents, setDocuments] = useState<Document[]>([]);
    const [index, setIndex] = useState(0);
    const [pagesCount, setPagesCount] = useState<number | null>(null);

    useEffect(() => {
        setDocuments([...withoutPagesCount]);
    }, []);

    const typeBody = (document: Document) => {
        return document.issuance_type
            ? `${t(document.material_type)} - ${t(document.issuance_type)}`
            : t(document.material_type);
    };

    const descriptionBody = (document: Document) => {
        return [document.year, document.volume, document.bundle];
    };

    const handleAcceptInput = () => {
        if (pagesCount) {
            handleSetPagesCount(documents[index], pagesCount);
        }
        if (index < documents.length - 1) {
            setIndex(index + 1);
            setPagesCount(null);
        } else {
            onClose();
        }
    };

    const handleKeyPress = (event) => {
        if (event.key === "Enter") {
            handleAcceptInput();
        }
    };

    const pagesCountBody = () => {
        return (
            <InputNumber
                className="w-8rem"
                autoFocus
                value={pagesCount}
                onChange={(e) => setPagesCount(e.value)}
                onKeyDown={handleKeyPress}
                min={1}
                max={100000}
                maxFractionDigits={0}
            />
        );
    };

    const getGoNextLabel = () => {
        if (index === documents.length - 1) {
            return t("Set pages count");
        } else {
            return t("Set pages count and go to next document");
        }
    };

    if (documents.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-column align-items-end gap-2">
            <DataTable
                value={[documents[index]]}
                scrollable
                scrollHeight="calc(100vh - 290px)"
            >
                <Column field="sysno" header={t("System number")} />
                <Column field="type" header={t("Type")} body={typeBody} />
                <Column
                    field="description"
                    header={t("Description")}
                    body={descriptionBody}
                />
                <Column field="barcode" header={t("Barcode")} />
                <Column
                    field="pages_count_manually"
                    header={t("Pages count")}
                    body={pagesCountBody}
                />
            </DataTable>
            <Button
                outlined
                label={getGoNextLabel()}
                onClick={() => handleAcceptInput()}
            />
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
function truncateText(title: string) {
    throw new Error("Function not implemented.");
}
