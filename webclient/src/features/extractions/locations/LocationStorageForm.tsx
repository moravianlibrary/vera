import React from "react";
import { useTranslation } from "react-i18next";
import { Library, Storage } from "../../../adapters/ApiLocations";
import { useLocations } from "../../../contexts/LocationsContext";
import { useEffect, useState } from "react";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";

interface LocationStorageFormProps {
    library: Library | null;
    storage: Storage | null;
    onChangeStorage: (storage: Storage | null) => void;
}

const LocationStorageForm: React.FC<LocationStorageFormProps> = ({
    library,
    storage,
    onChangeStorage,
}) => {
    const { t } = useTranslation("locations");
    const { createStorage, storages } = useLocations();

    const [storageOptions, setStorageOptions] = useState<Storage[]>([]);
    const [selectedStorage, setSelectedStorage] = useState<Storage | null>(
        storage
    );
    const [createMode, setCreateMode] = useState(false);
    const [createStorageName, setCreateStorageName] = useState<string>("");

    const handleChangeStorage = (storage: Storage | null) => {
        setSelectedStorage(storage);
        onChangeStorage(storage);
    };

    const handleCreateStorage = () => {
        createStorage(library?.id!, createStorageName).then((storage) => {
            setStorageOptions([...storageOptions, storage]);
            handleChangeStorage(storage);
            setCreateMode(false);
        });
    };

    useEffect(() => {
        if (!library) {
            setStorageOptions([]);
            handleChangeStorage(null);
        } else {
            setStorageOptions(
                storages.filter((s) => s.library_id === library.id)
            );
            handleChangeStorage(
                storages.filter((s) => s.library_id === library.id).length > 0
                    ? storages.filter((s) => s.library_id === library.id)[0]
                    : null
            );
        }
    }, [library]);

    if (createMode) {
        return (
            <div className="flex p-inputgroup">
                <InputText
                    value={createStorageName}
                    onChange={(e) => setCreateStorageName(e.target.value)}
                />
                <Button
                    icon="pi pi-check"
                    outlined
                    severity="success"
                    onClick={handleCreateStorage}
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
                value={selectedStorage}
                options={storageOptions}
                optionLabel="name"
                disabled={!library}
                onChange={(e) => handleChangeStorage(e.value)}
                emptyMessage={t("form.placeholder.create-storage")}
            />
            <Button
                icon="pi pi-plus"
                outlined
                disabled={!library}
                onClick={() => setCreateMode(true)}
            />
        </div>
    );
};

export default LocationStorageForm;
