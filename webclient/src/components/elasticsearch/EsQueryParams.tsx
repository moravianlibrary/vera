import { useTranslation } from "react-i18next";
import { EsQuery } from "../../adapters/ApiTasks";
import EsQueryChips from "./EsQueryChips";
import { Button } from "primereact/button";
import { useClearRefinements } from "react-instantsearch";

interface EsQueryParamsProps {
    queryParams: EsQuery;
}

const EsQueryParams: React.FC<EsQueryParamsProps> = ({ queryParams }) => {
    const { t } = useTranslation("elasticsearch");
    const { canRefine, refine } = useClearRefinements();

    return (
        <div className="flex flex-column gap-2">
            <EsQueryChips queryParams={queryParams} />
            <Button
                outlined
                label={t("cancel-filters")}
                disabled={!canRefine}
                onClick={refine}
            />
        </div>
    );
};

export default EsQueryParams;
