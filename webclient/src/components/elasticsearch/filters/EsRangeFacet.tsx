import React, { useEffect, useState } from "react";
import {
    RangeInputProps,
    useInstantSearch,
    useRange,
} from "react-instantsearch";
import EsFilter from "./EsFilter";
import { Slider, SliderChangeEvent } from "primereact/slider";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";

interface EsRangeFacetProps extends RangeInputProps {
    label: string;
    onDisplayLabel?: (item) => React.ReactNode;
}

const EsRangeFacet: React.FC<EsRangeFacetProps> = ({ label, ...props }) => {
    const { start, range, canRefine, refine } = useRange(props);

    const [value, setValue] = useState<[number, number] | undefined>(undefined);
    const [sliderValue, setSliderValue] = useState<[number, number]>([
        -Infinity,
        Infinity,
    ]);
    const [isActive, setIsActive] = useState<boolean>(
        start[0] !== -Infinity || start[1] !== Infinity
    );

    useEffect(() => {
        if (range && range.min && range.max && !value) {
            const initValue: [number, number] = [
                Math.max(start[0] || -Infinity, range.min),
                Math.min(start[1] || Infinity, range.max),
            ];
            setValue(initValue);
            setSliderValue(initValue);
            refine(initValue);
        }
    }, [start, range]);

    useEffect(() => {
        setIsActive(start[0] !== -Infinity || start[1] !== Infinity);
    }, [start]);

    if (!canRefine) return null;

    const handleChangeValue = (value: [number, number]) => {
        const limitedValue: [number, number] = [
            Math.max(Math.min(value[0], range.max!), range.min!),
            Math.max(Math.min(value[1], range.max!), range.min!),
        ];

        refine(limitedValue);
        setSliderValue(limitedValue);
        setValue(value);
    };

    const handleChangeSliderValue = (e: SliderChangeEvent) => {
        handleChangeValue([
            Math.min(e.value[0], e.value[1]),
            Math.max(e.value[0], e.value[1]),
        ]);
    };

    return (
        <EsFilter label={label}>
            <div className="flex p-inputgroup">
                <InputNumber
                    id={`facet-range-min-v-${label}`}
                    className="w-min"
                    value={value ? value[0] : undefined}
                    onChange={(e) =>
                        e.value &&
                        value &&
                        handleChangeValue([e.value, value[1]])
                    }
                />
                <InputNumber
                    id={`facet-range-max-v-${label}`}
                    className="w-min"
                    value={value ? value[1] : undefined}
                    onChange={(e) =>
                        e.value &&
                        value &&
                        handleChangeValue([value[0], e.value])
                    }
                />
                <Button
                    outlined
                    severity="danger"
                    icon="pi pi-times"
                    disabled={!isActive}
                    onClick={() => handleChangeValue([range.min!, range.max!])}
                />
            </div>
            {/* <Slider
                id={`facet-range-slider-${label}`}
                className="m-2 w-auto"
                value={sliderValue}
                min={range.min}
                max={range.max}
                range
                onChange={handleChangeSliderValue}
            /> */}
        </EsFilter>
    );
};

export default EsRangeFacet;
export type { EsRangeFacetProps };
