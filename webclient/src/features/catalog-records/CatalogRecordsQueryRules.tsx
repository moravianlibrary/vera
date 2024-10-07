import React, { Fragment } from "react";
import EsFacet from "../../components/elasticsearch/filters/EsFacet";
import EsBooleanFacet from "../../components/elasticsearch/filters/EsBooleanFacet";
import EsMaterialTypeFacet from "../../components/elasticsearch/filters/EsMaterialTypeFacet";
import EsMarcFieldDifferenceTypeFacet from "../../components/elasticsearch/filters/EsMarcFieldDifferenceTypeFacet";
import { useTranslation } from "react-i18next";
import EsSortBy from "../../components/elasticsearch/EsSortBy";
import EsQueryRulesLayout from "../../components/layouts/EsQueryRulesLayout";

interface CatalogRecordsFacetsBarProps {}

const CatalogRecordsFacetsBar: React.FC<CatalogRecordsFacetsBarProps> = () => {
    const { t } = useTranslation();

    return (
        <EsQueryRulesLayout
            sortBy={
                <EsSortBy
                    items={[
                        {
                            label: t("catalog-records.sort-by.last-edited"),
                            value: "catalog-records_last_edited",
                        },
                        {
                            label: t("catalog-records.sort-by.non-valid-first"),
                            value: "catalog-records_non_valid_first",
                        },
                        {
                            label: t("catalog-records.sort-by.valid-first"),
                            value: "catalog-records_valid_first",
                        },
                        {
                            label: t("catalog-records.sort-by.newest"),
                            value: "catalog-records_newest",
                        },
                        {
                            label: t("catalog-records.sort-by.oldest"),
                            value: "catalog-records_oldest",
                        },
                    ]}
                />
            }
            facets={
                <Fragment>
                    <EsBooleanFacet
                        attribute="has_valid_main_record"
                        label={t(
                            "catalog-records.facets.has-valid-main-record"
                        )}
                    />
                    <EsBooleanFacet
                        attribute="skc_sysno_resolved"
                        label={t("catalog-records.facets.skc-sysno-resolved")}
                    />
                    <EsBooleanFacet
                        attribute="has_valid_cnb"
                        label={t("catalog-records.facets.has-valid-cnb")}
                    />
                    <EsBooleanFacet
                        attribute="cnb_sysno_resolved"
                        label={t("catalog-records.facets.cnb-sysno-resolved")}
                    />
                    <EsMaterialTypeFacet
                        attribute="material_type"
                        label={t("catalog-records.facets.material-type")}
                    />
                    <EsMarcFieldDifferenceTypeFacet
                        attribute="skc_difference_type_facets"
                        label={t("catalog-records.facets.skc-difference-type")}
                    />
                    <EsFacet
                        attribute="skc_difference_tag_facets"
                        label={t("catalog-records.facets.skc-difference-tag")}
                    />
                    <EsMarcFieldDifferenceTypeFacet
                        attribute="cnb_difference_type_facets"
                        label={t("catalog-records.facets.cnb-difference-type")}
                    />
                    <EsFacet
                        attribute="cnb_difference_tag_facets"
                        label={t("catalog-records.facets.cnb-difference-tag")}
                    />
                    <EsFacet
                        attribute="language"
                        label={t("catalog-records.facets.language")}
                        showMore
                        limit={5}
                    />
                </Fragment>
            }
        />
    );
};

export default CatalogRecordsFacetsBar;
