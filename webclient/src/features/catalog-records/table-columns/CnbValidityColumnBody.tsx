import React from "react";
import { CatalogRecord } from "../../../adapters/ApiCatalogRecords";
import ValidityTag from "../../../components/tags/ValidityTag";
import NotFoundTag from "../../../components/tags/NotFoundTag";
import { Tag } from "primereact/tag";
import { useTranslation } from "react-i18next";
import MarcFieldDifferencesTagsBox from "../../../components/tags/MarcFieldDifferencesTagsBox";

const CnbValidityColumnBody = (catalogRecord: CatalogRecord) => {
    const { t } = useTranslation();

    if (catalogRecord.has_valid_cnb) {
        if (!catalogRecord.cnb_sysno) {
            return (
                <Tag
                    className="tag-catalog-record-without-cnb"
                    value={t(`catalog-records.table.tags.should-not-have-cnb`)}
                />
            );
        }
        return (
            <ValidityTag
                label={t(`catalog-records.table.tags.valid-cnb`)}
                isValid={true}
            />
        );
    }
    if (!catalogRecord.cnb_sysno) {
        return (
            <NotFoundTag
                label={t(`catalog-records.table.tags.not-found-in-cnb`)}
            />
        );
    }
    if (!catalogRecord.cnb_difference) {
        throw new Error("cnb_difference is null even though cnb_sysno exists");
    }

    return (
        <MarcFieldDifferencesTagsBox
            differences={catalogRecord.cnb_difference}
        />
    );
};

export default CnbValidityColumnBody;
