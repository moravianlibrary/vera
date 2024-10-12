import React from "react";
import { Chips } from "primereact/chips";
import { EsQuery } from "../../adapters/ApiTasks";

interface EsQueryChipsProps {
    queryParams: EsQuery;
}

const EsQueryChips: React.FC<EsQueryChipsProps> = () => {
    return <Chips />;
};

export default EsQueryChips;
