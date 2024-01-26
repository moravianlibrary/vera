import { Dropdown } from "primereact/dropdown";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NumberOption } from "../../../contexts/documents/search/SearchNodes";
import { InputNumber } from "primereact/inputnumber";
import React from "react";

const AdvancedSearchNumberField = (props) => {
    const { t } = useTranslation();

    const { data } = props;
    const [option, setOption] = useState(data.option);
    const [value1, setValue1] = useState(data.option === NumberOption.Between ? data.value[0] : data.value);
    const [value2, setValue2] = useState(data.option === NumberOption.Between ? data.value[1] : "");

    const handleSelectOption = (e) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleChangeValue1 = (e) => {
        if (option === NumberOption.Between) {
            data.setFirstValue(e.value);
        } else {
            data.setValue(e.value);
        }
        setValue1(e.value);
    };

    const handleChangeValue2 = (e) => {
        if (option === NumberOption.Between) {
            data.setSecondValue(e.value);
        }
        setValue2(e.value);
    };

    return (
        <div className="flex gap-1">
            <Dropdown
                value={option}
                onChange={handleSelectOption}
                options={Object.values(NumberOption)}
                // optionLabel={(option) => t(option)} 
                placeholder={t('select_number_operation')}
            />
            {option !== NumberOption.IsNull && option !== NumberOption.IsNotNull &&
            <InputNumber
                autoFocus
                value={value1}
                onValueChange={handleChangeValue1}
                min={0} max={100000}
                maxFractionDigits={0} />}
            {option === NumberOption.Between &&
            <InputNumber
                value={value2}
                onValueChange={handleChangeValue2}
                min={0} max={100000}
                maxFractionDigits={0} />}
        </div>
    );
};

export default AdvancedSearchNumberField;
