import React from "react";
import { CatalogRecord } from "../../../adapters/ApiCatalogRecords";
import { createCnbLink } from "../../../data/factories/LinksFactory";
import ExternalLinkButton from "../../../components/buttons/ExternalLinkButton";

const CnbSysnoColumnBody = (catalogRecord: CatalogRecord) => {
    if (!catalogRecord.cnb_sysno) return null;

    return (
        <ExternalLinkButton
            label={catalogRecord.cnb_sysno}
            url={createCnbLink(catalogRecord.cnb_sysno)}
        />
    );
};

export default CnbSysnoColumnBody;
