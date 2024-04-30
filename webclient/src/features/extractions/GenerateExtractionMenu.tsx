import { InputNumber } from "primereact/inputnumber";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { GenerateExtraction } from "../../adapters/ApiGeneratedExtractions";
import { useGeneratedExtractions } from "../../contexts/extractions/GeneratedExtractionsContext";
import { AssignableCategoriesProvider } from "../../contexts/categories/AssignableCategoriesContext";
import { AssignableCategoriesPicker } from "../../components/pickers/AssignableCategoryPicker";
import LabeledComponent from "../../components/LabeledComponent";
import { Button } from "primereact/button";
import LocationPicker, {
    LocationType,
    MetaLocation,
} from "../../components/pickers/LocationPicker";

interface ExtractionPropsMenuProps {}

const ExtractionPropsMenu: React.FC<ExtractionPropsMenuProps> = () => {
    const { t } = useTranslation();
    const { defaultProps, generateExtraction, generating } =
        useGeneratedExtractions();

    const [extractionProps, setExtractionProps] = useState<GenerateExtraction>(
        JSON.parse(JSON.stringify(defaultProps))
    );

    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<MetaLocation[]>(
        []
    );
    const [pagesCount, setPagesCount] = useState<number | null>(null);

    const handleCategoriesChange = (categories: number[]) => {
        extractionProps.include_categories = categories;
        setExtractionProps(extractionProps);
        setSelectedCategories(categories);
    };

    const handleGenerate = () => {
        if (!generating && pagesCount) {
            generateExtraction(
                extractionProps,
                pagesCount,
                undefined,
                selectedLocations
                    .filter((l) => l.type === LocationType.Library)
                    .map((l) => l.data.id),
                selectedLocations
                    .filter((l) => l.type === LocationType.Storage)
                    .map((l) => l.data.id),
                selectedLocations
                    .filter((l) => l.type === LocationType.Location)
                    .map((l) => l.data.id)
            );
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
                label={t("Include all documents from these categories")}
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
                label={t("Include only documents from these locations")}
            >
                <LocationsPicker callback={setSelectedLocations} />
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
    callback(locations: MetaLocation[]): void;
}

const LocationsPicker: React.FC<LocationsPickerProps> = ({ callback }) => {
    const [pickedLocations, setPickedLocations] = useState<
        (MetaLocation | null)[]
    >([null]);

    const handlePickLocation = (
        index: number,
        location: MetaLocation | null
    ) => {
        const newPickedLocations = [...pickedLocations];
        newPickedLocations[index] = location;
        setPickedLocations(newPickedLocations);
        callback(
            newPickedLocations.filter((l) => l !== null) as MetaLocation[]
        );
    };

    const handleRemoveLocation = (index: number) => {
        const newPickedLocations = pickedLocations.filter(
            (_, i) => i !== index
        );
        callback(newPickedLocations as MetaLocation[]);
        setPickedLocations(newPickedLocations);
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
