import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocations } from "../../../contexts/LocationsContext";
import { Library, Storage } from "../../../adapters/ApiLocations";
import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { Button } from "primereact/button";
import LocationLibraryForm from "./LocationLibraryForm";
import LabeledComponent from "../../../components/LabeledComponent";
import { InputText } from "primereact/inputtext";
import { useToast } from "../../../contexts/ToastContext";

interface StorageMenuProps {
    onClose: () => void;
}

const StorageMenu: React.FC<StorageMenuProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { libraries, storages, updateStorage, deleteStorage } =
        useLocations();

    const [selectedStorage, setSelectedStorage] = useState<Storage | null>(
        null
    );
    const [library, setLibrary] = useState<Library | null>(null);
    const [storageName, setStorageName] = useState<string>("");

    const handleSelectStorage = (event: DropdownChangeEvent) => {
        const storage = storages.find((s) => s.id === event.value) ?? null;
        setSelectedStorage(storage);
        setLibrary(libraries.find((l) => l.id === storage?.library_id) ?? null);
        setStorageName(storage?.name ?? "");
    };

    const handleUpdateStorage = () => {
        if (selectedStorage && library && storageName) {
            updateStorage(selectedStorage.id, storageName, library.id);
        }
    };

    const handleDeleteStorage = () => {
        if (selectedStorage) {
            if (selectedStorage.locations.length > 0) {
                showToast(
                    "error",
                    t(
                        "The storage cannot be deleted because it contains locations"
                    )
                );
                return;
            }
            deleteStorage(selectedStorage.id);
            setSelectedStorage(null);
            setLibrary(null);
            setStorageName("");
        }
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="flex flex-column gap-1">
                <div className="p-inputgroup">
                    <Dropdown
                        value={selectedStorage?.id}
                        options={storages}
                        onChange={handleSelectStorage}
                        optionLabel="name"
                        optionValue="id"
                        placeholder={t("Select storage")}
                    />
                    <Button
                        severity="danger"
                        outlined
                        icon="pi pi-trash"
                        disabled={!selectedStorage}
                        onClick={handleDeleteStorage}
                    />
                </div>
                <LabeledComponent
                    className="justify-content-between"
                    label={t("Library")}
                >
                    <LocationLibraryForm
                        library={library}
                        onChangeLibrary={setLibrary}
                        disabled={!selectedStorage}
                    />
                </LabeledComponent>
                <LabeledComponent
                    className="justify-content-between"
                    label={t("Storage name")}
                >
                    <InputText
                        value={storageName}
                        onChange={(e) => setStorageName(e.target.value)}
                        disabled={!selectedStorage}
                    />
                </LabeledComponent>
            </div>
            <div className="flex gap-1">
                <Button
                    className="w-full"
                    label={t("Save")}
                    severity="success"
                    outlined
                    icon="pi pi-check"
                    disabled={!selectedStorage}
                    onClick={handleUpdateStorage}
                />
                <Button
                    className="w-full"
                    label={t("Cancel")}
                    severity="danger"
                    outlined
                    icon="pi pi-times"
                    onClick={() => {
                        onClose();
                    }}
                />
            </div>
        </div>
    );
};

export default StorageMenu;
