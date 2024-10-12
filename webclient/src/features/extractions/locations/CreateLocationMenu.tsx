import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocations } from "../../../contexts/LocationsContext";
import { Library, Location, Storage } from "../../../adapters/ApiLocations";
import { Button } from "primereact/button";
import LocationForm from "./LocationForm";
import { LocationState } from "../../../types/LocationState";

interface CreateLocationMenuProps {
    location?: Location;
}

const CreateLocationMenu: React.FC<CreateLocationMenuProps> = ({
    location: inputLocation,
}) => {
    const { t } = useTranslation();
    const { libraries, createLocation } = useLocations();

    const [library, setLibrary] = useState<Library | null>(
        inputLocation
            ? inputLocation.storage.library
            : libraries.length === 1
            ? libraries[0]
            : null
    );
    const [storage, setStorage] = useState<Storage | null>(
        inputLocation ? inputLocation.storage : null
    );
    const [location, setLocation] = useState<Location | null>(
        inputLocation
            ? inputLocation
            : ({
                  name: "",
                  regexp: "",
                  state: LocationState.Active,
                  description: null,
                  additional_info: null,
              } as Location)
    );

    const handleCreateLocation = () => {
        if (storage && location) {
            createLocation(
                storage.id,
                location.name,
                location.regexp,
                location.state,
                location.description ?? null,
                location.additional_info ?? null
            );
        }
    };

    return (
        <div className="flex flex-column gap-1">
            <LocationForm
                library={library}
                storage={storage}
                location={location}
                onLibraryChange={setLibrary}
                onStorageChange={setStorage}
                onLocationChange={setLocation}
            />
            <Button
                outlined
                label={t("Create")}
                onClick={handleCreateLocation}
                disabled={!location?.name || !location?.regexp}
            />
        </div>
    );
};

export default CreateLocationMenu;
