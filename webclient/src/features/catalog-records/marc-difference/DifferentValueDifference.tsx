import React, { Fragment } from "react";
import {
    MarcFieldDifference,
    MarcSubfieldDifference,
} from "../../../adapters/ApiCatalogRecords";
import getDiffernceLegend from "./DifferenceLegend";

interface DifferentValueDifferenceProps {
    difference: MarcFieldDifference;
}

const DifferentValueDifference: React.FC<DifferentValueDifferenceProps> = ({
    difference,
}) => {
    const getSubfieldDifferencesBody = (
        onGetValue: (d: MarcSubfieldDifference) => string | null
    ) => {
        return difference.subfield_differences.map((d, index) => (
            <Fragment key={index}>
                <span
                    key={`${index}-${d.code}-code`}
                    className={onGetValue(d) ? "" : "text-red-700 font-bold"}
                >{`${index == 0 ? "|" : " |"}${d.code} `}</span>
                {onGetValue(d) && (
                    <span
                        key={`${index}-${d.code}-value`}
                        className="text-red-700 font-bold"
                    >
                        {onGetValue(d)}
                    </span>
                )}
            </Fragment>
        ));
    };

    return (
        <div>
            <div>
                <span>{getDiffernceLegend(difference)}</span>
                {getSubfieldDifferencesBody((d) => d.value)}
            </div>
            <div>
                <span>{getDiffernceLegend(difference)}</span>
                {getSubfieldDifferencesBody((d) => d.different_to)}
            </div>
        </div>
    );
};

export default DifferentValueDifference;
