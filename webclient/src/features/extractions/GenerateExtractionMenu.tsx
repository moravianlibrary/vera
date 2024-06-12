import { InputNumber } from "primereact/inputnumber";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { GenerateExtraction } from "../../adapters/ApiGeneratedExtractions";
import { useGeneratedExtractions } from "../../contexts/extractions/GeneratedExtractionsContext";
import { AssignableCategoriesPicker } from "../../components/pickers/AssignableCategoryPicker";
import LabeledComponent from "../../components/LabeledComponent";
import { Button } from "primereact/button";
import LocationPicker, {
    LocationType,
    MetaLocation,
} from "../../components/pickers/LocationPicker";
import { Library, Storage } from "../../adapters/ApiLocations";
import { CategoriesProvider } from "../../contexts/categories/CategoriesContext";
import { IntentionsProvider } from "../../contexts/categories/IntentionsContext";

interface ExtractionPropsMenuProps {}

const ExtractionPropsMenu: React.FC<ExtractionPropsMenuProps> = () => {
    const { t } = useTranslation();
    const { defaultProps, generateExtraction, generating } =
        useGeneratedExtractions();

    const [extractionProps, setExtractionProps] = useState<GenerateExtraction>(
        JSON.parse(JSON.stringify(defaultProps))
    );

    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
    const [pagesCount, setPagesCount] = useState<number | null>(null);

    const handleCategoriesChange = (categories: number[]) => {
        extractionProps.include_categories = categories;
        setExtractionProps(extractionProps);
        setSelectedCategories(categories);
    };

    const handleLocationsChange = (locations: number[]) => {
        extractionProps.location_ids = locations;
        setExtractionProps(extractionProps);
        setSelectedLocations(locations);
    };

    const handleGenerate = () => {
        if (!generating && pagesCount) {
            generateExtraction(extractionProps, pagesCount, undefined);
        }
    };

    return (
        <div className="flex flex-column gap-2">
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
                className="justify-content-between flex "
                label={t("Include only documents from these categories")}
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
                label={t("Include only documents from these locations")}
            >
                <LocationsPicker callback={handleLocationsChange} />
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

interface LocationsPickerProps {
    callback(location_ids: number[]): void;
}

const LocationsPicker: React.FC<LocationsPickerProps> = ({ callback }) => {
    const [pickedLocations, setPickedLocations] = useState<
        (MetaLocation | null)[]
    >([null]);

    const handleCallback = (locations: (MetaLocation | null)[]) => {
        callback(
            locations
                .filter((l) => l !== null)
                .map((location) => {
                    if (location!.type === LocationType.Library) {
                        return (location!.data as Library).storages
                            .flatMap((s) => s.locations)
                            .map((l) => l.id);
                    }
                    if (location!.type === LocationType.Storage) {
                        return (location!.data as Storage).locations.map(
                            (l) => l.id
                        );
                    }
                    return [location!.data.id];
                })
                .flat()
        );
    };

    const handlePickLocation = (
        index: number,
        location: MetaLocation | null
    ) => {
        const newPickedLocations = [...pickedLocations];
        newPickedLocations[index] = location;
        setPickedLocations(newPickedLocations);
        handleCallback(newPickedLocations);
    };

    const handleRemoveLocation = (index: number) => {
        const newPickedLocations = pickedLocations.filter(
            (_, i) => i !== index
        );
        setPickedLocations(newPickedLocations);
        handleCallback(newPickedLocations);
    };

    return (
        <div>
            {pickedLocations.map((pl, i) => (
                <LocationPickerForm
                    key={i}
                    index={i}
                    isLast={i === pickedLocations.length - 1}
                    location={pl}
                    callback={handlePickLocation}
                    remove={handleRemoveLocation}
                />
            ))}
        </div>
    );
};

interface LocationPickerFormProps {
    index: number;
    isLast: boolean;
    location: MetaLocation | null;
    callback(index: number, location: MetaLocation | null): void;
    remove: (index) => void;
}

const LocationPickerForm: React.FC<LocationPickerFormProps> = ({
    index,
    isLast,
    location,
    callback,
    remove,
}) => {
    if (isLast) {
        return (
            <div className="p-inputgroup">
                <LocationPicker
                    location={location}
                    callback={(l) => callback(index, l)}
                />
                <Button
                    icon="pi pi-plus"
                    outlined
                    onClick={() => callback(index + 1, null)}
                />
            </div>
        );
    }

    return (
        <div className="p-inputgroup">
            <LocationPicker
                location={location}
                callback={(l) => callback(index, l)}
            />
            <Button
                icon="pi pi-trash"
                severity="danger"
                outlined
                onClick={() => remove(index)}
            />
        </div>
    );
};

export default ExtractionPropsMenu;
