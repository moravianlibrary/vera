import React from "react";
import EsSortBy from "../../components/elasticsearch/EsSortBy";
import { useTranslation } from "react-i18next";
import { valueToDocumentFlagTag } from "../../components/elasticsearch/filters/EsDocumentFlagFacet";
import useNewDocuments from "../../contexts/DocumentsContext copy";
import { valueToIssuanceTypeTag } from "../../components/tags/IssuanceTypeTag";
import { valueToMaterialTypeTag } from "../../components/tags/MaterialTypeTag";
import { valueToDigitizationStateTag } from "../../components/tags/DigitizationStateTag";
import DocumentFlag, { orderBy } from "../../types/DocumentFlag";
import EsQueryRulesLayout from "../../components/layouts/EsQueryRulesLayout copy";

interface DocumentsQueryRulesProps {}

const DocumentsQueryRules: React.FC<DocumentsQueryRulesProps> = () => {
    const { t } = useTranslation("documents");

    return (
        <EsQueryRulesLayout
            context={useNewDocuments()}
            sortBy={
                <EsSortBy
                    items={[
                        {
                            label: t("sort-by.newest"),
                            value: "documents_newest",
                        },
                        {
                            label: t("sort-by.oldest"),
                            value: "documents_oldest",
                        },
                        {
                            label: t("sort-by.last-edited"),
                            value: "documents_last_edited",
                        },
                        {
                            label: t("sort-by.extraction-priority"),
                            value: "documents_extraction_priority",
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
            facetsProps={[
                {
                    field: "document_flags",
                    operator: "and",
                    label: t("facets.document-flags"),
                    onDisplayLabel: valueToDocumentFlagTag,
                    orderBy: (a, b) =>
                        orderBy(a.key as DocumentFlag, b.key as DocumentFlag),
                },
                {
                    field: "digitization_state",
                    label: t("facets.digitization-state"),
                    onDisplayLabel: valueToDigitizationStateTag,
                },
                {
                    field: "material_type",
                    label: t("facets.material-type"),
                    onDisplayLabel: valueToMaterialTypeTag,
                },
                {
                    field: "issuance_type",
                    label: t("facets.issuance-type"),
                    onDisplayLabel: valueToIssuanceTypeTag,
                },
                {
                    field: "added_by",
                    label: t("facets.added-by"),
                },
                {
                    field: "category_ids",
                    label: t("facets.category"),
                    showLimit: 100,
                },
                {
                    field: "extraction_ids",
                    label: t("facets.extraction"),
                    showLimit: 5,
                },
                {
                    field: "digitization_list_id",
                    label: t("facets.digitization-list"),
                    showLimit: 5,
                },
            ]}
        />
    );
};

export default DocumentsQueryRules;
