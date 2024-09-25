import React from "react";
import { CatalogRecord } from "../../../adapters/ApiCatalogRecords";
import { createMzkAlephLink } from "../../../data/factories/LinksFactory";
import ExternalLinkButton from "../../../components/buttons/ExternalLinkButton";

const MzkSysnoColumnBody = (catalogRecord: CatalogRecord) => {
    return (
        <ExternalLinkButton
            label={catalogRecord.sysno}
            url={createMzkAlephLink(catalogRecord.sysno)}
        />
    );
};

export default MzkSysnoColumnBody;
