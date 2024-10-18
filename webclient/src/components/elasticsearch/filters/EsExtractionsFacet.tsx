import React, { useEffect, useState } from "react";
import EsFacet, { EsFacetProps } from "./EsFacet";
import { useExtractions } from "../../../contexts/GeneratedExtractionsContext";

interface ExtractionCheckboxLabelProps {
    label: string;
    value: string;
}

const ExtractionCheckboxLabel: React.FC<ExtractionCheckboxLabelProps> = ({
    label,
    value,
}) => {
    const { extractions, findExtraction } = useExtractions();

    const [valueLabel, setValueLabel] = useState<string>(value);

    useEffect(() => {
        const fetchLabel = async () => {
            try {
                let extraction = await extractions.find(
                    (e) => e.id === Number(value)
                );
                if (!extraction) {
                    extraction = await findExtraction(Number(value));
                }
                setValueLabel(`${value}: ${extraction?.generated_by}`);
            } catch (error) {
                setValueLabel(`${value}: [Error fetching list]`);
            }
        };

        fetchLabel();
    }, [value, extractions]);

    return (
        <label htmlFor={`es-${label}-${value}-checkbox`}>{valueLabel}</label>
    );
};

const EsExtractionFacet: React.FC<EsFacetProps> = (props) => {
    return (
        <EsFacet
            {...props}
            onDisplayLabel={(item) => (
                <ExtractionCheckboxLabel
                    label={props.label}
                    value={item.value}
                />
            )}
        />
    );
};

export default EsExtractionFacet;
