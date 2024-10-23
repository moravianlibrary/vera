import React from "react";
import EsFacet, { EsFacetProps } from "./EsFacet";
import DocumentFlag, { orderBy } from "../../../types/DocumentFlag";
import DocumentFlagTag from "../../tags/DocumentFlagTag";

const EsDocumentFlagFacet: React.FC<EsFacetProps> = (props) => {
    return (
        <EsFacet
            {...props}
            onDisplayLabel={(item) => (
                <DocumentFlagTag flag={item.value as DocumentFlag} />
            )}
            orderBy={orderBy}
        />
    );
};

export default EsDocumentFlagFacet;
