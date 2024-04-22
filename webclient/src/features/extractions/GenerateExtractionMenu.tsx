import { InputNumber } from "primereact/inputnumber";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GenerateExtraction } from "../../adapters/ApiGeneratedExtractions";
import { useGeneratedExtractions } from "../../contexts/extractions/GeneratedExtractionsContext";
import { AssignableCategoriesProvider } from "../../contexts/categories/AssignableCategoriesContext";
import { AssignableCategoriesPicker } from "../../components/pickers/AssignableCategoryPicker";
import LabeledComponent from "../../components/LabeledComponent";
import { Button } from "primereact/button";

interface ExtractionPropsMenuProps {}

const ExtractionPropsMenu: React.FC<ExtractionPropsMenuProps> = () => {
    const { t } = useTranslation();
    const { defaultProps, generateExtraction, generating } =
        useGeneratedExtractions();

    const [extractionProps, setExtractionProps] = useState<GenerateExtraction>(
        JSON.parse(JSON.stringify(defaultProps))
    );

    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [pagesCount, setPagesCount] = useState<number | null>(null);

    const handleCategoriesChange = (categories: number[]) => {
        extractionProps.include_categories = categories;
        setExtractionProps(extractionProps);
        setSelectedCategories(categories);
    };

    const handleGenerate = () => {
        if (!generating && pagesCount) {
            generateExtraction(extractionProps, pagesCount, undefined);
        }
    };

    return (
        <div className="flex flex-column gap-1">
            <LabeledComponent
                className="justify-content-between"
                label={t("Target pages threshold")}
            >
                <InputNumber
                    autoFocus
                    className="w-8rem"
                    value={extractionProps.target_pages_threshold * 100}
                    onChange={(e) =>
                        (extractionProps.target_pages_threshold =
                            (e.value ? e.value : 0) / 100)
                    }
                    min={0}
                    max={100}
                    suffix="%"
                />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("Whole categories threshold")}
            >
                <InputNumber
                    className="w-8rem"
                    value={extractionProps.whole_categories_threshold * 100}
                    onChange={(e) =>
                        (extractionProps.whole_categories_threshold =
                            (e.value ? e.value : 0) / 100)
                    }
                    suffix="%"
                />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("Include categories")}
            >
                <AssignableCategoriesProvider>
                    <AssignableCategoriesPicker
                        className="w-16rem"
                        categories_ids={selectedCategories}
                        callback={handleCategoriesChange}
                    />
                </AssignableCategoriesProvider>
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("Pages count")}
            >
                <InputNumber
                    className="w-8rem"
                    value={pagesCount}
                    onChange={(e) => setPagesCount(e.value)}
                />
            </LabeledComponent>
            <Button
				// style={
                //    generating ? { animation: "spin 1s infinite linear" } : {}
                // }
                label={t("Generate")}
                disabled={pagesCount === null || generating}
                onClick={handleGenerate}
            />
        </div>
    );
};

export default ExtractionPropsMenu;
