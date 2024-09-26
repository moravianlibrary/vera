import React from "react";
import { MarcFieldDifference } from "../../../adapters/ApiCatalogRecords";
import getDiffernceLegend from "./DifferenceLegend";

interface ExtraFieldDifferenceProps {
    difference: MarcFieldDifference;
}

const ExtraFieldDifference: React.FC<ExtraFieldDifferenceProps> = ({
    difference,
}) => {
    return (
        getDiffernceLegend(difference) +
        difference.subfield_differences
            .map((d) => `|${d.code || ""} ${d.value}`)
            .join(" ")
    );
};

export default ExtraFieldDifference;
