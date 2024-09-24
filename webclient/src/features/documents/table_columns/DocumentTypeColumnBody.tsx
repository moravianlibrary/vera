import React from "react";
import { IndexDocument } from "../../../adapters/ApiDocuments";
import DocumentTypeTag from "../../../components/tags/DocumentTypeTag";

const DocumentTypeColumnBody = (document: IndexDocument) => {
    return <DocumentTypeTag document={document} />;
};

export default DocumentTypeColumnBody;
