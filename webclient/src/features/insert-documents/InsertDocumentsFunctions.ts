import { MessagesMessage } from "primereact/messages";
import { DocumentBase, DocumentCreationResponse } from "../../adapters/ApiDocuments";
import { DocumentCreateResult } from "../../types/DocumentCreateResult";
import { MessageSeverity } from "primereact/api";
import { MaterialType } from "../../types/MaterialType";
import { IssuanceType } from "../../types/IssuanceType";
import { TFunction } from "i18next";
import { ActionSeverity, Severity } from "../../types/PrimeReactTypes";

export interface InsertResultDetail {
    result: DocumentCreateResult;
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

export function isSingleSuccessfulResult(results: DocumentCreationResponse[]): boolean {
    return (
        results.length === 1 &&
        results[0].create_result === DocumentCreateResult.Success
    );
}

export function getResultSeverity(status: DocumentCreateResult): MessageSeverity {
    if (status === DocumentCreateResult.Success) {
        return MessageSeverity.SUCCESS;
    } else if (status === DocumentCreateResult.UniqueDocumentViolation
            || status === DocumentCreateResult.AlreadyDigitized) {
        return MessageSeverity.WARN;
    }
    return MessageSeverity.ERROR;
}

export function messageSeverityToSeverity(status: MessageSeverity): ActionSeverity {
    switch (status) {
        case MessageSeverity.SUCCESS: return "success";
        case MessageSeverity.WARN: return "warn";
        case MessageSeverity.ERROR: return "error";
        case MessageSeverity.INFO: return "info";
    }
    return;
}

export function messageSeverityToActionSeverity(status: MessageSeverity): Severity {
    switch (status) {
        case MessageSeverity.SUCCESS: return "success";
        case MessageSeverity.WARN: return "warning";
        case MessageSeverity.ERROR: return "danger";
        case MessageSeverity.INFO: return "info";
    }
    return;
}

export function getResultSummary(result: DocumentCreateResult): string {
    switch (result) {
        case DocumentCreateResult.AlreadyDigitized: return "Document already digitized";
        case DocumentCreateResult.CatalogDocumentParsingError: return "Error while parsing catalog response";
        case DocumentCreateResult.CatalogError: return "Error while connecting to catalog";
        case DocumentCreateResult.DigitizationInProgress: return "Document digitization in progress";
        case DocumentCreateResult.DigitizationPlanned: return "Document digitization planned";
        case DocumentCreateResult.DocumentNotFoundInCatalog: return "Document not found in catalog";
        case DocumentCreateResult.InvalidCatalogDocument: return "Invalid catalog document";
        case DocumentCreateResult.InvalidIdentifier: return "Invalid document identifier";
        case DocumentCreateResult.InvalidSysno: return "Invalid system number";
        case DocumentCreateResult.InvalidSysnoBase: return "Invalid system number base";
        case DocumentCreateResult.Success: return "Document successfuly created";
        case DocumentCreateResult.UniqueDocumentViolation: return "Unique document violation";
        case DocumentCreateResult.DigitizationForbidden: return "Digitization forbidden";
        default: return "";
    }
}

export function getResultDetail (document: DocumentBase | null | undefined): string {
    if (document === undefined || document === null) {
        return "";
    }

    if (document.material_type === MaterialType.ContinuingResource) {
        switch (document.issuance_type) {
            case IssuanceType.Bundle: return `${document.sysno}, ${document.volume}, ${document.bundle}, ${document.barcode}`;
            case IssuanceType.Volume: return `${document.sysno}, ${document.volume}, ${document.barcode}`;
        }
    }

    if (document.material_type === MaterialType.Book && document.issuance_type === IssuanceType.Unit) {
        return `${document.sysno}, ${document.volume}, ${document.barcode}`;
    }

    return document.barcode ? `${document.sysno}, ${document.barcode}` : document.sysno;
}
    
export function generateMessageForResponse(document_response: DocumentCreationResponse) {
    return {
        severity: getResultSeverity(document_response.create_result),
        summary: getResultSummary(document_response.create_result),
        detail: getResultDetail(document_response.document
            ? document_response.document
            : document_response.catalog_document
        ),
    }
}

function generateMessageForResult(t: TFunction, results: DocumentCreationResponse[], result: DocumentCreateResult): MessagesMessage | null {
    const documents = results.filter(r => r.create_result === result);
    if (documents.length === 0) {
        return null;
    }

    if (documents.length === 1) {
        return {
            severity: getResultSeverity(documents[0].create_result),
            summary: t(getResultSummary(documents[0].create_result)),
            detail: getResultDetail(documents[0].document
                ? documents[0].document
                : documents[0].catalog_document
            ),
            sticky: true,
            closable: false,
        };
    }

    return {
        severity: getResultSeverity(result),
        summary: t(getResultSummary(result)),
        detail: `${t('Count')}: ${documents.length}`,
        sticky: true,
        closable: false,
    };
}

export function parseResultsToLocalizedMessages(t: TFunction, results: DocumentCreationResponse[]): MessagesMessage[] {
    return Object.values(DocumentCreateResult)
            .map(result => generateMessageForResult(t, results, result))
            .filter((message): message is MessagesMessage => message !== null);
}

export function getResultsDetails(t: TFunction, results: DocumentCreationResponse[]): InsertResultDetail[] {
    return results.map(result => {
        const material_type = result.document?.material_type ?? result.catalog_document?.material_type;
        const issuance_type = result.document?.issuance_type ?? result.catalog_document?.issuance_type;
        const year = result.document?.year ?? result.catalog_document?.year;
        const volume = result.document?.volume ?? result.catalog_document?.volume;
        const bundle = result.document?.bundle ?? result.catalog_document?.bundle;
        return {
            id: result.document?.id ?? null,
            result: result.create_result,
            sysno: result.document?.sysno ?? result.catalog_document?.sysno,
            barcode: result.document?.barcode ?? result.catalog_document?.barcode,
            material_type: result.document?.material_type ?? result.catalog_document?.material_type,
            issuance_type: result.document?.issuance_type ?? result.catalog_document?.issuance_type,
            year: year,
            volume: volume,
            bundle: bundle,
            type: material_type
                ? issuance_type
                    ? `${t(material_type)} - ${t(issuance_type)}` : t(material_type)
                : issuance_type
                    ? t(issuance_type)
                    : "",
            description: [year, volume, bundle]
            .filter((x) => x)
            .join(" "),
            result_localized: t(getResultSummary(result.create_result)),
        }
    })
}