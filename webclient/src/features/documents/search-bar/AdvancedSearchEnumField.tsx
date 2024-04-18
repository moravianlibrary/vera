import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchEnumField } from "../../../contexts/documents/search/SearchNodes";
import React from "react";
import { EnumOption } from "../../../types/SearchTypes";
import DocumentSearchField from "../../../types/DocumentSearchField";

interface AdvancedSearchEnumFieldProps {
    data: SearchEnumField;
}

const AdvancedSearchEnumField: React.FC<AdvancedSearchEnumFieldProps> = ({
    data,
}) => {
    const { t } = useTranslation();

    const options = DocumentSearchField[data.field!].enumOptions
        ? DocumentSearchField[data.field!].enumOptions.map((option) => ({
              value: option,
              label: t(option),
          }))
        : [];

    const [option, setOption] = useState(data.option);
    const [value, setValue] = useState<string>(data.value as string);

    const handleSelectOption = (e: DropdownChangeEvent) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleValueChange = (event: DropdownChangeEvent) => {
        if (event.value) {
            data.setValue(event.value);
            setValue(event.value);
        }
    };

    return (
        <div className="flex gap-1">
            <Dropdown
                className="w-12rem"
                value={option}
                onChange={handleSelectOption}
                options={Object.keys(EnumOption).map((option) => ({
                    value: option,
                    label: t(option),
                }))}
                placeholder={t("Select operation")}
            />
            {option !== EnumOption.IsNull &&
                option !== EnumOption.IsNotNull && (
                    <Dropdown
                        className="w-14rem w-full"
                        options={options}
                        value={value}
                        onChange={handleValueChange}
                    />
                )}
        </div>
    );
};

export default AdvancedSearchEnumField;
