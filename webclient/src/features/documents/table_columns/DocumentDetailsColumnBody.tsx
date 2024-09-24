import React from "react";
import { Button } from "primereact/button";
import { IndexDocument } from "../../../adapters/ApiDocuments";
import { useDocumentsActions } from "../../../contexts/documents/DocumentsActionsContext";

const DocumentDetailsColumnBody = (document: IndexDocument) => {
    const { detailsDocuments, showDocumentDetails, closeDocumentDetails } =
        useDocumentsActions();

    const isVisible = () => {
        return detailsDocuments.map((d) => d.id).includes(document.id);
    };

    const toggleDetailsVisibility = () => {
        if (!isVisible()) {
            showDocumentDetails(document);
        } else {
            closeDocumentDetails(document.id);
        }
    };

    return (
        <Button
            className="details-button"
            text={!isVisible()}
            onClick={toggleDetailsVisibility}
        >
            <i className="pi pi-book" />
        </Button>
    );
};

export default DocumentDetailsColumnBody;
