import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import React from "react";
import LabeledComponent from "../../../../components/wrappers/LabeledComponent";
import CategoryPicker from "../../../../components/selects/CategoryPicker";
import { useCategoryModels } from "../../../../contexts/categories/CategoryNodesContext";
import { useTranslation } from "react-i18next";

interface CategoriesDisplayOptionsProps {}

const CategoriesDisplayOptions: React.FC<
    CategoriesDisplayOptionsProps
> = () => {
    const { t } = useTranslation("categories");
    const {
        currentCategory,
        activeLevel,
        focusAssignable,
        focusRootCategory,
        focusCategory,
        focusLevel,
        focusAssignableCategories,
    } = useCategoryModels();

    const levelOptions = [0, 1, 2, 3];

    return (
        <div className="card flex ml-2 gap-4 flex-wrap">
            <Button
                className="m-0 text-800"
                icon="pi pi-eye"
                text
                label={t("display-options.all")}
                onClick={() => focusRootCategory()}
            />
            <div className="flex gap-1 my-2 mx-1 align-items-center">
                <span className="p-button-label text-800">
                    {t("display-options.level")}:
                </span>
                <SelectButton
                    options={levelOptions}
                    value={activeLevel}
                    onChange={(e) => focusLevel(e.value)}
                />
            </div>
            <LabeledComponent
                label={t("display-options.selected-category")}
                className="p-button-label text-800 my-2 mx-1 align-items-center"
            >
                <CategoryPicker
                    className={currentCategory ? "border-primary border-3" : ""}
                    category_id={currentCategory?.id ?? null}
                    callback={focusCategory}
                />
            </LabeledComponent>
            <Button
                className={
                    focusAssignable
                        ? "m-0 text-800 border-yellow-500 bg-yellow-500"
                        : "m-0 text-800"
                }
                text={!focusAssignable}
                icon={focusAssignable ? "pi pi-star-fill" : "pi pi-star"}
                label={t("display-options.assignable")}
                onClick={() => focusAssignableCategories()}
            />
        </div>
    );
};

export default CategoriesDisplayOptions;
