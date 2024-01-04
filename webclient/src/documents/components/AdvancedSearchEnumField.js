import { Dropdown } from "primereact/dropdown";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EnumOptions, TextOptions } from "../models/SearchNodes";
import DocumentField from "../models/DocumentField";

const AdvancedSearchEnumField = (props) => {
    const { t } = useTranslation();

    const { data, enums } = props;
    const options = enums && enums[DocumentField.CATEGORY.name]?.values || [];
    const placeholder = enums && enums[DocumentField.CATEGORY.name]?.placeholder || "";
    const [option, setOption] = useState(data.option);
    const [value, setValue] = useState(options.find(option => option.id === data.value.id));

    const handleSelectOption = (e) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleChangeValue = (e) => {
        console.log("change category");
        data.setValue(e.value);
        setValue(e.value);
    };

    return (
        <div className="flex gap-1">
            <Dropdown
                value={option}
                onChange={handleSelectOption}
                options={Object.values(EnumOptions)}
                optionLabel={(option) => t(option)} 
                placeholder={t('select_enum_operation')} />
            {option !== TextOptions.IS_NULL && option !== TextOptions.IS_NOT_NULL &&
            <Dropdown
                value={value}
                onChange={handleChangeValue}
                options={options}
                optionLabel={(option) => option.name} 
                placeholder={placeholder} />}
        </div>
    );
};

export default AdvancedSearchEnumField;

