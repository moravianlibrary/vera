import React from "react";
import { CatalogRecord } from "../../../adapters/ApiCatalogRecords";
import { createSkcLink } from "../../../data/factories/LinksFactory";
import ExternalLinkButton from "../../../components/buttons/ExternalLinkButton";

const SkcSysnoColumnBody = (catalogRecord: CatalogRecord) => {
    if (!catalogRecord.skc_sysno) return null;

    return (
        <ExternalLinkButton
            label={catalogRecord.skc_sysno}
            url={createSkcLink(catalogRecord.skc_sysno)}
        />
    );
};

export default SkcSysnoColumnBody;
