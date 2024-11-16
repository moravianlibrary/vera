import React from "react";
import { MarcFieldDifference } from "../../../adapters/ApiCatalogRecords";
import getDiffernceLegend from "./DifferenceLegend";

interface GeneralInformationDifferenceProps {
    difference: MarcFieldDifference;
}

interface GeneralInformationMapping {
    start: number;
    end: number;
    hasToMatch?: boolean;
}

const dataMapping: GeneralInformationMapping[] = [
    { start: 0, end: 7 },
    { start: 7, end: 11, hasToMatch: true },
    { start: 11, end: 15, hasToMatch: true },
    { start: 15, end: 18, hasToMatch: true },
    { start: 18, end: 35 },
    { start: 35, end: 38, hasToMatch: true },
    { start: 38, end: 41 },
];

const GeneralInformationDifference: React.FC<
    GeneralInformationDifferenceProps
> = ({ difference }) => {
    if (!difference.subfield_differences[0]?.value) {
        return null;
    }

    const value = difference.subfield_differences[0].value!.replace(/ /g, "-");
    const differentTo =
        difference.subfield_differences[0].different_to!.replace(/ /g, "-");

    const getClassName = (
        value1: string,
        value2: string,
        mapping: GeneralInformationMapping
    ) => {
        return !mapping.hasToMatch ||
            value1.slice(mapping.start, mapping.end) ===
                value2.slice(mapping.start, mapping.end)
            ? ""
            : "text-red-700 font-bold";
    };

    return (
        <div>
            {[
                [value, differentTo],
                [differentTo, value],
            ].map(([value1, value2], index) => (
                <div key={index}>
                    <span>{`${getDiffernceLegend(difference)}|  `}</span>
                    {dataMapping.map((mapping, innerIndex) => (
                        <span
                            key={innerIndex}
                            className={getClassName(value1, value2, mapping)}
                        >
                            {value1.slice(mapping.start, mapping.end)}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default GeneralInformationDifference;
