import { InputNumber } from "primereact/inputnumber";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExtractionProps } from "../../adapters/ApiExtractions";
import { useExtractions } from "../../contexts/extractions/ExtractionsContext";
import { AssignableCategoriesProvider } from "../../contexts/categories/AssignableCategoriesContext";
import AssignableCategoriesPicker from "../../components/AssignableCategoriesPicker";
import { AssignableCategory, Quota } from "../../adapters/ApiCategories";
import { QuotasProvider } from "../../contexts/categories/QuotasContext";
import QuotaPicker from "../../components/QuotaPicker";
import LabeledComponent from "../../components/LabeledComponent";
import { Button } from "primereact/button";


interface ExtractionPropsMenuProps {
}

const ExtractionPropsMenu: React.FC<ExtractionPropsMenuProps> = () => {
    const { t } = useTranslation();
    const { defaultProps, generateExtraction } = useExtractions();

    const extractionProps: ExtractionProps = JSON.parse(JSON.stringify(defaultProps));

    const [selectedCategories, setSelectedCategories] = useState<AssignableCategory[]>([]);
    const [selectedQuota, setSelectedQuota] = useState<Quota | undefined>(undefined);
    const [pagesCount, setPagesCount] = useState<number | null>(null);

    const handleCategoriesChange = (categories: AssignableCategory[]) => {
        extractionProps.include_categories = categories.map(category => category.id);
        setSelectedCategories(categories);
    };

    const handleGenerate = () => {  
        if (selectedQuota) {
            generateExtraction(extractionProps, undefined, selectedQuota.id);
        } else if (pagesCount) {
            generateExtraction(extractionProps, pagesCount, undefined);
        } else {
        }
    };

    console.log(selectedQuota);

    return (
        <div className="flex flex-column gap-1">
            <LabeledComponent className="justify-content-between" label={t('Target pages threshold')}>
                <InputNumber
                    autoFocus
                    className="w-8rem"
                    value={extractionProps.target_pages_threshold * 100}
                    onChange={(e) => extractionProps.target_pages_threshold = (e.value ? e.value : 0) / 100}
                    min={0}
                    max={100}
                    suffix="%"
                />
            </LabeledComponent>
            <LabeledComponent className="justify-content-between" label={t('Whole categories threshold')}>
                <InputNumber 
                    className="w-8rem"
                    value={extractionProps.whole_categories_threshold * 100}
                    onChange={(e) => extractionProps.whole_categories_threshold = (e.value ? e.value : 0) / 100}
                    suffix="%"
                />
            </LabeledComponent>
            <LabeledComponent className="justify-content-between" label={t('Include categories')}>
                <AssignableCategoriesProvider>
                    <AssignableCategoriesPicker
                        className="w-16rem"
                        selectedCategories={selectedCategories}
                        onCategoriesChange={handleCategoriesChange}
                    />
                </AssignableCategoriesProvider>
            </LabeledComponent>
            <LabeledComponent className="justify-content-between" label={t('Quota')}>
                <QuotasProvider>
                    <QuotaPicker
                        className="w-16rem"
                        selectedQuota={selectedQuota}
                        onQuotaChange={setSelectedQuota}
                        disabled={pagesCount !== null}
                    />
                </QuotasProvider>
            </LabeledComponent>
            <LabeledComponent className="justify-content-between" label={t('Pages count')}>
                <InputNumber
                    className="w-8rem"
                    value={pagesCount}
                    onChange={(e) => setPagesCount(e.value)}
                    disabled={selectedQuota !== undefined && selectedQuota !== null}
                />
            </LabeledComponent>
            <Button
                label={t('Generate')}
                disabled={pagesCount === null && selectedQuota === undefined}
                onClick={handleGenerate}
            />
        </div>
    );
}

export default ExtractionPropsMenu;
