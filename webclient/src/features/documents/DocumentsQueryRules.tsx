import React, { Fragment } from "react";
import EsBooleanFacet from "../../components/elasticsearch/filters/EsBooleanFacet";
import EsDigitizationStateFacet from "../../components/elasticsearch/filters/EsDigitizationStateFacet";
import EsFacet from "../../components/elasticsearch/filters/EsFacet";
import EsCategoryFacet from "../../components/elasticsearch/filters/EsCategoryFacet";
import EsDigitizationListFacet from "../../components/elasticsearch/filters/EsDigitizationListFacet";
import EsRangeFacet from "../../components/elasticsearch/filters/EsRangeFacet";
import EsMaterialTypeFacet from "../../components/elasticsearch/filters/EsMaterialTypeFacet";
import EsIssuanceTypeFacet from "../../components/elasticsearch/filters/EsIssuanceTypeFacet";
import EsQueryRulesLayout from "../../components/layouts/EsQueryRulesLayout";
import EsSortBy from "../../components/elasticsearch/EsSortBy";
import { useTranslation } from "react-i18next";

interface DocumentsQueryRulesProps {}

export const DocumentsQueryRules: React.FC<DocumentsQueryRulesProps> = () => {
    const { t } = useTranslation();

    return (
        <EsQueryRulesLayout
            sortBy={
                <EsSortBy
                    items={[
                        {
                            label: t("documents.sort-by.last-edited"),
                            value: "catalog-records_last_edited",
                        },
                        {
                            label: t("documents.sort-by.newest"),
                            value: "documents_newest",
                        },
                        {
                            label: t("documents.sort-by.oldest"),
                            value: "documents_oldest",
                        },
                        {
                            label: t("documents.sort-by.title-asc"),
                            value: "documents_title_asc",
                        },
                        {
                            label: t("documents.sort-by.title-desc"),
                            value: "documents_title_desc",
                        },
                    ]}
                />
            }
            facets={
                <Fragment>
                    <EsBooleanFacet
                        attribute="is_extractable"
                        label={t("documents.facets.is-extractable")}
                    />
                    <EsBooleanFacet
                        attribute="has_valid_main_record"
                        label={t("documents.facets.has-valid-main-record")}
                    />
                    <EsBooleanFacet
                        attribute="has_valid_cnb"
                        label={t("documents.facets.has-valid-cnb")}
                    />
                    <EsDigitizationStateFacet
                        attribute="digitization_state"
                        label={t("documents.facets.digitization-state")}
                    />
                    <EsMaterialTypeFacet
                        attribute="material_type"
                        label={t("documents.facets.material-type")}
                    />
                    <EsIssuanceTypeFacet
                        attribute="issuance_type"
                        label={t("documents.facets.issuance-type")}
                    />
                    <EsFacet
                        attribute="added_by"
                        label={t("documents.facets.added-by")}
                    />
                    <EsCategoryFacet
                        attribute="category_id"
                        label={t("documents.facets.category")}
                    />
                    <EsDigitizationListFacet
                        attribute="digitization_list_id"
                        label={t("documents.facets.digitization-list")}
                        showMore
                        limit={5}
                    />
                    <EsRangeFacet
                        attribute="page_count"
                        label={t("documents.facets.page-count")}
                    />
                    {/* <EsRangeFacet
                        attribute="volume_number"
                        label="Volume Number"
                    />
                    <EsRangeFacet
                        attribute="volume_year_number"
                        label="Volume Year Number"
                    />
                    <EsRangeFacet attribute="bundle_number" label="Bundle" />
                    <EsRangeFacet
                        attribute="page_count_manual"
                        label="Page Count"
                    />
                    <EsRangeFacet
                        attribute="page_count_catalog"
                        label="Page Count"
                    />
                    <EsRangeFacet
                        attribute="page_count_predicted"
                        label="Page Count"
                    /> */}
                </Fragment>
            }
        />
    );
};

export default DocumentsQueryRules;
