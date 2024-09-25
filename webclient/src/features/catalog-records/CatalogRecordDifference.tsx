import React from "react";
import {
    MarcFieldDifference,
    MarcSubfieldDifference,
} from "../../adapters/ApiCatalogRecords";
import { useTranslation } from "react-i18next";

interface CatalogRecordsDifferencesProps {
    difference: MarcFieldDifference;
}

const getSubfieldsOriginalValue = (differences: MarcSubfieldDifference[]) => {
    return differences.map((d) => `|${d.code} ${d.value}`).join(" ");
};

const getSubfieldsDifferentToValue = (
    differences: MarcSubfieldDifference[]
) => {
    return differences.map((d) => `|${d.code} ${d.different_to}`).join(" ");
};

const CatalogRecordsDifference: React.FC<CatalogRecordsDifferencesProps> = ({
    difference,
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex justify-content-between align-items-center">
            <span className="font-bold">
                {t(
                    `catalog-records.table.difference.${difference.difference_type}`
                )}
                :
            </span>
            <div className="flex">
                <span
                    className="ml-2"
                    style={{
                        whiteSpace: "pre",
                        border: "1px solid black",
                        borderRadius: "5px",
                        padding: "5px",
                        margin: "5px",
                    }}
                >
                    {getSubfieldsOriginalValue(difference.subfield_differences)}
                </span>
                <span
                    className="ml-2"
                    style={{
                        whiteSpace: "pre",
                        border: "1px solid black",
                        borderRadius: "5px",
                        padding: "5px",
                        margin: "5px",
                    }}
                >
                    {getSubfieldsDifferentToValue(
                        difference.subfield_differences
                    )}
                </span>
            </div>
        </div>
    );
};

export default CatalogRecordsDifference;
