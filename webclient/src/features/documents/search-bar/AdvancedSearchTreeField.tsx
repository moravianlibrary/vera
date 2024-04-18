import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchTreeField } from "../../../contexts/documents/search/SearchNodes";
import React from "react";
import { TreeSelectSelectionKeysType } from "primereact/treeselect";
import { TextOption, TreeOption } from "../../../types/SearchTypes";
import CategoryPicker from "../../../components/pickers/CategoryPicker";

interface AdvancedSearchTreeFieldProps {
    data: SearchTreeField;
}

const AdvancedSearchTreeField: React.FC<AdvancedSearchTreeFieldProps> = ({
    data,
}) => {
    const { t } = useTranslation();

    const [option, setOption] = useState(data.option);
    const [categoryId, setCategoryId] = useState<number | null>(
        data.value && Array.isArray(data.value) && data.value.length > 0
            ? (data.value[0] as number)
            : null
    );

    const handleSelectOption = (e: DropdownChangeEvent) => {
        data.setOption(e.value);
        setOption(e.value);
    };

    const handleSelectCategory = (categoryIds: number[]) => {
        data.setValue(categoryIds);
        setCategoryId(categoryIds.length > 0 ? categoryIds[0] : null);
    };

    return (
        <div className="flex gap-1">
            <Dropdown
                className="w-12rem"
                value={option}
                onChange={handleSelectOption}
                options={Object.keys(TreeOption).map((option) => ({
                    value: option,
                    label: t(option),
                }))}
                placeholder={t("Select operation")}
            />
            {option !== TextOption.IsNull &&
                option !== TextOption.IsNotNull && (
                    <CategoryPicker
                        className="w-14rem w-full"
                        category_id={categoryId}
                        callbackSubcategories={handleSelectCategory}
                    />
                )}
        </div>
    );
};

export default AdvancedSearchTreeField;
