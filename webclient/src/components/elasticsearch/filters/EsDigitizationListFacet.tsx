import React, { useEffect, useState } from "react";
import EsFacet, { EsFacetProps } from "./EsFacet";
import { useDigitizationLists } from "../../../contexts/DigitizationListsContext";

interface DigitizationListCheckboxLabelProps {
    label: string;
    value: string;
}

const DigitizationListCheckboxLabel: React.FC<
    DigitizationListCheckboxLabelProps
> = ({ label, value }) => {
    const { digitizationLists, findDigitizationList } = useDigitizationLists();

    const [valueLabel, setValueLabel] = useState<string>(value);

    useEffect(() => {
        const fetchLabel = async () => {
            try {
                let list = await digitizationLists.find(
                    (dl) => dl.id === Number(value)
                );
                if (!list) {
                    list = await findDigitizationList(Number(value));
                }
                setValueLabel(`${value}: ${list?.created_by}`);
            } catch (error) {
                setValueLabel(`${value}: [Error fetching list]`);
            }
        };

        fetchLabel();
    }, [value, digitizationLists]);

    return (
        <label htmlFor={`es-${label}-${value}-checkbox`}>{valueLabel}</label>
    );
};

const EsDigitizationListFacet: React.FC<EsFacetProps> = (props) => {
    return (
        <EsFacet
            {...props}
            onDisplayLabel={(item) => (
                <DigitizationListCheckboxLabel
                    label={props.label}
                    value={item.value}
                />
            )}
        />
    );
};

export default EsDigitizationListFacet;
