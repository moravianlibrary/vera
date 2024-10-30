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
import { Message } from "primereact/message";
import { MessageSeverity } from "primereact/api";
import IssuanceTypeTag from "../../../components/tags/IssuanceTypeTag";
import DigitizationStateTag from "../../../components/tags/DigitizationStateTag";
import ExternalLinkButton from "../../../components/buttons/ExternalLinkButton";
import LabeledComponent from "../../../components/wrappers/LabeledComponent";
import MaterialTypeTag from "../../../components/tags/MaterialTypeTag";
import { Tag } from "primereact/tag";
import InternalLinkButton from "../../../components/buttons/InternalLinkButton";
import { DigitizationState } from "../../../types/DigitizationState";
import { formatDatetime } from "../../../data/factories/DateFactory";
import { ProgressSpinner } from "primereact/progressspinner";
import DataTablePaginator from "../../../components/views/DataTablePaginator";

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
    const { getResponses, addDocumentIssue } = useAddDocuments();

    const [responses, setResponses] = useState<AddDocumentResponse[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(1);
    const [issues, setIssues] = useState<CatalogIssueResponse[]>([]);

    const fetch = (page: number, pageSize: number) => {
        getResponses(status, page, pageSize).then((data) => {
            const responses = data[0];
            setResponses(responses);
            setNumFound(data[1]);
            responses.forEach((response) => {
                if (response.document) {
                    response.document.parentResponse = response;
                    response.document.issues.forEach((issue) => {
                        issue.parentDocument = response.document;
                    });
                }
            });
            setIssues(
                responses.flatMap((response) => response.document?.issues || [])
            );
        });
    };

    const refresh = () => {
        fetch(page, pageSize);
    };

    useEffect(() => {
        fetch(page, pageSize);
    }, [page, pageSize]);

    const paginator = (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[1, 5, 10, 50]}
            leftContent={
                <Button
                    outlined
                    icon="pi pi-chevron-left"
                    label={t("actions.go-back-to-responses-summary")}
                    onClick={goBack}
                />
            }
            onRefresh={refresh}
        />
    );

    const identifierValue = (response: AddDocumentResponse) => {
        return t(`identifier-type.${response.attributes.identifier_type}`, {
            ns: "types",
        });
    };

    if (issues.length === 0) {
        return (
            <div>
                <DataTable
                    value={responses}
                    scrollable
                    scrollHeight="50vh"
                    header={t(`add-documents-response-status.${status}`, {
                        ns: "types",
                        count: 1,
                    })}
                    onMouseDownCapture={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <Column
                        field="attributes.identifier_type"
                        header={t("add.attributes.identifier-type")}
                        body={identifierValue}
                    />
                    <Column
                        field="attributes.value"
                        header={t("add.attributes.value")}
                    />
                </DataTable>
                {paginator}
            </div>
        );
    }

    const hasVolumeYears = issues.some((i) => i.volume_year);
    const hasVolumes = issues.some((i) => i.volume);
    const hasBundles = issues.some((i) => i.bundle);

    const addIssue = (issue: CatalogIssueResponse) => {
        addDocumentIssue(
            issue.parentDocument.parentResponse.id,
            issue.barcode
        ).then(() => refresh());
    };

    const issuanceTypeGroupTemplate = (issue: CatalogIssueResponse) => {
        return (
            <div className="flex gap-3 align-items-center">
                <LabeledComponent
                    label={identifierValue(issue.parentDocument.parentResponse)}
                    boldLabel
                >
                    <span>
                        {issue.parentDocument.parentResponse.attributes.value}
                    </span>
                </LabeledComponent>
                <LabeledComponent
                    label={t("add.attributes.indexed-at")}
                    boldLabel
                >
                    <span>
                        {formatDatetime(
                            issue.parentDocument.parentResponse.indexed_at
                        )}
                    </span>
                </LabeledComponent>
                <MaterialTypeTag
                    materialType={issue.parentDocument.material_type}
                />
                <LabeledComponent label={t("properties.title")} boldLabel>
                    <span>{issue.parentDocument.title}</span>
                </LabeledComponent>
            </div>
        );
    };

    const issuanceTypeBody = (issue: CatalogIssueResponse) => {
        return <IssuanceTypeTag issuanceType={issue.issuance_type} />;
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

    const issueStateBody = (issue: CatalogIssueResponse) => {
        if (issue.document_id) {
            return (
                <div className="flex align-items-center">
                    <span>{`${t("properties.id")}: ${issue.document_id}`}</span>
                    <InternalLinkButton.ShowInDocuments
                        documentId={issue.document_id}
                        openInNewTab={true}
                    />
                </div>
            );
        }
        if (!issue.can_digitize) {
            return (
                <Tag
                    value={t("issues-states.digitization-forbidden")}
                    className="digitization-forbidden"
                />
            );
        }
        if (issue.processing) {
            return (
                <ProgressSpinner
                    style={{ width: "22px", height: "22px" }}
                    strokeWidth="8"
                    fill="var(--surface-ground)"
                    animationDuration="1s"
                />
            );
        }
        if (issue.digitization_state === DigitizationState.NotDigitized) {
            return (
                <Button
                    label={t("add.add-issue")}
                    icon="pi pi-plus"
                    outlined
                    onClick={() => addIssue(issue)}
                />
            );
        }
        return "";
    };

    return (
        <div>
            <DataTable
                value={issues}
                scrollable
                scrollHeight="50vh"
                header={t(`add-documents-response-status.${status}`, {
                    ns: "types",
                    count: 1,
                })}
                rowGroupMode="subheader"
                groupRowsBy="parentDocument.parentResponse.attributes.value"
                rowGroupHeaderTemplate={issuanceTypeGroupTemplate}
                onMouseDownCapture={(e) => {
                    e.stopPropagation();
                }}
            >
                <Column field="barcode" header={t("properties.barcode")} />
                <Column
                    field="volume_year"
                    header={t("properties.volume_year")}
                    hidden={!hasVolumeYears}
                />
                <Column
                    field="volume"
                    header={t("properties.volume")}
                    hidden={!hasVolumes}
                />
                <Column
                    field="bundle"
                    header={t("properties.bundle")}
                    hidden={!hasBundles}
                />
                <Column field="signature" header={t("properties.signature")} />
                <Column
                    field="type"
                    header={t("properties.issuance_type")}
                    body={issuanceTypeBody}
                />
                <Column
                    field="digitization_state"
                    header={t("properties.digitization_state")}
                    body={digitizationStateBody}
                />
                <Column
                    field="issue-state"
                    header={t("add.attributes.issue-state")}
                    body={issueStateBody}
                />
            </DataTable>
            {paginator}
        </div>
    );
};

export default AddDocumentsResults;
