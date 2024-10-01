import React from "react";
import EsFacet from "../../components/elasticsearch/filters/EsFacet";
import EsBooleanFacet from "../../components/elasticsearch/filters/EsBooleanFacet";
import EsMaterialTypeFacet from "../../components/elasticsearch/filters/EsMaterialTypeFacet";
import EsMarcFieldDifferenceTypeFacet from "../../components/elasticsearch/filters/EsMarcFieldDifferenceTypeFacet";
import { useTranslation } from "react-i18next";

interface CatalogRecordsFacetsBarProps {}

const CatalogRecordsFacetsBar: React.FC<CatalogRecordsFacetsBarProps> = () => {
    const { t } = useTranslation();

    return (
        <div>
            <EsBooleanFacet
                attribute="has_valid_main_record"
                label={t("catalog-records.facets.has-valid-main-record")}
            />
            <EsBooleanFacet
                attribute="has_valid_cnb"
                label={t("catalog-records.facets.has-valid-cnb")}
            />
            <EsFacet
                attribute="language"
                label={t("catalog-records.facets.language")}
                showMore
                limit={5}
            />
            <EsMaterialTypeFacet
                attribute="material_type"
                label={t("catalog-records.facets.material-type")}
            />
            <EsMarcFieldDifferenceTypeFacet
                attribute="skc_difference.difference_type"
                label={t("catalog-records.facets.skc-difference-type")}
            />
            <EsFacet
                attribute="skc_difference.tag"
                label={t("catalog-records.facets.skc-difference-tag")}
            />
            <EsMarcFieldDifferenceTypeFacet
                attribute="cnb_difference.difference_type"
                label={t("catalog-records.facets.cnb-difference-type")}
            />
            <EsFacet
                attribute="cnb_difference.tag"
                label={t("catalog-records.facets.cnb-difference-tag")}
            />
        </div>
    );
};

export default CatalogRecordsFacetsBar;
