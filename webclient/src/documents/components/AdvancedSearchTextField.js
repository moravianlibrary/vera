import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextOptions } from "../models/SearchNodes";

const AdvancedSearchTextField = (props) => {
    const { t } = useTranslation();

    const { data } = props;
    const [option, setOption] = useState(data.option);
    const [value, setValue] = useState(data.value);

    const handleSelectOption = (e) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleChangeValue = (e) => {
        data.setValue(e.target.value);
        setValue(e.target.value);
    };

    return (
        <div className="flex gap-1">
            <Dropdown
                className="w-12rem"
                value={option}
                onChange={handleSelectOption}
                options={Object.values(TextOptions)}
                optionLabel={(option) => t(option)} 
                placeholder={t('select_text_operation')} />
            {option !== TextOptions.IS_NULL && option !== TextOptions.IS_NOT_NULL &&
            <InputText
                className="w-14rem"
                autoFocus
                value={value}
                onChange={handleChangeValue} />}
        </div>
    );
};

export default AdvancedSearchTextField;
