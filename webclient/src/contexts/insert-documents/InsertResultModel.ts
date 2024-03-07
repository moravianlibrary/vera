import { useTranslation } from "react-i18next";
import { DocumentBase, DocumentCreationResponse } from "../../adapters/ApiDocuments";
import { DocumentCreateResult } from "../../types/DocumentCreateResult";
import { IssuanceType } from "../../types/IssuanceType";
import { MaterialType } from "../../types/MaterialType";
import { MessagesMessage } from "primereact/messages";

type MessageSeverity = 'success' | 'info' | 'warn' | 'error' | undefined;

class InsertResultModel {
    document_responses: DocumentCreationResponse[];

    constructor() {
        this.document_responses = [];
    }

    getResultSeverity (status: DocumentCreateResult): MessageSeverity {
        if (status === DocumentCreateResult.Success) {
            return "success";
        } else if (status === DocumentCreateResult.UniqueDocumentViolation
                || status === DocumentCreateResult.AlreadyDigitized) {
            return "warn";
        }
        return "error";
    }

    getResultSummary (result: DocumentCreateResult): string {
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
            default: return "";
        }
    }

    getResultDetail (document: DocumentBase | null | undefined): string {
        if (document === undefined || document === null) {
            return "";
        }

        if (document.material_type === MaterialType.ContinuingResource) {
            switch (document.issuance_type) {
                case IssuanceType.Bundle: return `${document.sysno}, ${document.volume}, ${document.bundle}, ${document.barcode}`;
                case IssuanceType.Volume: return `${document.sysno}, ${document.volume}, ${document.barcode}`;
            }
        }

        return document.barcode ? `${document.sysno}, ${document.barcode}` : document.sysno;
    }

    addDocumentResponse(document_response: DocumentCreationResponse) {
        this.document_responses = [...this.document_responses, document_response];
        return {
            severity: this.getResultSeverity(document_response.create_result),
            summary: this.getResultSummary(document_response.create_result),
            detail: this.getResultDetail(document_response.document
                ? document_response.document
                : document_response.catalog_document
            ),
        }
    }

    generateMessageForResult (t, result: DocumentCreateResult): MessagesMessage | null {
        const documents = this.document_responses.filter(r => r.create_result === result);
        if (documents.length === 0) {
            return null;
        }

        if (documents.length === 1) {
            return {
                severity: this.getResultSeverity(documents[0].create_result),
                summary: t(this.getResultSummary(documents[0].create_result)),
                detail: this.getResultDetail(documents[0].document
                    ? documents[0].document
                    : documents[0].catalog_document
                ),
                sticky: true,
                closable: false,
            };
        }

        return {
            severity: this.getResultSeverity(result),
            summary: t(this.getResultSummary(result)),
            detail: `${t('Count')}: ${documents.length}`,
            sticky: true,
            closable: false,
        };
    }

    getMessages(t): MessagesMessage[] {
        return Object.values(DocumentCreateResult)
                .map(result => this.generateMessageForResult(t, result))
                .filter((message): message is MessagesMessage => message !== null);
    }

    isSuccessful(): boolean {
        return this.document_responses
            .filter(r => r.create_result !== DocumentCreateResult.Success)
            .length === 0;
    }
}

export default InsertResultModel;
