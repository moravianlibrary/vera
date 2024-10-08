import React from "react";
import { Button } from "primereact/button";
import { IndexDocument } from "../../../adapters/ApiDocuments";
import { useDocuments } from "../../../contexts/DocumentsContext";

const DocumentDetailsColumnBody = (document: IndexDocument) => {
    const { detailsDocuments, showDocumentDetails, closeDocumentDetails } =
        useDocuments();

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
