import React, { useEffect } from "react";
import { RangeInputProps, useRange } from "react-instantsearch";
import EsFilter from "./EsFilter";
import { Slider, SliderChangeEvent } from "primereact/slider";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";

interface EsRangeFacetProps extends RangeInputProps {
    label: string;
    onDisplayLabel?: (item) => React.ReactNode;
}

const EsRangeFacet: React.FC<EsRangeFacetProps> = ({ label, ...props }) => {
    const { range, canRefine, refine } = useRange(props);

    const [value, setValue] = React.useState<[number, number] | undefined>(
        undefined
    );

    useEffect(() => {
        if (range && range.min && range.max && !value) {
            setValue([range.min, range.max]);
        }
    }, [range]);

    if (!canRefine) return null;

    const handleChangeValue = (value: [number, number]) => {
        refine(value);
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
                    className="w-min"
                    value={value ? value[0] : undefined}
                    onChange={(e) =>
                        e.value &&
                        value &&
                        handleChangeValue([e.value, value[1]])
                    }
                />
                <InputNumber
                    className="w-min"
                    value={value ? value[1] : undefined}
                    onChange={(e) =>
                        e.value &&
                        value &&
                        handleChangeValue([value[0], e.value])
                    }
                />
                {/* <Button outlined icon="pi pi-search" /> */}
                <Button
                    outlined
                    severity="danger"
                    icon="pi pi-times"
                    onClick={() => refine([undefined, undefined])}
                />
            </div>
            <Slider
                className="m-2"
                value={value}
                min={range.min}
                max={range.max}
                range
                onChange={handleChangeSliderValue}
            />
        </EsFilter>
    );
};

export default EsRangeFacet;
export type { EsRangeFacetProps };
