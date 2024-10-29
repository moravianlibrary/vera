import React, { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { useAddDocuments } from "../../../contexts/AddDocumentsContext";
import AddDocumentResponseStatus, {
    AddDocumentResponseErrorStatus,
    AddDocumentResponseInfoStatus,
    AddDocumentResponseSuccessStatus,
    AddDocumentResponseWarningStatus,
} from "../../../types/AddDocumentResponseStatus";
import {
    AddDocumentResponse,
    CatalogIssueResponse,
} from "../../../adapters/ApiDocuments";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import DocumentTypeTag from "../../../components/tags/DocumentTypeTag";
import { Message } from "primereact/message";
import { MessageSeverity } from "primereact/api";
import { formatDatetime } from "../../../data/factories/DateFactory";
import IssuanceTypeTag from "../../../components/tags/IssuanceTypeTag";
import DigitizationStateColumnBody from "../table_columns/DigitizationStateColumnBody";
import DigitizationStateTag from "../../../components/tags/DigitizationStateTag";
import ExternalLinkButton from "../../../components/buttons/ExternalLinkButton";
import LabeledComponent from "../../../components/wrappers/LabeledComponent";

interface AddDocumentsResultsProps {}

const AddDocumentsResults: React.FC<AddDocumentsResultsProps> = () => {
    const { t } = useTranslation("documents");
    const { statusBuckets } = useAddDocuments();
    const [showStatus, setShowStatus] =
        useState<AddDocumentResponseStatus | null>(null);

    const getResponseMessageSeverity = (status: AddDocumentResponseStatus) => {
        if (AddDocumentResponseErrorStatus.includes(status)) {
            return MessageSeverity.ERROR;
        } else if (AddDocumentResponseWarningStatus.includes(status)) {
            return MessageSeverity.WARN;
        } else if (AddDocumentResponseInfoStatus.includes(status)) {
            return MessageSeverity.INFO;
        } else if (AddDocumentResponseSuccessStatus.includes(status)) {
            return MessageSeverity.SUCCESS;
        }
        return MessageSeverity.SECONDARY;
    };

    if (showStatus === null) {
        return (
            <div className="flex flex-column gap-2">
                {statusBuckets.map((bucket, index) => (
                    <div
                        key={index}
                        className="flex justify-content-between align-items-center gap-2"
                    >
                        <Message
                            severity={getResponseMessageSeverity(
                                bucket.key as AddDocumentResponseStatus
                            )}
                            text={t(
                                `add-documents-response-status.${bucket.key}`,
                                {
                                    ns: "types",
                                    count: bucket.doc_count,
                                }
                            )}
                        />
                        <Button
                            outlined
                            icon="pi pi-chevron-right"
                            label={t("actions.show-response-status-details")}
                            onClick={() =>
                                setShowStatus(
                                    bucket.key as AddDocumentResponseStatus
                                )
                            }
                        />
                    </div>
                ))}
            </div>
        );
    }

    if (showStatus === AddDocumentResponseStatus.MultipleIssues) {
        return <MultipleIssuesResults goBack={() => setShowStatus(null)} />;
    }

    return (
        <StatusResults status={showStatus} goBack={() => setShowStatus(null)} />
    );
};

interface StatusResultsProps {
    status: AddDocumentResponseStatus;
    goBack: () => void;
}

const StatusResults: React.FC<StatusResultsProps> = ({ status, goBack }) => {
    const { t } = useTranslation("documents");
    const { getResponses } = useAddDocuments();

    const [responses, setResponses] = useState<AddDocumentResponse[]>([]);

    const showDocumentInfo = !AddDocumentResponseErrorStatus.includes(status);

    useEffect(() => {
        getResponses(status, 1, 500).then((responses) =>
            setResponses(responses)
        );
    }, []);

    const identifierTypeBody = (response: AddDocumentResponse) => {
        return t(`identifier-type.${response.attributes.identifier_type}`, {
            ns: "types",
        });
    };

    const documentTypeBody = (response: AddDocumentResponse) => {
        if (
            !response.document ||
            !response.document.issues ||
            response.document.issues.length !== 1
        ) {
            return null;
        }
        return (
            <DocumentTypeTag
                materialType={response.document.material_type}
                issuanceType={response.document.issues[0].issuance_type}
            />
        );
    };

    const documentDescriptionBody = (response: AddDocumentResponse) => {
        if (
            !response.document ||
            !response.document.issues ||
            response.document.issues.length !== 1
        ) {
            return null;
        }
        const issue = response.document.issues[0];
        return [issue.volume_year, issue.volume, issue.bundle]
            .filter((x) => x)
            .join(" ");
    };

    return (
        <DataTable
            value={responses}
            scrollable
            header={t(`add-documents-response-status.${status}`, {
                ns: "types",
                count: 1,
            })}
            scrollHeight="calc(100vh - 550px)"
            exportFilename="insert_documents_details"
            footer={
                <Button
                    outlined
                    icon="pi pi-chevron-left"
                    label={t("actions.go-back-to-responses-summary")}
                    onClick={goBack}
                />
            }
        >
            <Column
                field="attributes.identifier_type"
                header={t("add.attributes.identifier-type")}
                body={identifierTypeBody}
            />
            <Column
                field="attributes.value"
                header={t("add.attributes.value")}
            />
            <Column
                field="indexed_at"
                header={t("add.attributes.indexed-at")}
                body={(r) => formatDatetime(r.indexed_at)}
            />
            <Column
                field="type"
                header={t("add.attributes.type")}
                body={documentTypeBody}
                hidden={!showDocumentInfo}
            />
            <Column
                field="description"
                header={t("add.attributes.description")}
                body={documentDescriptionBody}
                hidden={!showDocumentInfo}
            />
            <Column
                field="barcode"
                header={t("add.attributes.barcode")}
                hidden={!showDocumentInfo}
            />
        </DataTable>
    );
};
interface MultipleIssuesResultsProps {
    goBack: () => void;
}

const MultipleIssuesResults: React.FC<MultipleIssuesResultsProps> = ({
    goBack,
}) => {
    const { t } = useTranslation("documents");
    const { getResponses } = useAddDocuments();

    const [response, setResponse] = useState<AddDocumentResponse>(undefined);
    const [issues, setIssues] = useState<CatalogIssueResponse[]>([]);
    const [hasVolumeYears, setHasVolumeYears] = useState<boolean>(false);
    const [hasVolumes, setHasVolumes] = useState<boolean>(false);
    const [hasBundles, setHasBundles] = useState<boolean>(false);

    useEffect(() => {
        getResponses(AddDocumentResponseStatus.MultipleIssues, 1, 500).then(
            (responses) => {
                setResponse(responses[0]);
                const issues = responses[0].document.issues;
                setIssues(issues);
                setHasVolumeYears(issues.some((i) => i.volume_year));
                setHasVolumes(issues.some((i) => i.volume));
                setHasBundles(issues.some((i) => i.bundle));
            }
        );
    }, []);

    const issuanceTypeGroupTemplate = (data) => {
        return (
            <LabeledComponent label={t("properties.issuance_type")}>
                <IssuanceTypeTag issuanceType={data.issuance_type} />
            </LabeledComponent>
        );
    };

    const digitizationStateBody = (data) => {
        return (
            <div className="flex">
                <DigitizationStateTag state={data.digitization_state} />
                {data.digitization_registry_id && (
                    <ExternalLinkButton.DigitizationRegistry
                        value={data.digitization_registry_id}
                        hideValue
                    />
                )}
            </div>
        );
    };

    return (
        <div>
            <DataTable
                value={issues}
                scrollable
                header={t("add-documents-response-status.MultipleIssues", {
                    ns: "types",
                    count: 1,
                })}
                scrollHeight="calc(100vh - 580px)"
                sortMode="single"
                sortField="issuance_type"
                rowGroupMode="subheader"
                groupRowsBy="issuance_type"
                rowGroupHeaderTemplate={issuanceTypeGroupTemplate}
                footer={
                    <Button
                        outlined
                        icon="pi pi-chevron-left"
                        label={t("actions.go-back-to-responses-summary")}
                        onClick={goBack}
                    />
                }
            >
                <Column field="barcode" header={t("add.attributes.barcode")} />
                <Column
                    field="volume_year"
                    header={t("add.attributes.volume-year")}
                    hidden={!hasVolumeYears}
                />
                <Column
                    field="volume"
                    header={t("add.attributes.volume")}
                    hidden={!hasVolumes}
                />
                <Column
                    field="bundle"
                    header={t("add.attributes.bundle")}
                    hidden={!hasBundles}
                />
                <Column
                    field="signature"
                    header={t("add.attributes.signature")}
                />
                <Column
                    field="digitization_state"
                    header={t("add.attributes.digitization-state")}
                    body={digitizationStateBody}
                />
                <Column
                    field="issue-state"
                    header={t("add.attributes.issue-state")}
                />
            </DataTable>
        </div>
    );
};

export default AddDocumentsResults;
