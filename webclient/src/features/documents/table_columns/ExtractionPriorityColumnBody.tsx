import React from "react";
import { IndexDocument } from "../../../adapters/ApiDocuments";
import ExtractionPriorityTag from "../../../components/tags/ExtractionPriorityTag";

const ExtractionPriorityColumnBody = (document: IndexDocument) => {
    return <ExtractionPriorityTag priority={document.extraction_priority} />;
};

export default ExtractionPriorityColumnBody;
