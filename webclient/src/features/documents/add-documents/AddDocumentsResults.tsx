import { MessageSeverity } from "primereact/api";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    AddDocumentResponse,
    CatalogIssueResponse,
} from "../../../adapters/ApiDocuments";
import ExternalLinkButton from "../../../components/buttons/ExternalLinkButton";
import InternalLinkButton from "../../../components/buttons/InternalLinkButton";
import NumberEditor from "../../../components/editors/NumberEditor";
import DigitizationStateTag from "../../../components/tags/DigitizationStateTag";
import IssuanceTypeTag from "../../../components/tags/IssuanceTypeTag";
import MaterialTypeTag from "../../../components/tags/MaterialTypeTag";
import DataTablePaginator from "../../../components/views/DataTablePaginator";
import LabeledComponent from "../../../components/wrappers/LabeledComponent";
import { useAddDocuments } from "../../../contexts/AddDocumentsContext";
import { formatDatetime } from "../../../data/factories/DateFactory";
import AddDocumentResponseStatus, {
    AddDocumentResponseErrorStatus,
    AddDocumentResponseInfoStatus,
    AddDocumentResponseSuccessStatus,
    AddDocumentResponseWarningStatus,
} from "../../../types/AddDocumentResponseStatus";
import { DigitizationState } from "../../../types/DigitizationState";

interface AddDocumentsResultsProps {}

const AddDocumentsResults: React.FC<AddDocumentsResultsProps> = () => {
    const { t } = useTranslation("documents");
    const { statusBuckets, showStatus, setShowStatus, reset } =
        useAddDocuments();

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

    useEffect(() => {
        reset();
    }, []);

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

    return <StatusResults />;
};

const StatusResults: React.FC = () => {
    const { t } = useTranslation("documents");
    const {
        showStatus,
        items,
        issues,
        addDocumentIssue,
        addAllDocumentIssues,
        setDocumentPageCount,
    } = useAddDocuments();

    const identifierValue = (response: AddDocumentResponse) => {
        return t(`identifier-type.${response.attributes.identifier_type}`, {
            ns: "types",
        });
    };

    if (issues.length === 0) {
        return (
            <div>
                <DataTable
                    value={items}
                    scrollable
                    scrollHeight="calc(100vh - 530px)"
                    header={t(`add-documents-response-status.${showStatus}`, {
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
                <StatusResultsPaginator />
            </div>
        );
    }

    const hasVolumeYears = issues.some((i) => i.volume_year);
    const hasVolumes = issues.some((i) => i.volume);
    const hasBundles = issues.some((i) => i.bundle);

    const addIssue = (issue: CatalogIssueResponse) => {
        addDocumentIssue(issue.parentDocument.parentResponse.id, issue.barcode);
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
                <div className="flex align-items-center gap-3">
                    {issue.newly_added && (
                        <Tag>{t("add.attributes.newly-added")}</Tag>
                    )}
                    <div className="flex align-items-center">
                        <span>{`${t("properties.id")}: ${
                            issue.document_id
                        }`}</span>
                        <InternalLinkButton.ShowInDocuments
                            documentId={issue.document_id}
                            openInNewTab={true}
                        />
                    </div>
                </div>
            );
        }
        if (!issue.can_digitize) {
            return (
                <Tag
                    value={t("issues-states.digitization-forbidden", {
                        ns: "types",
                    })}
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

    const pageCountBody = (issue: CatalogIssueResponse) => {
        if (!issue.newly_added) return null;
        if (issue.page_count) {
            return <span>{issue.page_count}</span>;
        }
        return (
            <NumberEditor
                value={null}
                editorCallback={(value) =>
                    setDocumentPageCount(
                        issue.parentDocument.parentResponse.id,
                        `${issue.document_id}`,
                        value
                    )
                }
            />
        );
    };

    const header = () => {
        return (
            <div className="flex justify-content-between align-items-center">
                <span>
                    {t(`add-documents-response-status.${showStatus}`, {
                        ns: "types",
                        count: 1,
                    })}
                </span>
                {showStatus === AddDocumentResponseStatus.MultipleIssues && (
                    <Button
                        label={t("add.add-all-issues")}
                        icon="pi pi-plus"
                        outlined
                        onClick={() => addAllDocumentIssues()}
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
                scrollHeight="calc(100vh - 550px)"
                header={header}
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
                <Column
                    field="page_count"
                    header={t("add.attributes.page-count")}
                    body={pageCountBody}
                    hidden={
                        ![
                            AddDocumentResponseStatus.MultipleIssues,
                            AddDocumentResponseStatus.SuccessWithMissingPageCount,
                            AddDocumentResponseStatus.Success,
                        ].includes(showStatus)
                    }
                />
            </DataTable>
            <StatusResultsPaginator />
        </div>
    );
};

const StatusResultsPaginator: React.FC = () => {
    const { t } = useTranslation("documents");
    const {
        numFound,
        page,
        setPage,
        pageSize,
        setPageSize,
        pageSizeOptions,
        refresh,
        setShowStatus,
    } = useAddDocuments();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            pageSizeOptions={pageSizeOptions}
            leftContent={
                <Button
                    outlined
                    icon="pi pi-chevron-left"
                    label={t("actions.go-back-to-responses-summary")}
                    onClick={() => setShowStatus(null)}
                />
            }
            onRefresh={refresh}
        />
    );
};
export default AddDocumentsResults;
