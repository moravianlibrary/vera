import { Dropdown } from "primereact/dropdown";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NumberOptions } from "../models/SearchNodes";
import { InputNumber } from "primereact/inputnumber";

const AdvancedSearchNumberField = (props) => {
    const { t } = useTranslation();

    const { data } = props;
    const [option, setOption] = useState(data.option);
    const [value1, setValue1] = useState(data.option === NumberOptions.BETWEEN ? data.value[0] : data.value);
    const [value2, setValue2] = useState(data.option === NumberOptions.BETWEEN ? data.value[1] : "");

    const handleSelectOption = (e) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleChangeValue1 = (e) => {
        if (option === NumberOptions.BETWEEN) {
            data.setFirstValue(e.value);
        } else {
            data.setValue(e.value);
        }
        setValue1(e.value);
    };

    const handleChangeValue2 = (e) => {
        if (option === NumberOptions.BETWEEN) {
            data.setSecondValue(e.value);
        }
        setValue2(e.value);
    };

    return (
        <div className="flex gap-1">
            <Dropdown
                value={option}
                onChange={handleSelectOption}
                options={Object.values(NumberOptions)}
                optionLabel={(option) => t(option)} 
                placeholder={t('select_number_operation')}
            />
            {option !== NumberOptions.IS_NULL && option !== NumberOptions.IS_NOT_NULL &&
            <InputNumber
                autoFocus
                value={value1}
                onValueChange={handleChangeValue1}
                min={0} max={100000}
                maxFractionDigits={0} />}
            {option === NumberOptions.BETWEEN &&
            <InputNumber
                value={value2}
                onValueChange={handleChangeValue2}
                min={0} max={100000}
                maxFractionDigits={0} />}
        </div>
    );
};

export default AdvancedSearchNumberField;
