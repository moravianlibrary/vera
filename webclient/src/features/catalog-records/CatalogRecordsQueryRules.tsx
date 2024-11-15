import React, { Fragment } from "react";
import EsFacet from "../../components/elasticsearch/filters/EsFacet";
import EsBooleanFacet from "../../components/elasticsearch/filters/EsBooleanFacet";
import EsMaterialTypeFacet from "../../components/elasticsearch/filters/EsMaterialTypeFacet";
import EsMarcFieldDifferenceTypeFacet from "../../components/elasticsearch/filters/EsMarcFieldDifferenceTypeFacet";
import { useTranslation } from "react-i18next";
import EsSortBy from "../../components/elasticsearch/EsSortBy";
import EsQueryRulesLayout from "../../components/layouts/EsQueryRulesLayout";
import SkcRecordFlagTag from "../../components/tags/SkcRecordFlagTag";
import CnbRecordFlagTag from "../../components/tags/CnbRecordFlagTag";

interface CatalogRecordsFacetsBarProps {}

const CatalogRecordsFacetsBar: React.FC<CatalogRecordsFacetsBarProps> = () => {
    const { t } = useTranslation("catalog-records");

    return (
        <EsQueryRulesLayout
            sortBy={
                <EsSortBy
                    items={[
                        {
                            label: t("sort-by.last-edited"),
                            value: "catalog_records",
                        },
                        {
                            label: t("sort-by.newest"),
                            value: "catalog-records_newest",
                        },
                        {
                            label: t("sort-by.oldest"),
                            value: "catalog-records_oldest",
                        },
                    ]}
                />
            }
            facets={
                <Fragment>
                    <EsFacet
                        attribute="skc_record_flags"
                        label={t("facets.skc-record-flags")}
                        onDisplayLabel={(item) => (
                            <SkcRecordFlagTag value={item.value} />
                        )}
                    />
                    <EsFacet
                        attribute="cnb_record_flags"
                        label={t("facets.cnb-record-flags")}
                        onDisplayLabel={(item) => (
                            <CnbRecordFlagTag value={item.value} />
                        )}
                    />
                    <EsMaterialTypeFacet
                        attribute="material_type"
                        label={t("facets.material-type")}
                    />
                    <EsMarcFieldDifferenceTypeFacet
                        attribute="skc_difference_type_facets"
                        label={t("facets.skc-difference-type")}
                    />
                    <EsFacet
                        attribute="skc_difference_tag_facets"
                        label={t("facets.skc-difference-tag")}
                    />
                    <EsMarcFieldDifferenceTypeFacet
                        attribute="cnb_difference_type_facets"
                        label={t("facets.cnb-difference-type")}
                    />
                    <EsFacet
                        attribute="cnb_difference_tag_facets"
                        label={t("facets.cnb-difference-tag")}
                    />
                    <EsFacet
                        attribute="language"
                        label={t("facets.language")}
                        showMore
                        limit={5}
                    />
                    <EsBooleanFacet
                        attribute="has_documents"
                        label={t("facets.has-documents")}
                    />
                    <EsBooleanFacet
                        attribute="has_active_documents"
                        label={t("facets.has-active-documents")}
                    />
                </Fragment>
            }
            queryParamsIndexName="catalog_records"
        />
    );
};

export default CatalogRecordsFacetsBar;
