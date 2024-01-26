import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchTextField, TextOption } from "../../../contexts/documents/search/SearchNodes";
import React from "react";

interface AdvancedSearchTextFieldProps {
    data: SearchTextField;
}

const AdvancedSearchTextField: React.FC<AdvancedSearchTextFieldProps> = ({ data }) => {
    const { t } = useTranslation();

    const [option, setOption] = useState<TextOption>(data.option as TextOption);
    const [value, setValue] = useState<string>(data.value as string);

    const handleSelectOption = (e: DropdownChangeEvent) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleChangeValue = (e: React.ChangeEvent<HTMLInputElement>) => {
        data.setValue(e.target.value);
        setValue(e.target.value);
    };

    return (
        <div className="flex gap-1">
            <Dropdown
                className="w-12rem"
                value={option}
                onChange={handleSelectOption}
                options={Object.values(TextOption)}
                // options={Object.keys(TextOption).map(option => ({ value: option, label: t(option) }))}
                placeholder={t('Select operation')} />
            {option !== TextOption.IsNull && option !== TextOption.IsNotNull &&
            <InputText
                className="w-14rem"
                autoFocus
                value={value}
                onChange={handleChangeValue} />}
        </div>
    );
};

export default AdvancedSearchTextField;
