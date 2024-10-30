import { useTranslation } from "react-i18next";
import { EsQuery } from "../../adapters/ApiTasks";
import EsQueryChips from "./EsQueryChips";
import { Button } from "primereact/button";
import { useClearRefinements, useSearchBox } from "react-instantsearch";

interface EsQueryParamsProps {
    queryParams: EsQuery;
}

const EsQueryParams: React.FC<EsQueryParamsProps> = ({ queryParams }) => {
    const { t } = useTranslation("elasticsearch");
    const { canRefine, refine } = useClearRefinements();
    const { query, clear } = useSearchBox();

    const clearSearch = () => {
        refine();
        clear();
    };

    return (
        <div className="flex flex-column gap-2">
            <EsQueryChips queryParams={queryParams} />
            <Button
                outlined
                label={t("cancel-filters")}
                disabled={!canRefine && query == ""}
                onClick={clearSearch}
            />
        </div>
    );
};

export default EsQueryParams;
