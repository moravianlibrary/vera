import React from "react";
import { IndexDocument } from "../../../adapters/ApiDocuments";
import ExtractableTag from "../../../components/tags/ExtractableTag";

const DocumentStateColumnBody = (document: IndexDocument) => {
    return <ExtractableTag document={document} />;
};

export default DocumentStateColumnBody;
