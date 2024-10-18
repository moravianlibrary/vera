import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocations } from "../../../contexts/LocationsContext";
import { Library } from "../../../adapters/ApiLocations";
import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { Button } from "primereact/button";
import LabeledComponent from "../../../components/LabeledComponent";
import { InputText } from "primereact/inputtext";
import { useToast } from "../../../contexts/ToastContext";

interface LibraryMenuProps {
    onClose: () => void;
}

const LibraryMenu: React.FC<LibraryMenuProps> = ({ onClose }) => {
    const { t } = useTranslation("locations");
    const showToast = useToast();
    const { libraries, storages, updateLibrary, deleteLibrary } =
        useLocations();

    const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(
        null
    );
    const [libraryName, setLibraryName] = useState<string>("");

    const handleSelectLibrary = (event: DropdownChangeEvent) => {
        const library = libraries.find((l) => l.id === event.value) ?? null;
        setSelectedLibrary(library);
        setLibraryName(library?.name ?? "");
    };

    const handleUpdateLibrary = () => {
        if (selectedLibrary && libraryName) {
            updateLibrary(selectedLibrary.id, libraryName);
            setSelectedLibrary(null);
            setLibraryName("");
        }
    };

    const handleDeleteLibrary = () => {
        if (selectedLibrary) {
            if (storages.some((s) => s.library_id === selectedLibrary.id)) {
                showToast(
                    "error",
                    t(
                        "The library cannot be deleted because it contains storages"
                    )
                );
                return;
            }
            deleteLibrary(selectedLibrary.id);
            setSelectedLibrary(null);
            setLibraryName("");
        }
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="flex flex-column gap-1">
                <div className="p-inputgroup">
                    <Dropdown
                        value={selectedLibrary?.id}
                        options={libraries}
                        onChange={handleSelectLibrary}
                        optionLabel="name"
                        optionValue="id"
                        placeholder={t("form.placeholder.library")}
                    />
                    <Button
                        severity="danger"
                        outlined
                        icon="pi pi-trash"
                        disabled={!selectedLibrary}
                        onClick={handleDeleteLibrary}
                    />
                </div>
                <LabeledComponent
                    className="justify-content-between"
                    label={t("form.library-name")}
                >
                    <InputText
                        value={libraryName}
                        onChange={(e) => setLibraryName(e.target.value)}
                        disabled={!selectedLibrary}
                    />
                </LabeledComponent>
            </div>
            <div className="flex gap-1">
                <Button
                    className="w-full"
                    label={t("save", { ns: "app" })}
                    severity="success"
                    outlined
                    icon="pi pi-check"
                    disabled={!selectedLibrary}
                    onClick={handleUpdateLibrary}
                />
                <Button
                    className="w-full"
                    label={t("cancel", { ns: "app" })}
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

export default LibraryMenu;
