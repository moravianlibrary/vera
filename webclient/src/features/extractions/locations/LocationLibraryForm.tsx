import React from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Library } from "../../../adapters/ApiLocations";
import { useTranslation } from "react-i18next";
import { useLocations } from "../../../contexts/extractions/locations/LocationsContext";
import { useState } from "react";

interface LocationLibraryFormProps {
    library: Library | null;
    onChangeLibrary: (library: Library | null) => void;
}

export const LocationLibraryForm: React.FC<LocationLibraryFormProps> = ({
    library,
    onChangeLibrary,
}) => {
    const { t } = useTranslation();
    const { libraries, createLibrary } = useLocations();

    const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(
        library
    );
    const [createMode, setCreateMode] = useState(false);
    const [createLibraryName, setCreateLibraryName] = useState<string>("");

    const handleChangeLibrary = (library: Library | null) => {
        setSelectedLibrary(library);
        onChangeLibrary(library);
    };

    const handleCreateLibrary = () => {
        createLibrary(createLibraryName).then((library) => {
            handleChangeLibrary(library);
            setCreateMode(false);
        });
    };

    if (createMode) {
        return (
            <div className="flex p-inputgroup">
                <InputText
                    autoFocus
                    value={createLibraryName}
                    onChange={(e) => setCreateLibraryName(e.target.value)}
                />
                <Button
                    icon="pi pi-check"
                    outlined
                    severity="success"
                    onClick={handleCreateLibrary}
                />
                <Button
                    icon="pi pi-times"
                    outlined
                    severity="danger"
                    onClick={() => setCreateMode(false)}
                />
            </div>
        );
    }

    return (
        <div className="flex p-inputgroup">
            <Dropdown
                value={selectedLibrary}
                options={libraries}
                optionLabel="name"
                onChange={(e) => handleChangeLibrary(e.value)}
                emptyMessage={t("Create new library")}
            />
            <Button
                icon="pi pi-plus"
                outlined
                onClick={() => setCreateMode(true)}
            />
        </div>
    );
};

export default LocationLibraryForm;
