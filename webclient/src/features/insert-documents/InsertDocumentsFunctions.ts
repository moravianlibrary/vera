import { MessagesMessage } from "primereact/messages";
import { MessageSeverity } from "primereact/api";
import { MaterialType } from "../../types/MaterialType";
import { IssuanceType } from "../../types/IssuanceType";
import { TFunction } from "i18next";
import { ActionSeverity, Severity } from "../../types/PrimeReactTypes";
import {
    AddDocumentResponse,
    CatalogDocumentResponse,
} from "../../adapters/ApiDocuments";
import AddDocumentResponseStatus, {
    AddDocumentResponseErrorStatus,
    AddDocumentResponseInfoStatus,
    AddDocumentResponseSuccessStatus,
    AddDocumentResponseWarningStatus,
} from "../../types/AddDocumentResponseStatus";
import { AddDocumentResponses } from "../../contexts/insert-documents/InsertDocumentsContext";

export function isSingleSuccessfulResult(
    results: AddDocumentResponses
): boolean {
    return (
        results.Success.length === 1 &&
        !Object.values(AddDocumentResponseStatus)
            .filter((s) => s !== AddDocumentResponseStatus.Success)
            .some((s) => results[s].length > 0)
    );
}

export function areOnlySuccessfulResults(
    results: AddDocumentResponses
): boolean {
    return Object.values(results).every((rs) =>
        rs.every((r) => r.status === AddDocumentResponseStatus.Success)
    );
}

export function getResponseMessageSeverity(status: AddDocumentResponseStatus) {
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
}

export function getResultDetail(document: CatalogDocumentResponse) {
    if (document.issues.length !== 1) {
        return document.sysno;
    }

    const issue = document.issues[0];

    const defaultResultDetail = () => {
        return issue.barcode
            ? `${document.sysno}, ${issue.barcode}`
            : document.sysno;
    };

    switch (document.material_type) {
        case MaterialType.Book:
            return issue.issuance_type === IssuanceType.Unit
                ? `${document.sysno}, ${
                      issue.volume || issue.volume_year || "-"
                  }, ${issue.barcode}`
                : defaultResultDetail();
        case MaterialType.ContinuingResource:
            switch (issue.issuance_type) {
                case IssuanceType.Bundle:
                    return `${document.sysno}, ${
                        issue.volume || issue.volume_year
                    }, ${issue.bundle}, ${issue.barcode}`;
                case IssuanceType.Volume:
                    return `${document.sysno}, ${
                        issue.volume || issue.volume_year
                    }, ${issue.barcode}`;
                default:
                    return defaultResultDetail();
            }
        default:
            return defaultResultDetail();
    }
}

export function getResultSeverity(
    status: AddDocumentResponseStatus
): MessageSeverity {
    if (status === AddDocumentResponseStatus.Success) {
        return MessageSeverity.SUCCESS;
    } else if (
        status === AddDocumentResponseStatus.UniqueViolation ||
        status === AddDocumentResponseStatus.AlreadyDigitized
    ) {
        return MessageSeverity.WARN;
    }
    return MessageSeverity.ERROR;
}

export function messageSeverityToSeverity(
    status: MessageSeverity
): ActionSeverity {
    switch (status) {
        case MessageSeverity.SUCCESS:
            return "success";
        case MessageSeverity.WARN:
            return "warn";
        case MessageSeverity.ERROR:
            return "error";
        case MessageSeverity.INFO:
            return "info";
    }
    return;
}

export function messageSeverityToActionSeverity(
    status: MessageSeverity
): Severity {
    switch (status) {
        case MessageSeverity.SUCCESS:
            return "success";
        case MessageSeverity.WARN:
            return "warning";
        case MessageSeverity.ERROR:
            return "danger";
        case MessageSeverity.INFO:
            return "info";
    }
    return;
}

export function generateMessageForResponse(
    document_response: AddDocumentResponse
) {
    return {
        severity: getResultSeverity(document_response.status),
        summary: document_response.status,
        detail: "Fill detail",
    };
}

function generateMessageForResult(
    t: TFunction,
    results: AddDocumentResponse[],
    status: AddDocumentResponseStatus
): MessagesMessage | null {
    const documents = results.filter((r) => r.status === status);
    if (documents.length === 0) {
        return null;
    }

    if (documents.length === 1) {
        return {
            severity: getResultSeverity(documents[0].status),
            summary: t(documents[0].status),
            detail: "Fill detail",
            sticky: true,
            closable: false,
        };
    }

    return {
        severity: getResultSeverity(status),
        summary: t(status),
        detail: `${t("Count")}: ${documents.length}`,
        sticky: true,
        closable: false,
    };
}

export function parseResultsToLocalizedMessages(
    t: TFunction,
    results: AddDocumentResponse[]
): MessagesMessage[] {
    return Object.values(AddDocumentResponseStatus)
        .map((result) => generateMessageForResult(t, results, result))
        .filter((message): message is MessagesMessage => message !== null);
}
