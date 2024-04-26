import { InputNumber } from "primereact/inputnumber";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import LabeledComponent from "../../components/LabeledComponent";
import { useLocations } from "../../contexts/extractions/locations/LocationsContext";
import { Dropdown } from "primereact/dropdown";
import { Library } from "../../adapters/ApiLocations";

interface CreateLocationMenuProps {}

const CreateLocationMenu: React.FC<CreateLocationMenuProps> = () => {
    const { t } = useTranslation();
    const { createStorage, createLocation } = useLocations();

    return (
        <div className="flex flex-column gap-1">
            <LabeledComponent
                className="justify-content-between"
                label={t("Library")}
            >
                <LocationLibraryPicker />
            </LabeledComponent>
            <LabeledComponent
                className="justify-content-between"
                label={t("Storage")}
            >
                <LocationLibraryPicker />
            </LabeledComponent>
            {/* <LabeledComponent
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
            /> */}
        </div>
    );
};

const LocationLibraryPicker = () => {
    const { libraries } = useLocations();

    const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(
        null
    );

    return (
        <Dropdown
            value={selectedLibrary}
            options={libraries}
            onChange={(e) => setSelectedLibrary(e.value)}
            editable
        />
    );
};

const LocationStoragePicker = () => {
    const { libraries } = useLocations();

    const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(
        null
    );

    return (
        <Dropdown
            value={selectedLibrary}
            options={libraries}
            onChange={(e) => setSelectedLibrary(e.value)}
            editable
        />
    );
};

export default CreateLocationMenu;
