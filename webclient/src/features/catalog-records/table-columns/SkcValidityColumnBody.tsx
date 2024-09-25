import React from "react";
import { CatalogRecord } from "../../../adapters/ApiCatalogRecords";
import ValidityTag from "../../../components/tags/ValidityTag";
import NotFoundTag from "../../../components/tags/NotFoundTag";
import MarcFieldDifferencesTagsBox from "../../../components/tags/MarcFieldDifferencesTagsBox";
import { useTranslation } from "react-i18next";

const SkcValidityColumnBody = (catalogRecord: CatalogRecord) => {
    const { t } = useTranslation();

    if (catalogRecord.has_valid_main_record) {
        return (
            <ValidityTag
                label={t(`catalog-records.table.tags.valid-main-record`)}
                isValid={true}
            />
        );
    }
    if (!catalogRecord.skc_sysno) {
        return (
            <NotFoundTag
                label={t(`catalog-records.table.tags.not-found-in-skc`)}
            />
        );
    }
    if (!catalogRecord.skc_difference) {
        throw new Error("skc_difference is null even though skc_sysno exists");
    }

    return (
        <MarcFieldDifferencesTagsBox
            differences={catalogRecord.skc_difference}
        />
    );
};

export default SkcValidityColumnBody;
