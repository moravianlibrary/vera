import React from "react";
import { MarcFieldDifference } from "../../../adapters/ApiCatalogRecords";
import getDiffernceLegend from "./DifferenceLegend";

interface MissingFieldDifferenceProps {
    difference: MarcFieldDifference;
}

const MissingFieldDifference: React.FC<MissingFieldDifferenceProps> = ({
    difference,
}) => {
    return (
        getDiffernceLegend(difference) +
        difference.subfield_differences
            .map((d) => `|${d.code || ""} ${d.different_to}`)
            .join(" ")
    );
};

export default MissingFieldDifference;
