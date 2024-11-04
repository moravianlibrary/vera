import React, { useEffect, useState } from "react";
import { RangeInputProps, useRange } from "react-instantsearch";
import EsFilter from "./EsFilter";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";

interface EsNumberFacetProps extends RangeInputProps {
    label: string;
    onDisplayLabel?: (item) => React.ReactNode;
}

const EsNumberFacet: React.FC<EsNumberFacetProps> = ({ label, ...props }) => {
    const { start, range, canRefine, refine } = useRange(props);

    const [value, setValue] = useState<[number, number] | undefined>(undefined);
    const [isActive, setIsActive] = useState<boolean>(start[0] === start[1]);

    useEffect(() => {
        if (range && range.min && range.max && !value) {
            const initValue: [number, number] = [
                Math.max(start[0] || -Infinity, range.min),
                Math.min(start[1] || Infinity, range.max),
            ];
            setValue(initValue);
            refine(initValue);
        }
    }, [start, range]);

    useEffect(() => {
        setIsActive(start[0] !== -Infinity || start[1] !== Infinity);
    }, [start]);

    if (!canRefine) return null;

    const handleChangeValue = (value: number) => {
        setValue([value, value]);
    };

    const handleApplyFilter = () => {
        if (value) {
            refine(value);
        }
    };

    const handleCancelFilter = () => {
        handleChangeValue(undefined);
        refine([range.min!, range.max!]);
    };

    return (
        <EsFilter label={label}>
            <div className="flex p-inputgroup">
                <InputNumber
                    id={`facet-range-min-v-${label}`}
                    className="w-min"
                    value={
                        value && value[0] === value[1] ? value[0] : undefined
                    }
                    onChange={(e) =>
                        e.value && value && handleChangeValue(e.value)
                    }
                />
                <Button
                    outlined
                    severity="info"
                    icon="pi pi-search"
                    onClick={handleApplyFilter}
                />
                {isActive && (
                    <Button
                        outlined
                        severity="danger"
                        icon="pi pi-times"
                        onClick={handleCancelFilter}
                    />
                )}
            </div>
        </EsFilter>
    );
};

export default EsNumberFacet;
export type { EsNumberFacetProps };
