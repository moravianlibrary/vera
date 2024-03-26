import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchNumberField } from "../../../contexts/documents/search/SearchNodes";
import {
    InputNumber,
    InputNumberValueChangeEvent,
} from "primereact/inputnumber";
import React from "react";
import { NumberOption } from "../../../types/SearchTypes";

interface AdvancedSearchNumberFieldProps {
    data: SearchNumberField;
}

const AdvancedSearchNumberField: React.FC<AdvancedSearchNumberFieldProps> = ({
    data,
}) => {
    const { t } = useTranslation();

    const [option, setOption] = useState<NumberOption | undefined>(
        data.option as NumberOption
    );
    const [value1, setValue1] = useState<number | null | undefined>(
        data.option === NumberOption.Between ? data.value?.[0] : data.value
    );
    const [value2, setValue2] = useState<number | null | undefined>(
        data.option === NumberOption.Between ? data.value?.[1] : undefined
    );

    const handleSelectOption = (e: DropdownChangeEvent) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleChangeValue1 = (e: InputNumberValueChangeEvent) => {
        if (option === NumberOption.Between && data.setFirstValue) {
            data.setFirstValue(e.value);
        } else {
            data.setValue(e.value ? e.value : undefined);
        }
        setValue1(e.value);
    };

    const handleChangeValue2 = (e: InputNumberValueChangeEvent) => {
        if (option === NumberOption.Between && data.setSecondValue) {
            data.setSecondValue(e.value);
        }
        setValue2(e.value);
    };

    return (
        <div className="flex gap-1">
            <Dropdown
                className="w-12rem"
                value={option}
                onChange={handleSelectOption}
                options={Object.values(NumberOption)}
                placeholder={t("Select operation")}
            />
            {option !== NumberOption.IsNull &&
                option !== NumberOption.IsNotNull && (
                    <div className="flex w-14rem gap-1">
                        <InputNumber
                            autoFocus
                            localeMatcher="lookup"
                            value={value1}
                            onValueChange={handleChangeValue1}
                            min={0}
                            max={100000}
                            maxFractionDigits={0}
                        />
                        {option === NumberOption.Between && (
                            <InputNumber
                                localeMatcher="lookup"
                                value={value2}
                                onValueChange={handleChangeValue2}
                                min={0}
                                max={100000}
                                maxFractionDigits={0}
                            />
                        )}
                    </div>
                )}
        </div>
    );
};

export default AdvancedSearchNumberField;
