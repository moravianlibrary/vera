import { MessageSeverity } from "primereact/api";
import { MaterialType } from "../../types/MaterialType";
import { IssuanceType } from "../../types/IssuanceType";
import { Severity } from "../../types/PrimeReactTypes";
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

export function areOnlySuccessfulResults(
    results: AddDocumentResponse[]
): boolean {
    return results.every((r) => r.status === AddDocumentResponseStatus.Success);
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

    const joinNonNullValues = (values: (string | null | undefined)[]) => {
        return values.filter((v) => v).join(", ");
    };

    switch (document.material_type) {
        case MaterialType.Book:
            return issue.issuance_type === IssuanceType.Unit
                ? joinNonNullValues([
                      document.sysno,
                      issue.volume || issue.volume_year,
                      issue.barcode,
                  ])
                : defaultResultDetail();
        case MaterialType.ContinuingResource:
            switch (issue.issuance_type) {
                case IssuanceType.Bundle:
                    return joinNonNullValues([
                        document.sysno,
                        issue.volume || issue.volume_year,
                        issue.bundle,
                        issue.barcode,
                    ]);
                case IssuanceType.Volume:
                    return joinNonNullValues([
                        document.sysno,
                        issue.volume || issue.volume_year,
                        issue.barcode,
                    ]);
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
