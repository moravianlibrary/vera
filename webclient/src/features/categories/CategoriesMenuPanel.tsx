import { Button } from "primereact/button";
import { Divider } from "primereact/divider";
import { SelectButton } from "primereact/selectbutton";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { useCategories } from "../../contexts/categories/CategoriesContext";
import CategoryPicker from "../../components/pickers/CategoryPicker";
import { CategoryType } from "../../contexts/categories/CategoryType";
import ExtractionPicker from "../../components/pickers/ExtractionPicker";
import { Toolbar } from "primereact/toolbar";
import { IntentionCreate } from "../../adapters/ApiCategories";
import { useIntentions } from "../../contexts/categories/IntentionsContext";
import EditIntentionMenu, {
    EditIntentionMenuRef,
} from "./components/EditIntentionMenu";
import { format } from "date-fns";
import { IntentionFactory } from "../../data/factories/IntentionFactory";
import IntentionPicker from "../../components/pickers/IntentionPicker";
import LabeledComponent from "../../components/LabeledComponent";
import DepartmentPicker from "../../components/pickers/DepartmentPicker";

export enum CategoryViewType {
    CategoryTable = "CategoryTable",
    CategoryChart = "CategoryChart",
}

export enum CategorySection {
    Categories = "Categories",
    Intentions = "Intentions",
}

interface CategoriesMenuPanelProps {
    categoryViewType: CategoryViewType;
    onCategoryViewTypeChange: (viewType: CategoryViewType) => void;
    categorySection: CategorySection;
    onCategorySectionChange: (section: CategorySection) => void;
}

const CategoriesMenuPanel: React.FC<CategoriesMenuPanelProps> = ({
    categoryViewType,
    onCategoryViewTypeChange,
    categorySection,
    onCategorySectionChange,
}) => {
    const { t } = useTranslation();

    const getStartContent = () => {
        if (categorySection === CategorySection.Categories) {
            return (
                <CategoryOptions
                    categoryViewType={categoryViewType}
                    onCategoryViewTypeChange={onCategoryViewTypeChange}
                />
            );
        } else if (categorySection === CategorySection.Intentions) {
            return <IntentionsOptions />;
        }
    };

    return (
        <Toolbar
            className="p-2 surface-100 w-full"
            start={getStartContent()}
            end={
                <SelectCategorySection
                    section={categorySection}
                    onSectionChange={onCategorySectionChange}
                />
            }
        />
    );
};

interface CategoryOptionsProps {
    categoryViewType: CategoryViewType;
    onCategoryViewTypeChange: (viewType: CategoryViewType) => void;
}

const CategoryOptions: React.FC<CategoryOptionsProps> = ({
    categoryViewType,
    onCategoryViewTypeChange,
}) => {
    const { t } = useTranslation();
    const {
        currentCategory,
        showIntentionOnly,
        setShowIntentionOnly,
        activeLevel,
        focusAssignable,
        focusRootCategory,
        focusCategory,
        focusLevel,
        focusAssignableCategories,
    } = useCategoryModels();
    const { extractionId, setExtractionId, department, setDepartment } =
        useCategories();
    const { activeIntention, selectIntention } = useIntentions();

    const levelOptions = [0, 1, 2, 3];

    const [selectedCategory, setSelectedCategory] = useState<number | null>(
        null
    );

    useEffect(() => {
        if (currentCategory) {
            setSelectedCategory(
                currentCategory.type === CategoryType.Root ||
                    currentCategory.type === CategoryType.LevelRoot
                    ? null
                    : currentCategory.id
            );
        }
    }, [currentCategory]);

    const handleFocusCategory_ = (category_id: number | null) => {
        if (category_id) {
            focusCategory(category_id);
        } else {
            focusRootCategory();
        }
    };

    return (
        <div className="flex ml-2 gap-4 flex-wrap">
            <SelectCategoryViewType
                categoryViewType={categoryViewType}
                onCategoryViewTypeChange={onCategoryViewTypeChange}
            />
            {/* <Divider layout="vertical" /> */}
            <Button
                className="m-0 text-800"
                icon="pi pi-eye"
                text
                label={t("All categories")}
                onClick={() => focusRootCategory()}
            />
            {/* <Divider layout="vertical" /> */}
            <div className="flex gap-1 my-2 mx-1 align-items-center">
                <span className="p-button-label text-800">
                    {t("Categories of level")}:
                </span>
                <SelectButton
                    options={levelOptions}
                    value={activeLevel}
                    onChange={(e) => focusLevel(e.value)}
                />
            </div>
            {/* <Divider layout="vertical" /> */}
            <LabeledComponent
                label={t("Selected category")}
                className="p-button-label text-800 my-2 mx-1 align-items-center"
            >
                <CategoryPicker
                    className={
                        selectedCategory ? "border-primary border-3" : ""
                    }
                    category_id={selectedCategory}
                    callback={handleFocusCategory_}
                />
            </LabeledComponent>
            {/* <Divider layout="vertical" /> */}
            <Button
                className={
                    focusAssignable
                        ? "m-0 text-800 border-yellow-500 bg-yellow-500"
                        : "m-0 text-800"
                }
                text={!focusAssignable}
                icon={focusAssignable ? "pi pi-star-fill" : "pi pi-star"}
                label={t("Assignable categories")}
                onClick={() => focusAssignableCategories()}
            />
            <Button
                className={activeIntention ? "m-0 text-800" : "m-0 bg-primary"}
                text={activeIntention !== null}
                label={t("Without intention")}
                onClick={() => selectIntention(null)}
            />
            <LabeledComponent
                label={t("Selected intention")}
                className="p-button-label text-800 my-2 mx-1 align-items-center"
            >
                <IntentionPicker
                    selectedIntention={activeIntention}
                    onIntentionChange={selectIntention}
                />
            </LabeledComponent>
            {activeIntention !== null && (
                <Button
                    className={
                        showIntentionOnly ? "m-0 bg-primary" : "m-0 text-800"
                    }
                    text={!showIntentionOnly}
                    label={t("Show only intention categories")}
                    onClick={() => setShowIntentionOnly(!showIntentionOnly)}
                />
            )}
            <LabeledComponent
                label={t("Selected department")}
                className="p-button-label text-800 my-2 mx-1 align-items-center"
            >
                <DepartmentPicker
                    selectedDepartment={department}
                    onDepartmentChange={setDepartment}
                />
            </LabeledComponent>

            {/* <Divider layout="vertical" /> */}
            {/* <div className="flex gap-1 my-2 mx-1 align-items-center">
                <span className="p-button-label text-800">
                    {t("Show extraction")}:
                </span>
                <ExtractionPicker
                    extraction_id={extractionId}
                    callback={setExtractionId}
                />
            </div> */}
        </div>
    );
};

interface SelectCategoryViewTypeProps {
    categoryViewType: CategoryViewType;
    onCategoryViewTypeChange: (viewType: CategoryViewType) => void;
}

const SelectCategoryViewType: React.FC<SelectCategoryViewTypeProps> = ({
    categoryViewType,
    onCategoryViewTypeChange,
}) => {
    const { t } = useTranslation();

    const displayOptions = [
        {
            label: t("Table"),
            icon: "pi pi-table",
            value: CategoryViewType.CategoryTable,
        },
        {
            label: t("Chart"),
            icon: "pi pi-chart",
            value: CategoryViewType.CategoryChart,
        },
    ];

    const handleCategoryViewTypeChange = (e) => {
        if (e.value !== null) {
            onCategoryViewTypeChange(e.value);
        }
    };

    return (
        <div className="flex align-items-center">
            <SelectButton
                value={categoryViewType}
                onChange={handleCategoryViewTypeChange}
                options={displayOptions}
            />
        </div>
    );
};

interface SelectCategorySectionProps {
    section: CategorySection;
    onSectionChange: (section: CategorySection) => void;
}

const SelectCategorySection: React.FC<SelectCategorySectionProps> = ({
    section,
    onSectionChange,
}) => {
    const { t } = useTranslation();

    const displayOptions = [
        {
            label: t("Categories"),
            value: CategorySection.Categories,
        },
        {
            label: t("Intentions"),
            value: CategorySection.Intentions,
        },
    ];

    const handleSectionChange = (e) => {
        if (e.value !== null) {
            onSectionChange(e.value);
        }
    };

    return (
        <div className="flex align-items-center mr-2">
            <SelectButton
                value={section}
                onChange={handleSectionChange}
                options={displayOptions}
            />
        </div>
    );
};

interface IntentionsOptionsProps {}

const IntentionsOptions: React.FC<IntentionsOptionsProps> = () => {
    const { t } = useTranslation();
    const { createIntention } = useIntentions();

    const editIntentionRef = useRef<EditIntentionMenuRef>(null);

    return (
        <div className="flex ml-2 gap-4 flex-wrap">
            <EditIntentionMenu
                ref={editIntentionRef}
                intention={IntentionFactory.createEmpty()}
                callback={createIntention}
            />
            <Button
                className="m-0 text-800"
                icon="pi pi-plus"
                text
                label={t("Add intention")}
                onClick={() => editIntentionRef.current?.toggle()}
            />
        </div>
    );
};

export default CategoriesMenuPanel;
