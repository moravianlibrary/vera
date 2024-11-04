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
import EsExtractionFacet from "../../components/elasticsearch/filters/EsExtractionsFacet";
import EsDocumentFlagFacet from "../../components/elasticsearch/filters/EsDocumentFlagFacet";
import EsNumberFacet from "../../components/elasticsearch/filters/EsNumberFacet";

interface DocumentsQueryRulesProps {}

const DocumentsQueryRules: React.FC<DocumentsQueryRulesProps> = () => {
    const { t } = useTranslation("documents");

    return (
        <EsQueryRulesLayout
            sortBy={
                <EsSortBy
                    items={[
                        {
                            label: t("sort-by.last-edited"),
                            value: "documents",
                        },
                        {
                            label: t("sort-by.extraction-priority"),
                            value: "documents_extraction_priority",
                        },
                        {
                            label: t("sort-by.newest"),
                            value: "documents_newest",
                        },
                        {
                            label: t("sort-by.oldest"),
                            value: "documents_oldest",
                        },
                        {
                            label: t("sort-by.title-asc"),
                            value: "documents_title_asc",
                        },
                        {
                            label: t("sort-by.title-desc"),
                            value: "documents_title_desc",
                        },
                    ]}
                />
            }
            facets={
                <Fragment>
                    <EsDocumentFlagFacet
                        attribute="document_flags"
                        label={t("facets.document-flags")}
                    />
                    <EsDigitizationStateFacet
                        attribute="digitization_state"
                        label={t("facets.digitization-state")}
                    />
                    <EsMaterialTypeFacet
                        attribute="material_type"
                        label={t("facets.material-type")}
                    />
                    <EsIssuanceTypeFacet
                        attribute="issuance_type"
                        label={t("facets.issuance-type")}
                    />
                    <EsFacet
                        attribute="added_by"
                        label={t("facets.added-by")}
                    />
                    <EsCategoryFacet
                        attribute="category_ids"
                        label={t("facets.category")}
                        limit={100}
                    />
                    <EsExtractionFacet
                        attribute="extraction_ids"
                        label={t("facets.extraction")}
                        sortBy={["name:desc"]}
                        showMore
                        limit={5}
                    />
                    <EsDigitizationListFacet
                        attribute="digitization_list_id"
                        label={t("facets.digitization-list")}
                        sortBy={["name:desc"]}
                        showMore
                        limit={5}
                    />
                    <EsRangeFacet
                        attribute="page_count"
                        label={t("facets.page-count")}
                    />
                    <EsNumberFacet attribute="id" label={t("facets.id")} />
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
            queryParamsIndexName="documents"
        />
    );
};

export default DocumentsQueryRules;
