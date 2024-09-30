import React from "react";
import { CatalogRecord } from "../../../adapters/ApiCatalogRecords";
import { createMzkAlephLink } from "../../../data/factories/LinksFactory";
import ExternalLinkButton from "../../../components/buttons/ExternalLinkButton";

const MzkSysnoColumnBody = (catalogRecord: CatalogRecord) => {
    return (
        <ExternalLinkButton
            label={catalogRecord.sysno || catalogRecord.id}
            url={createMzkAlephLink(catalogRecord.sysno || catalogRecord.id)}
        />
    );
};

export default MzkSysnoColumnBody;
