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
import AddDocumentResponseStatus from "../../types/AddDocumentResponseStatus";

export interface InsertResultDetail {
    result: AddDocumentResponseStatus;
    id: number | null;
    sysno?: string;
    barcode?: string | null;
    material_type?: MaterialType;
    issuance_type?: IssuanceType;
    year?: string | null;
    volume?: string | null;
    bundle?: string | null;
    type: string;
    description: string;
    result_localized: string;
}

export function isSingleSuccessfulResult(
    results: AddDocumentResponse[]
): boolean {
    return (
        results.length === 1 &&
        results[0].status === AddDocumentResponseStatus.Success
    );
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

export function getResultSummary(result: AddDocumentResponseStatus): string {
    switch (result) {
        case AddDocumentResponseStatus.AlreadyDigitized:
            return "Document already digitized";
        case AddDocumentResponseStatus.CatalogDocumentParsingError:
            return "Error while parsing catalog response";
        case AddDocumentResponseStatus.CatalogError:
            return "Error while connecting to catalog";
        case AddDocumentResponseStatus.DigitizationInProgress:
            return "Document digitization in progress";
        case AddDocumentResponseStatus.DigitizationPlanned:
            return "Document digitization planned";
        case AddDocumentResponseStatus.DigitizationRevision:
            return "Document is in revision";
        case AddDocumentResponseStatus.DocumentNotFoundInCatalog:
            return "Document not found in catalog";
        case AddDocumentResponseStatus.InvalidCatalogDocument:
            return "Invalid catalog document";
        case AddDocumentResponseStatus.InvalidIdentifier:
            return "Invalid document identifier";
        case AddDocumentResponseStatus.InvalidSysno:
            return "Invalid system number";
        case AddDocumentResponseStatus.InvalidSysnoBase:
            return "Invalid system number base";
        case AddDocumentResponseStatus.Success:
            return "Document successfuly created";
        case AddDocumentResponseStatus.UniqueDocumentViolation:
            return "Unique document violation";
        case AddDocumentResponseStatus.DigitizationForbidden:
            return "Digitization forbidden";
        default:
            return "";
    }
}

export function getResultDetail(
    document: CatalogDocumentResponse | null | undefined
): string {
    if (document === undefined || document === null) {
        return "";
    }

    const issue = document.issues[0];

    if (document.material_type === MaterialType.ContinuingResource) {
        switch (issue.issuance_type) {
            case IssuanceType.Bundle:
                return `${document.sysno}, ${issue.volume}, ${issue.bundle}, ${issue.barcode}`;
            case IssuanceType.Volume:
                return `${document.sysno}, ${issue.volume}, ${issue.barcode}`;
        }
    }

    if (
        document.material_type === MaterialType.Book &&
        issue.issuance_type === IssuanceType.Unit
    ) {
        return `${document.sysno}, ${issue.volume}, ${issue.barcode}`;
    }

    return issue.barcode
        ? `${document.sysno}, ${issue.barcode}`
        : document.sysno;
}

export function generateMessageForResponse(
    document_response: AddDocumentResponse
) {
    return {
        severity: getResultSeverity(document_response.status),
        summary: getResultSummary(document_response.status),
        detail: getResultDetail(
            document_response.document?.issues
                ? document_response.document.issues[0]
                : document_response.document
        ),
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
            summary: t(getResultSummary(documents[0].status)),
            detail: getResultDetail(
                documents[0].document
                    ? documents[0].document
                    : documents[0].catalog_document
            ),
            sticky: true,
            closable: false,
        };
    }

    return {
        severity: getResultSeverity(status),
        summary: t(getResultSummary(status)),
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

export function getResultsDetails(
    t: TFunction,
    results: AddDocumentResponse[]
): InsertResultDetail[] {
    return results.map((result) => {
        const material_type =
            result.document?.material_type ??
            result.catalog_document?.material_type;
        const issuance_type =
            result.document?.issuance_type ??
            result.catalog_document?.issuance_type;
        const year = result.document?.year ?? result.catalog_document?.year;
        const volume =
            result.document?.volume ?? result.catalog_document?.volume;
        const bundle =
            result.document?.bundle ?? result.catalog_document?.bundle;
        return {
            id: result.document?.id ?? null,
            result: result.status,
            sysno: result.document?.sysno ?? result.catalog_document?.sysno,
            barcode:
                result.document?.barcode ?? result.catalog_document?.barcode,
            material_type:
                result.document?.material_type ??
                result.catalog_document?.material_type,
            issuance_type:
                result.document?.issuance_type ??
                result.catalog_document?.issuance_type,
            year: year,
            volume: volume,
            bundle: bundle,
            type: material_type
                ? issuance_type
                    ? `${t(material_type)} - ${t(issuance_type)}`
                    : t(material_type)
                : issuance_type
                ? t(issuance_type)
                : "",
            description: [year, volume, bundle].filter((x) => x).join(" "),
            result_localized: t(getResultSummary(result.status)),
        };
    });
}
