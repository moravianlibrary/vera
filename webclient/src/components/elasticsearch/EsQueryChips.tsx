import React from "react";
import { EsQuery } from "../../adapters/ApiTasks";
import { Chip } from "primereact/chip";
import { useTranslation } from "react-i18next";

interface EsQueryChipsProps {
    queryParams: EsQuery;
}

const IGNORED_QUERY_PARAMS = ["index_name", "page", "page_size", "sort"];
const VALUE_TRANSLATION_KEYS = [
    "query",
    "added_by",
    "category_id",
    "digitization_list_id",
];

const EsQueryChips: React.FC<EsQueryChipsProps> = ({ queryParams }) => {
    const { t } = useTranslation();

    const getChip = (key, value, index) => {
        return (
            <Chip
                key={`${key}_${index}`}
                label={
                    VALUE_TRANSLATION_KEYS.includes(key)
                        ? t(`${queryParams.index_name}.query-params.${key}`, {
                              value,
                          })
                        : t(
                              `${queryParams.index_name}.query-params.${key}.${value}`
                          )
                }
            />
        );
    };

    if (!queryParams) {
        return null;
    }

    if (Object.keys(queryParams).length === 1) {
        return (
            <div>
                <Chip
                    label={t(
                        `${queryParams.index_name.replace(
                            "_",
                            "-"
                        )}.query-params.all`
                    )}
                />
            </div>
        );
    }

    return (
        <div>
            {Object.entries(queryParams)
                .filter(([key, value]) => !IGNORED_QUERY_PARAMS.includes(key))
                .map(([key, value]) =>
                    (typeof value === "string" ? value.split(",") : [value])
                        .filter((v) => v)
                        .map((v, i) => getChip(key, v, i))
                )}
        </div>
    );
};

export default EsQueryChips;
