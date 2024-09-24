import React from "react";
import DigitizationStateTag from "../../../components/tags/DigitizationStateTag";
import { IndexDocument } from "../../../adapters/ApiDocuments";

const DigitizationStateColumnBody = (document: IndexDocument) => {
    return <DigitizationStateTag state={document.digitization_state} />;
};

export default DigitizationStateColumnBody;
