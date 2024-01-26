import { Dropdown } from "primereact/dropdown";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EnumOption, TextOption } from "../../../contexts/documents/search/SearchNodes";
import DocumentField from "../../../documents/models/DocumentField";
import React from "react";

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
                options={Object.values(EnumOption)}
                // optionLabel={(option) => t(option)} 
                placeholder={t('select_enum_operation')} />
            {option !== TextOption.IsNull && option !== TextOption.IsNotNull &&
            <Dropdown
                value={value}
                onChange={handleChangeValue}
                options={options}
                // optionLabel={(option) => option.name} 
                placeholder={placeholder} />}
        </div>
    );
};

export default AdvancedSearchEnumField;

