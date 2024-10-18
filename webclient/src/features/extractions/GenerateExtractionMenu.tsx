import { InputNumber } from "primereact/inputnumber";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Extraction } from "../../adapters/ApiExtractions";
import { useExtractions } from "../../contexts/GeneratedExtractionsContext";
import { AssignableCategoriesPicker } from "../../components/pickers/AssignableCategoryPicker";
import LabeledComponent from "../../components/LabeledComponent";
import { Button } from "primereact/button";
import { Library, Location, Storage } from "../../adapters/ApiLocations";
import { CategoriesProvider } from "../../contexts/categories/CategoriesContext";
import { IntentionsProvider } from "../../contexts/categories/IntentionsContext";
import LocationsPicker from "../../components/pickers/LocationsPicker";

interface ExtractionPropsMenuProps {}

const ExtractionPropsMenu: React.FC<ExtractionPropsMenuProps> = () => {
    const { t } = useTranslation("extractions");
    const { defaultProps, generateExtraction, generating } = useExtractions();

    const [extractionProps, setExtractionProps] = useState<Extraction>(
        JSON.parse(JSON.stringify(defaultProps))
    );

    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<Location[]>([]);
    const [pagesCount, setPagesCount] = useState<number | null>(null);

    const handleCategoriesChange = (categories: number[]) => {
        extractionProps.include_categories = categories;
        setExtractionProps(extractionProps);
        setSelectedCategories(categories);
    };

    const handleLocationsChange = (locations: Location[]) => {
        const locationIds = locations.map((l) => l.id);
        extractionProps.location_ids = locationIds;
        setExtractionProps(extractionProps);
        setSelectedLocations(locations);
    };

    const handleGenerate = () => {
        if (!generating && pagesCount) {
            generateExtraction({
                ...extractionProps,
                target_pages: pagesCount,
            });
        }
    };

    return (
        <div className="flex flex-column gap-2">
            <LabeledComponent
                className="justify-content-between"
                label={t("form.target-page-threshold")}
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
                label={t("form.whole-categories-threshold")}
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
                className="justify-content-between flex "
                label={t("form.only-include-categories")}
            >
                <IntentionsProvider>
                    <CategoriesProvider>
                        <AssignableCategoriesPicker
                            className="w-16rem"
                            categories_ids={selectedCategories}
                            callback={handleCategoriesChange}
                        />
                    </CategoriesProvider>
                </IntentionsProvider>
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("form.only-include-locations")}
            >
                <LocationsPicker
                    value={selectedLocations}
                    callback={handleLocationsChange}
                />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("form.page-count")}
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
                label={t("form.submit")}
                disabled={pagesCount === null || generating}
                onClick={handleGenerate}
            />
        </div>
    );
};

export default ExtractionPropsMenu;
